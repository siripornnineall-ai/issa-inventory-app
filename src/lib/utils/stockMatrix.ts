import type { AppState } from "@/lib/store/state";
import type { ProductVariant } from "@/lib/types";
import { compareSizes } from "./sizes";

// ตารางสต็อกภาพรวมของ 1 รุ่น: แถว = สี, คอลัมน์ = ไซซ์, ช่อง = จำนวนคงเหลือ (on hand)
// null = สีนี้ไม่มีไซซ์นั้นเลย (ไม่เคยสร้างตัวเลือก) ต่างจาก 0 = มีตัวเลือกแต่สต็อกหมด
export interface StockMatrixRow {
  color: string;
  cells: Record<string, number | null>;
  total: number;
}

export interface StockMatrix {
  sizes: string[];
  rows: StockMatrixRow[];
  colTotals: Record<string, number>;
  grandTotal: number;
  negativeCells: number;
}

// จำนวนคงเหลือต่อตัวเลือกสินค้า รวมทุกคลัง หรือเฉพาะคลังที่เลือก
export function qtyByVariant(state: AppState, warehouseId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of Object.values(state.variantStock)) {
    if (warehouseId && s.warehouseId !== warehouseId) continue;
    map.set(s.itemId, (map.get(s.itemId) ?? 0) + s.qtyOnHand);
  }
  return map;
}

export function buildStockMatrix(variants: ProductVariant[], qty: Map<string, number>, opts: { hideEmpty?: boolean } = {}): StockMatrix {
  // ตัวเลือกที่ปิดใช้งานแล้วแต่ยังมีสต็อกค้าง (บวกหรือลบ) ต้องยังเห็น ไม่งั้นยอดรวมจะไม่ตรงความจริง
  const used = variants.filter((v) => v.active || (qty.get(v.id) ?? 0) !== 0);

  const sizes = Array.from(new Set(used.map((v) => v.size))).sort(compareSizes);
  const colorOrder: string[] = [];
  const byColor = new Map<string, Record<string, number | null>>();
  for (const v of used) {
    if (!byColor.has(v.color)) {
      byColor.set(v.color, Object.fromEntries(sizes.map((s) => [s, null])));
      colorOrder.push(v.color);
    }
    const cells = byColor.get(v.color)!;
    cells[v.size] = (cells[v.size] ?? 0) + (qty.get(v.id) ?? 0);
  }

  let rows: StockMatrixRow[] = colorOrder.map((color) => {
    const cells = byColor.get(color)!;
    const total = Object.values(cells).reduce<number>((sum, n) => sum + (n ?? 0), 0);
    return { color, cells, total };
  });

  const hasAnyStock = (r: StockMatrixRow) => Object.values(r.cells).some((n) => n !== null && n !== 0);
  if (opts.hideEmpty) rows = rows.filter(hasAnyStock);
  // สีที่มีสต็อกขึ้นก่อน เรียงจากมากไปน้อย สีที่เป็น 0 ทั้งแถวตามหลังตามลำดับเดิม (เรียงแบบเสถียร)
  rows = [...rows.filter(hasAnyStock).sort((a, b) => b.total - a.total), ...rows.filter((r) => !hasAnyStock(r))];

  const colTotals: Record<string, number> = Object.fromEntries(sizes.map((s) => [s, 0]));
  let negativeCells = 0;
  for (const r of rows) {
    for (const s of sizes) {
      const n = r.cells[s];
      if (n === null) continue;
      colTotals[s] += n;
      if (n < 0) negativeCells += 1;
    }
  }
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  return { sizes, rows, colTotals, grandTotal, negativeCells };
}
