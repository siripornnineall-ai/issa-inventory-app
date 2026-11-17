import type { AppState } from "@/lib/store/state";
import { variantStockAcrossWarehouses, sourceVariantFor } from "@/lib/store/selectors";
import { colorRank, compareColors } from "@/lib/utils/colorOrder";
import { compareSizes } from "@/lib/utils/sizes";
import { wipBalances } from "@/lib/utils/factoryWip";

// วางแผนผลิต: ยอดขายอ้างอิงต่อเดือน เทียบกับของที่มี (คลัง + ที่ตัดแล้วรอเย็บที่ BC โชว์แยกกันเสมอ)
// ควรผลิตเพิ่ม = ยอดขายที่คาด (เผื่อสำรอง) - ของที่มี  ·  ช่องที่ของที่มีอยู่ได้ไม่ถึง COVER_DAYS_ALERT วัน = แดง  ·  ไม่มีของเลยแต่มียอดขาย = แดงเข้ม
export const PLAN_RULES = { coverDaysAlert: 30, daysPerMonth: 30, defaultBuffer: 0.15 } as const;
// หน้าวางแผนผลิตแสดงสีตามลำดับมาตรฐานถึงสีนี้เท่านั้น สีที่อยู่หลังจากนั้น (ม่วง เขียวขี้ม้า ฟ้า ส้มอิฐ ฯลฯ) ซ่อนไว้ ยกเว้นสีที่มียอดขายอ้างอิง (ไม่ให้ของที่ขายได้ขาดแล้วตกหาย)
// สีที่ไม่รู้จักลำดับ (สีใหม่) ไม่ซ่อน ใช้ลำดับของรุ่นนั้นก่อนถ้าตั้งไว้ (products.color_order)
export const PLAN_LAST_COLOR = "น้ำเงิน";
export type PlanLevel = "out" | "low";

export interface BaselineInput {
  productId: string;
  color: string;
  size: string;
  qty: number; // ยอดขายต่อเดือน
}

export interface PlanCell {
  variantId: string;
  demand: number; // ยอดขายตามจำนวนเดือนที่เลือกดู
  stock: number; // คลัง
  wip: number; // ตัดแล้วรอเย็บที่ BC
  have: number; // คลัง + รอเย็บ
  diff: number; // ส่วนต่าง = รวมที่มี - ยอดขาย (ติดลบ = ขาด)
  need: number; // ควรผลิตเพิ่ม (ชิ้น, ปัดขึ้น) = ส่วนที่ขาด (+ เผื่อสำรองถ้ามี)
  coverDays: number | null; // อยู่ได้อีกกี่วัน (null = ไม่มียอดขาย)
  level?: PlanLevel;
}

export interface PlanMatrix {
  productId: string;
  name: string;
  shape?: string; // ทรงสินค้า (ต่อท้ายชื่อรุ่นบนหน้าจอ)
  brandId?: string;
  sizes: string[];
  colors: { color: string; cells: Record<string, PlanCell>; need: number; demand: number; diff: number }[];
  sizeNeed: Record<string, number>;
  sizeDemand: Record<string, number>;
  sizeDiff: Record<string, number>;
  totals: { demand: number; stock: number; wip: number; have: number; diff: number; need: number; urgent: number };
}

export function planCell(demand: number, stock: number, wip: number, buffer: number, months = 1): Omit<PlanCell, "variantId"> {
  const have = stock + wip;
  const need = Math.max(0, Math.ceil(Math.round((demand * (1 + buffer) - have) * 1e6) / 1e6)); // ปัดเศษทศนิยมลอยก่อน (100 x 1.1 ได้ 110.00000000000001)
  const diff = Math.round((have - demand) * 100) / 100;
  const coverDays = demand > 0 ? (have / (demand / months)) * PLAN_RULES.daysPerMonth : null;
  let level: PlanLevel | undefined;
  if (demand > 0) {
    if (have <= 0) level = "out";
    else if (diff < 0) level = "low"; // ของที่มีไม่พอขายตามจำนวนเดือนที่เลือก
  }
  return { demand, stock, wip, have, diff, need, coverDays, level };
}

