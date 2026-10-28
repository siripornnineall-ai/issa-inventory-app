import type { AppState } from "@/lib/store/state";
import { compareSizes } from "./sizes";
import { monthRange } from "./salesMatrix";
import { qtyByVariant } from "./stockMatrix";

// หน้านับสต็อกบันทึกผลเป็นรายการปรับยอดที่มีเหตุผลขึ้นต้นด้วยข้อความนี้ (รวมรายการที่นับแล้วตรงกับระบบ จำนวนไม่เปลี่ยน)
// จึงอ่านประวัติการนับย้อนหลังได้จาก stock_movements โดยไม่ต้องมีตารางเพิ่ม: ยอดก่อนนับ = qtyBefore, ยอดที่นับได้ = qtyAfter
export const COUNT_REASON_PREFIX = "นับสต็อก";

export interface RecountCell {
  counted: number;
  // ยอดในระบบก่อนบันทึกผลนับ
  system: number;
  diff: number;
}

export interface RecountColorRow {
  color: string;
  // null = ไม่มีตัวเลือกนี้ / ยังไม่ได้นับในเดือนนี้
  cells: Record<string, RecountCell | null>;
  // ยอดตอนนี้ของทุกช่องในสีนี้ (รวมช่องที่ไม่ได้นับ)
  now: number;
  counted: number;
  system: number;
  diff: number;
  countedCells: number;
}

export interface ProductRecount {
  productId: string;
  name: string;
  brandId: string | null;
  sizes: string[];
  rows: RecountColorRow[];
  counted: number;
  system: number;
  diff: number;
  now: number;
  countedCells: number;
  totalCells: number;
  // ช่องที่นับแล้วไม่ตรงกับระบบ
  diffCells: number;
}

// ผลนับสต็อกในเดือนปฏิทินที่ระบุ แยกตามรุ่น/สี/ไซซ์ ถ้านับตัวเลือกเดียวกันหลายครั้งในเดือน (หรือหลายคลัง) ใช้ครั้งล่าสุดของแต่ละคลัง
export function monthlyRecount(state: AppState, year: number, month0: number, opts: { warehouseId?: string } = {}): ProductRecount[] {
  const { from, to } = monthRange(year, month0);
  const latest = new Map<string, { at: number; whId: string; before: number; after: number }>();
  for (const m of Object.values(state.movements)) {
    if (m.itemType !== "product" || !m.variantId || m.movementType !== "adjustment" || !m.reason?.startsWith(COUNT_REASON_PREFIX)) continue;
    const whId = m.warehouseToId ?? "";
    if (opts.warehouseId && whId !== opts.warehouseId) continue;
    const at = new Date(m.createdAt).getTime();
    if (!(at >= from && at < to)) continue;
    const key = m.variantId + "::" + whId;
    const prev = latest.get(key);
    if (!prev || at >= prev.at) latest.set(key, { at, whId, before: m.qtyBefore, after: m.qtyAfter });
  }

  const byVariant = new Map<string, RecountCell>();
  for (const [key, c] of latest) {
    const variantId = key.split("::")[0];
    const cur = byVariant.get(variantId) ?? { counted: 0, system: 0, diff: 0 };
    cur.counted += c.after;
    cur.system += c.before;
    cur.diff = cur.counted - cur.system;
    byVariant.set(variantId, cur);
  }

  const now = qtyByVariant(state, opts.warehouseId);
  const variantsByProduct = new Map<string, string[]>();
  for (const v of Object.values(state.variants)) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(v.id);
    variantsByProduct.set(v.productId, list);
  }

  const out: ProductRecount[] = [];
  for (const [productId, ids] of variantsByProduct) {
    const product = state.products[productId];
    if (!product || !ids.some((id) => byVariant.has(id))) continue;
    // ตัวเลือกที่ปิดใช้งานแล้วแต่ถูกนับ/ยังมีของ ต้องยังเห็น
    const used = ids.filter((id) => state.variants[id].active || byVariant.has(id) || (now.get(id) ?? 0) !== 0);
    const sizes = Array.from(new Set(used.map((id) => state.variants[id].size))).sort(compareSizes);
    const colorOrder: string[] = [];
    const byColor = new Map<string, Record<string, RecountCell | null>>();
    const nowByColor = new Map<string, number>();
    for (const id of used) {
      const v = state.variants[id];
      if (!byColor.has(v.color)) {
        byColor.set(v.color, Object.fromEntries(sizes.map((s) => [s, null])));
        colorOrder.push(v.color);
      }
      const cell = byVariant.get(id);
      if (cell) byColor.get(v.color)![v.size] = cell;
      nowByColor.set(v.color, (nowByColor.get(v.color) ?? 0) + (now.get(id) ?? 0));
    }

    const rows: RecountColorRow[] = colorOrder.map((color) => {
      const cells = byColor.get(color)!;
      const counted = Object.values(cells).filter((c): c is RecountCell => c !== null);
      const sumCounted = counted.reduce((s, c) => s + c.counted, 0);
      const sumSystem = counted.reduce((s, c) => s + c.system, 0);
      return { color, cells, now: nowByColor.get(color) ?? 0, counted: sumCounted, system: sumSystem, diff: sumCounted - sumSystem, countedCells: counted.length };
    });
    // สีที่นับแล้วขึ้นก่อน เรียงตามยอดนับมากไปน้อย สีที่ไม่ได้นับตามหลัง
    const sorted = [...rows.filter((r) => r.countedCells > 0).sort((a, b) => b.counted - a.counted || a.color.localeCompare(b.color, "th")), ...rows.filter((r) => r.countedCells === 0)];

    const all = sorted.flatMap((r) => Object.values(r.cells).filter((c): c is RecountCell => c !== null));
    const counted = sorted.reduce((s, r) => s + r.counted, 0);
    const system = sorted.reduce((s, r) => s + r.system, 0);
    out.push({
      productId,
      name: product.sellingName,
      brandId: product.brandId && state.brands[product.brandId] ? product.brandId : null,
      sizes,
      rows: sorted,
      counted,
      system,
      diff: counted - system,
      now: sorted.reduce((s, r) => s + r.now, 0),
      countedCells: all.length,
      totalCells: used.length,
      diffCells: all.filter((c) => c.diff !== 0).length,
    });
  }
  // รุ่นที่มีส่วนต่างขึ้นก่อน (เรียงตามจำนวนช่องที่ไม่ตรง) แล้วจึงเรียงตามชื่อ
  return out.sort((a, b) => b.diffCells - a.diffCells || a.name.localeCompare(b.name, "th"));
}

export function recountSheetRows(title: string, products: ProductRecount[]): (string | number)[][] {
  const rows: (string | number)[][] = [[title], []];
  for (const p of products) {
    rows.push([p.name]);
    rows.push(["สี", ...p.sizes.map((s) => `${s} (นับได้)`), "นับได้", "ระบบก่อนนับ", "ผลต่าง", "ตอนนี้"]);
    for (const r of p.rows) rows.push([r.color, ...p.sizes.map((s) => r.cells[s]?.counted ?? ""), r.counted, r.system, r.diff, r.now]);
    rows.push(["รวม", ...p.sizes.map(() => ""), p.counted, p.system, p.diff, p.now]);
    rows.push([`นับแล้ว ${p.countedCells}/${p.totalCells} ตัวเลือก · ไม่ตรงกับระบบ ${p.diffCells} ตัวเลือก`]);
    rows.push([]);
  }
  return rows;
}
