import type { AppState } from "@/lib/store/state";
import { NET_SALES_RETURN_TYPES } from "@/lib/types";
import { compareSizes } from "./sizes";

// วันแรกที่ระบบบันทึกการขายจริง (ก่อนหน้านี้เป็นข้อมูลทดสอบ/ยังไม่ครบ) ใช้เตือนในหน้ายอดขายรายเดือน
export const REAL_DATA_START = "2026-10-12";

// ช่วงเวลาของเดือนตามปฏิทิน (วันที่ 1 ถึงสิ้นเดือน เวลาท้องถิ่น) เป็น [from, to) หน่วยมิลลิวินาที
export function monthRange(year: number, month0: number): { from: number; to: number } {
  return { from: new Date(year, month0, 1).getTime(), to: new Date(year, month0 + 1, 1).getTime() };
}

export function shiftMonth(year: number, month0: number, delta: number): { year: number; month0: number } {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

// ทุกเดือนตั้งแต่เดือนของเวลาเริ่มต้นจนถึงเดือนนี้ เรียงจากใหม่ไปเก่า (ใช้ส่งออก Excel ย้อนหลัง) / ว่างเมื่อไม่มีเวลาเริ่มต้น
export function monthsSince(startMs: number | null, now = new Date()): { year: number; month0: number }[] {
  if (startMs === null || !Number.isFinite(startMs)) return [];
  const start = new Date(startMs);
  const out: { year: number; month0: number }[] = [];
  let cur = { year: now.getFullYear(), month0: now.getMonth() };
  while (cur.year > start.getFullYear() || (cur.year === start.getFullYear() && cur.month0 >= start.getMonth())) {
    out.push(cur);
    cur = shiftMonth(cur.year, cur.month0, -1);
  }
  return out;
}

// วันที่ขายแรกสุดของออเดอร์ที่ไม่ถูกยกเลิก
export function firstSaleMs(state: AppState): number | null {
  let min: number | null = null;
  for (const o of Object.values(state.orders)) {
    if (o.status === "cancelled") continue;
    const t = new Date(o.date).getTime();
    if (Number.isFinite(t) && (min === null || t < min)) min = t;
  }
  return min;
}

interface Tally {
  sold: number;
  returned: number;
}

// ยอดขายสุทธิต่อตัวเลือก ในช่วงเวลาหนึ่ง
//  - ขาย = จำนวนชิ้นของออเดอร์ที่ไม่ถูกยกเลิก ตามวันที่ขายของออเดอร์ (ยกเลิกทีหลังจึงหายจากเดือนที่ขาย ไม่ไปติดลบเดือนอื่น)
//  - หัก = ของที่รับคืนเข้าคลัง (ตีกลับ / คืน / เปลี่ยน) ตามวันที่รับคืน (ไม่หักสินค้าตำหนิ) ของคืนไม่ผูกกับออเดอร์เดิม จึงหักในเดือนที่รับ
function tally(state: AppState, from: number, to: number): Map<string, Tally> {
  const map = new Map<string, Tally>();
  const get = (id: string) => {
    let t = map.get(id);
    if (!t) {
      t = { sold: 0, returned: 0 };
      map.set(id, t);
    }
    return t;
  };
  for (const o of Object.values(state.orders)) {
    if (o.status === "cancelled") continue;
    const t = new Date(o.date).getTime();
    if (!(t >= from && t < to)) continue;
    for (const l of o.lines) if (l.variantId) get(l.variantId).sold += l.qty;
  }
  const returnTypes: string[] = NET_SALES_RETURN_TYPES;
  for (const m of Object.values(state.movements)) {
    if (m.itemType !== "product" || !m.variantId || !returnTypes.includes(m.movementType)) continue;
    const t = new Date(m.createdAt).getTime();
    if (t >= from && t < to) get(m.variantId).returned += m.qtyChange;
  }
  return map;
}

export interface SalesColorRow {
  color: string;
  cells: Record<string, number>;
  total: number;
  // สัดส่วนของสีนี้ในยอดรวมของรุ่น (%) / null เมื่อยอดรวมของรุ่นไม่เป็นบวก
  sharePct: number | null;
}

export interface ProductSales {
  productId: string;
  name: string;
  brandId: string | null;
  sold: number;
  returned: number;
  net: number;
  prevNet: number;
  sizes: string[];
  colors: SalesColorRow[];
  sizeTotals: Record<string, number>;
  maxCell: number;
}

// ยอดขายสุทธิรายเดือนแยกตามรุ่น (แถว = สี, คอลัมน์ = ไซซ์) เรียงรุ่นและสีจากขายมากไปน้อย
export function monthlySales(state: AppState, year: number, month0: number, opts: { includeEmptyColors?: boolean } = {}): ProductSales[] {
  const cur = monthRange(year, month0);
  const prevM = shiftMonth(year, month0, -1);
  const prevR = monthRange(prevM.year, prevM.month0);
  const now = tally(state, cur.from, cur.to);
  const before = tally(state, prevR.from, prevR.to);

  const byProduct = new Map<string, string[]>();
  for (const v of Object.values(state.variants)) {
    const list = byProduct.get(v.productId) ?? [];
    list.push(v.id);
    byProduct.set(v.productId, list);
  }

  const out: ProductSales[] = [];
  for (const [productId, variantIds] of byProduct) {
    const product = state.products[productId];
    if (!product) continue;
    const active = variantIds.filter((id) => {
      const t = now.get(id);
      return t && (t.sold !== 0 || t.returned !== 0);
    });
    if (active.length === 0) continue;

    const shown = opts.includeEmptyColors ? variantIds : active;
    const sizes = Array.from(new Set(variantIds.map((id) => state.variants[id].size))).sort(compareSizes);
    const colorMap = new Map<string, Record<string, number>>();
    for (const id of shown) {
      const v = state.variants[id];
      const t = now.get(id);
      const net = (t?.sold ?? 0) - (t?.returned ?? 0);
      const cells = colorMap.get(v.color) ?? {};
      cells[v.size] = (cells[v.size] ?? 0) + net;
      colorMap.set(v.color, cells);
    }

    let sold = 0;
    let returned = 0;
    let prevNet = 0;
    for (const id of variantIds) {
      sold += now.get(id)?.sold ?? 0;
      returned += now.get(id)?.returned ?? 0;
      prevNet += (before.get(id)?.sold ?? 0) - (before.get(id)?.returned ?? 0);
    }
    const net = sold - returned;

    const sizeTotals: Record<string, number> = Object.fromEntries(sizes.map((s) => [s, 0]));
    let maxCell = 0;
    const colors: SalesColorRow[] = Array.from(colorMap.entries()).map(([color, cells]) => {
      const row: Record<string, number> = {};
      let total = 0;
      for (const s of sizes) {
        const n = cells[s] ?? 0;
        row[s] = n;
        total += n;
        sizeTotals[s] += n;
        if (n > maxCell) maxCell = n;
      }
      return { color, cells: row, total, sharePct: net > 0 ? Math.round((total / net) * 1000) / 10 : null };
    });
    colors.sort((a, b) => b.total - a.total || a.color.localeCompare(b.color, "th"));

    out.push({ productId, name: product.sellingName, brandId: product.brandId && state.brands[product.brandId] ? product.brandId : null, sold, returned, net, prevNet, sizes, colors, sizeTotals, maxCell });
  }
  return out.sort((a, b) => b.net - a.net || a.name.localeCompare(b.name, "th"));
}

// เทียบเดือนก่อน เป็นเปอร์เซ็นต์ / null เมื่อเดือนก่อนไม่มียอด
export function changePct(net: number, prevNet: number): number | null {
  return prevNet > 0 ? Math.round(((net - prevNet) / prevNet) * 100) : null;
}

// แถวสำหรับส่งออก Excel หน้าตาเหมือนชีตเดิม: ชื่อรุ่น / หัวไซซ์ / แถวสี / รวมต่อไซซ์
export function salesSheetRows(title: string, products: ProductSales[]): (string | number)[][] {
  const rows: (string | number)[][] = [[title], []];
  for (const p of products) {
    rows.push([p.name]);
    rows.push(["สี", ...p.sizes, "รวมต่อสี", "%"]);
    for (const c of p.colors) rows.push([c.color, ...p.sizes.map((s) => c.cells[s] ?? 0), c.total, c.sharePct === null ? "" : `${c.sharePct}%`]);
    rows.push(["รวมต่อไซซ์", ...p.sizes.map((s) => p.sizeTotals[s] ?? 0), p.net, p.net > 0 ? "100%" : ""]);
    rows.push([`ขาย ${p.sold} − คืน ${p.returned} = สุทธิ ${p.net} ชิ้น`]);
    rows.push([]);
  }
  return rows;
}