export function productionPlan(state: AppState, baseline: BaselineInput[], opts: { buffer?: number; months?: number; brandId?: string; search?: string } = {}): PlanMatrix[] {
  const buffer = opts.buffer ?? 0;
  const months = opts.months ?? 1;
  const q = (opts.search ?? "").trim().toLowerCase();
  const wip = wipBalances(state);
  const demandByKey = new Map<string, number>();
  const productIds = new Set<string>();
  for (const b of baseline) {
    demandByKey.set(`${b.productId}|${b.color}|${b.size}`, b.qty);
    productIds.add(b.productId);
  }
  const result: PlanMatrix[] = [];
  for (const productId of productIds) {
    const p = state.products[productId];
    if (!p) continue;
    if (opts.brandId && p.brandId !== opts.brandId) continue;
    if (q && !p.sellingName.toLowerCase().includes(q)) continue;
    const variants = Object.values(state.variants).filter((v) => v.productId === productId && v.active && !sourceVariantFor(state, v.id));
    const sizes = [...new Set(variants.map((v) => v.size))].sort(compareSizes);
    const byColor = new Map<string, PlanMatrix["colors"][number]>();
    const sizeNeed: Record<string, number> = {};
    const sizeDemand: Record<string, number> = {};
    const sizeDiff: Record<string, number> = {};
    const totals = { demand: 0, stock: 0, wip: 0, have: 0, diff: 0, need: 0, urgent: 0 };
    const cutoff = colorRank(PLAN_LAST_COLOR, p);
    const colorHasDemand = new Set<string>();
    for (const v of variants) if ((demandByKey.get(`${productId}|${v.color}|${v.size}`) ?? 0) > 0) colorHasDemand.add(v.color);
    const isHiddenColor = (color: string) => {
      const r = colorRank(color, p);
      return cutoff < Number.MAX_SAFE_INTEGER && r < Number.MAX_SAFE_INTEGER && r > cutoff && !colorHasDemand.has(color);
    };
    for (const v of variants) {
      if (isHiddenColor(v.color)) continue;
      const demand = Math.round((demandByKey.get(`${productId}|${v.color}|${v.size}`) ?? 0) * months * 100) / 100;
      const stock = variantStockAcrossWarehouses(state, v.id).onHand;
      const w = Math.max(0, wip.get(v.id) ?? 0);
      // ช่องที่ไม่มียอดขายอ้างอิงและไม่มีของเลย ไม่ต้องโชว์
      if (demand === 0 && stock === 0 && w === 0) continue;
      const c = planCell(demand, stock, w, buffer, months);
      const row = byColor.get(v.color) ?? { color: v.color, cells: {}, need: 0, demand: 0, diff: 0 };
      row.cells[v.size] = { variantId: v.id, ...c };
      row.need += c.need;
      row.demand += demand;
      row.diff += c.diff;
      byColor.set(v.color, row);
      sizeNeed[v.size] = (sizeNeed[v.size] ?? 0) + c.need;
      sizeDemand[v.size] = (sizeDemand[v.size] ?? 0) + demand;
      sizeDiff[v.size] = (sizeDiff[v.size] ?? 0) + c.diff;
      totals.demand += demand;
      totals.stock += stock;
      totals.wip += w;
      totals.have += c.have;
      totals.diff += c.diff;
      totals.need += c.need;
      if (c.level) totals.urgent += 1;
    }
    const colors = [...byColor.values()].sort((a, b) => compareColors(a.color, b.color, p));
    const usedSizes = sizes.filter((s) => colors.some((c) => c.cells[s]));
    result.push({ productId, name: p.sellingName, shape: p.shape, brandId: p.brandId, sizes: usedSizes, colors, sizeNeed, sizeDemand, sizeDiff, totals });
  }
  return result.sort((a, b) => b.totals.need - a.totals.need || a.name.localeCompare(b.name, "th"));
}

export function planSheetRows(state: AppState, matrices: PlanMatrix[]): (string | number)[][] {
  const rows: (string | number)[][] = [["แบรนด์", "รุ่น", "สี", "ไซซ์", "SKU", "ยอดขาย", "คลัง", "รอเย็บที่ BC", "รวมที่มี", "ส่วนต่าง (ติดลบ = ขาด)", "อยู่ได้ (วัน)", "ควรผลิตเพิ่ม"]];
  for (const m of matrices) {
    const brand = m.brandId ? (state.brands[m.brandId]?.name ?? "") : "";
    for (const c of m.colors) {
      for (const size of m.sizes) {
        const cell = c.cells[size];
        if (!cell) continue;
        rows.push([brand, m.name, c.color, size, state.variants[cell.variantId]?.sku ?? "", cell.demand, cell.stock, cell.wip, cell.have, cell.diff, cell.coverDays === null ? "" : Math.round(cell.coverDays), cell.need]);
      }
    }
  }
  return rows;
}

// วันที่ปลายทางของการดูล่วงหน้า n เดือนจากวันนี้ (วันเดียวกันของเดือนนั้น ถ้าเดือนนั้นไม่มีวันนี้ ใช้วันสุดท้ายของเดือน เช่น 31 ม.ค. + 1 เดือน = 28/29 ก.พ.)
export function addMonthsClamped(from: Date, n: number): Date {
  const y = from.getFullYear();
  const m = from.getMonth() + n;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(from.getDate(), lastDay));
}

// dd/mm/yyyy (ปี ค.ศ. ตามที่เจ้าของงานใช้ เช่น 17/12/2026)
export function formatPlanDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
