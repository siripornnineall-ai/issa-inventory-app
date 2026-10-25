import { compareSizes } from "./sizes";

export type PriceField = "sellingPrice" | "purchasePrice";

export const PRICE_FIELD_LABEL: Record<PriceField, string> = {
  sellingPrice: "ราคาขาย",
  purchasePrice: "ราคาซื้อ",
};

interface PriceRow {
  size: string;
  sellingPrice: number;
  purchasePrice: number;
}

// ไซซ์ที่มีอยู่ในตาราง เรียงตามขนาดจริง (S ก่อน XL, 9XL ก่อน 10XL) ไม่ซ้ำกัน
export function sizesInRows(rows: Pick<PriceRow, "size">[]): string[] {
  return Array.from(new Set(rows.map((r) => r.size))).sort(compareSizes);
}

// ปัดเป็นสตางค์ กันเลขทศนิยมเพี้ยน (เช่น 0.1 + 0.2)
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PriceAdjustResult<T> {
  rows: T[];
  changed: number;
  // ตัวเลือกที่ราคาจะติดลบ ถ้ามีจะไม่ปรับอะไรเลย (rows คืนค่าเดิม) ให้แจ้งผู้ใช้
  negative: { size: string; before: number }[];
}

// เพิ่ม (delta เป็นบวก) หรือลด (delta เป็นลบ) ราคาของทุกตัวเลือกที่เป็นไซซ์ที่เลือก ทุกสี
export function applyPriceAdjustment<T extends PriceRow>(rows: T[], opts: { field: PriceField; delta: number; sizes: string[] }): PriceAdjustResult<T> {
  const target = new Set(opts.sizes);
  const negative: { size: string; before: number }[] = [];
  for (const r of rows) {
    if (target.has(r.size) && round2(r[opts.field] + opts.delta) < 0) negative.push({ size: r.size, before: r[opts.field] });
  }
  if (negative.length > 0 || opts.delta === 0) return { rows, changed: 0, negative };
  let changed = 0;
  const next = rows.map((r) => {
    if (!target.has(r.size)) return r;
    changed += 1;
    return { ...r, [opts.field]: round2(r[opts.field] + opts.delta) };
  });
  return { rows: next, changed, negative };
}
