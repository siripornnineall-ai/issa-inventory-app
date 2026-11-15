import type { AppState } from "@/lib/store/state";
import { variantStockAcrossWarehouses, sourceVariantFor } from "@/lib/store/selectors";
import { compareColors } from "@/lib/utils/colorOrder";
import { compareSizes } from "@/lib/utils/sizes";
import { wipBalances } from "@/lib/utils/factoryWip";

// วางแผนผลิต: ยอดขายอ้างอิงต่อเดือน เทียบกับของที่มี (คลัง + ที่ตัดแล้วรอเย็บที่ BC โชว์แยกกันเสมอ)
// ควรผลิตเพิ่ม = ยอดขายที่คาด (เผื่อสำรอง) - ของที่มี  ·  ช่องที่ของที่มีอยู่ได้ไม่ถึง COVER_DAYS_ALERT วัน = แดง  ·  ไม่มีของเลยแต่มียอดขาย = แดงเข้ม
export const PLAN_RULES = { coverDaysAlert: 30, daysPerMonth: 30, defaultBuffer: 0.15 } as const;
export type PlanLevel = "out" | "low";

export interface BaselineInput {
  productId: string;
  color: string;
  size: string;
  qty: number; // ยอดขายต่อเดือน
}

export interface PlanCell {
  variantId: string;
  demand: number; // ยอดขายต่อเดือน
  stock: number; // คลัง
  wip: number; // ตัดแล้วรอเย็บที่ BC
  have: number; // คลัง + รอเย็บ
  need: number; // ควรผลิตเพิ่ม (ชิ้น, ปัดขึ้น)
  coverDays: number | null; // อยู่ได้อีกกี่วัน (null = ไม่มียอดขาย)
  level?: PlanLevel;
}

export interface PlanMatrix {
  productId: string;
  name: string;
  brandId?: string;
  sizes: string[];
  colors: { color: string; cells: Record<string, PlanCell>; need: number }[];
  sizeNeed: Record<string, number>;
  totals: { demand: number; stock: number; wip: number; have: number; need: number; urgent: number };
}

export function planCell(demand: number, stock: number, wip: number, buffer: number): Omit<PlanCell, "variantId"> {
  const have = stock + wip;
  const need = Math.max(0, Math.ceil(Math.round((demand * (1 + buffer) - have) * 1e6) / 1e6)); // ปัดเศษทศนิยมลอยก่อน (100 x 1.1 ได้ 110.00000000000001)
  const coverDays = demand > 0 ? (have / demand) * PLAN_RULES.daysPerMonth : null;
  let level: PlanLevel | undefined;
  if (demand > 0) {
    if (have <= 0) level = "out";
    else if (coverDays !== null && coverDays < PLAN_RULES.coverDaysAlert) level = "low";
  }
  return { demand, stock, wip, have, need, coverDays, level };
}

export function productionPlan(state: AppState, baseline: BaselineInput[], opts: { buffer?: number; brandId?: string; search?: string } = {}): PlanMatrix[] {
  const buffer = opts.buffer ?? PLAN_RULES.defaultBuffer;
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
    const totals = { demand: 0, stock: 0, wip: 0, have: 0, need: 0, urgent: 0 };
    for (const v of variants) {
      const demand = demandByKey.get(`${productId}|${v.color}|${v.size}`) ?? 0;
      const stock = variantStockAcrossWarehouses(state, v.id).onHand;
      const w = Math.max(0, wip.get(v.id) ?? 0);
      // ช่องที่ไม่มียอดขายอ้างอิงและไม่มีของเลย ไม่ต้องโชว์
      if (demand === 0 && stock === 0 && w === 0) continue;
      const c = planCell(demand, stock, w, buffer);
      const row = byColor.get(v.color) ?? { color: v.color, cells: {}, need: 0 };
      row.cells[v.size] = { variantId: v.id, ...c };
      row.need += c.need;
      byColor.set(v.color, row);
      sizeNeed[v.size] = (sizeNeed[v.size] ?? 0) + c.need;
      totals.demand += demand;
      totals.stock += stock;
      totals.wip += w;
      totals.have += c.have;
      totals.need += c.need;
      if (c.level) totals.urgent += 1;
    }
    const colors = [...byColor.values()].sort((a, b) => compareColors(a.color, b.color, p));
    const usedSizes = sizes.filter((s) => colors.some((c) => c.cells[s]));
    result.push({ productId, name: p.sellingName, brandId: p.brandId, sizes: usedSizes, colors, sizeNeed, totals });
  }
  return result.sort((a, b) => b.totals.need - a.totals.need || a.name.localeCompare(b.name, "th"));
}

export function planSheetRows(state: AppState, matrices: PlanMatrix[]): (string | number)[][] {
  const rows: (string | number)[][] = [["แบรนด์", "รุ่น", "สี", "ไซซ์", "SKU", "ยอดขาย/เดือน", "คลัง", "รอเย็บที่ BC", "รวมที่มี", "อยู่ได้ (วัน)", "ควรผลิตเพิ่ม"]];
  for (const m of matrices) {
    const brand = m.brandId ? (state.brands[m.brandId]?.name ?? "") : "";
    for (const c of m.colors) {
      for (const size of m.sizes) {
        const cell = c.cells[size];
        if (!cell) continue;
        rows.push([brand, m.name, c.color, size, state.variants[cell.variantId]?.sku ?? "", cell.demand, cell.stock, cell.wip, cell.have, cell.coverDays === null ? "" : Math.round(cell.coverDays), cell.need]);
      }
    }
  }
  return rows;
}
