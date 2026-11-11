import type { AppState } from "@/lib/store/state";
import { FACTORY_WIP_KIND_LABEL_TH, type FactoryWipKind } from "@/lib/types";
import { compareSizes } from "@/lib/utils/sizes";
import { compareColors } from "@/lib/utils/colorOrder";
import { wipByProduct, type WipProductSummary } from "./factoryWip";

// ข้อมูลสำหรับหน้าโรงงาน BC: ตารางสี x ไซซ์ต่อรุ่น และประวัติการบันทึก (รวมตามครั้งที่บันทึก)

export interface WipMatrix {
  productId: string;
  name: string;
  brandId?: string;
  total: number;
  negativeCells: number;
  sizes: string[];
  colors: { color: string; total: number; cells: Record<string, number> }[];
  sizeTotals: Record<string, number>;
  maxCell: number;
}

function toMatrix(p: WipProductSummary, product?: { colorOrder?: string[] }): WipMatrix {
  const sizes = [...new Set(p.variants.map((v) => v.size))].sort(compareSizes);
  const byColor = new Map<string, { color: string; total: number; cells: Record<string, number> }>();
  const sizeTotals: Record<string, number> = {};
  let maxCell = 0;
  for (const v of p.variants) {
    const c = byColor.get(v.color) ?? { color: v.color, total: 0, cells: {} };
    c.cells[v.size] = (c.cells[v.size] ?? 0) + v.qty;
    c.total += v.qty;
    byColor.set(v.color, c);
    sizeTotals[v.size] = (sizeTotals[v.size] ?? 0) + v.qty;
    maxCell = Math.max(maxCell, v.qty);
  }
  const colors = [...byColor.values()].sort((a, b) => compareColors(a.color, b.color, product));
  return { productId: p.productId, name: p.name, brandId: p.brandId, total: p.total, negativeCells: p.negativeCells, sizes, colors, sizeTotals, maxCell };
}

export function wipMatrices(state: AppState, filter: { brandId?: string; search?: string } = {}): WipMatrix[] {
  const q = (filter.search ?? "").trim().toLowerCase();
  return wipByProduct(state)
    .filter((p) => (!filter.brandId || p.brandId === filter.brandId) && (!q || p.name.toLowerCase().includes(q)))
    .map((p) => toMatrix(p, state.products[p.productId]));
}

export interface WipBatch {
  batchId: string;
  date: string;
  createdAt: string;
  kind: FactoryWipKind;
  kindLabel: string;
  actorName: string;
  note?: string;
  pieces: number; // ผลรวมที่เปลี่ยน (เสียหายเป็นลบ)
  cells: number;
  products: string[];
}

export function wipBatches(state: AppState): WipBatch[] {
  const map = new Map<string, WipBatch>();
  for (const e of Object.values(state.factoryWipEntries ?? {})) {
    const v = state.variants[e.variantId];
    const name = (v ? state.products[v.productId]?.sellingName : undefined) ?? "ไม่ทราบรุ่น";
    const b = map.get(e.batchId) ?? { batchId: e.batchId, date: e.date, createdAt: e.createdAt, kind: e.kind, kindLabel: FACTORY_WIP_KIND_LABEL_TH[e.kind], actorName: e.actorName, note: e.note, pieces: 0, cells: 0, products: [] };
    b.pieces += e.qtyChange;
    b.cells += 1;
    if (!b.products.includes(name)) b.products.push(name);
    map.set(e.batchId, b);
  }
  return [...map.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// แถวสำหรับ Excel: หนึ่งแถวต่อสี/ไซซ์
export function wipSheetRows(state: AppState, matrices: WipMatrix[]): (string | number)[][] {
  const rows: (string | number)[][] = [["แบรนด์", "รุ่น", "สี", "ไซซ์", "SKU", "ยังไม่เย็บ (ชิ้น)"]];
  for (const m of matrices) {
    const brand = m.brandId ? (state.brands[m.brandId]?.name ?? "") : "";
    const variants = Object.values(state.variants).filter((v) => v.productId === m.productId);
    for (const c of m.colors) {
      for (const size of m.sizes) {
        const v = variants.find((x) => x.color === c.color && x.size === size);
        const qty = c.cells[size];
        if (qty === undefined) continue;
        rows.push([brand, m.name, c.color, size, v?.sku ?? "", qty]);
      }
    }
  }
  return rows;
}

// รายการบันทึกทีละสี/ไซซ์ สำหรับหน้า "ประวัติโรงงาน BC" (ใหม่ไปเก่า) ตัวกรอง: ประเภท ช่วงวันที่ (ตามวันที่ที่ระบุตอนบันทึก) ค้นหารุ่น/สี/ไซซ์/SKU/หมายเหตุ/ผู้บันทึก
export interface WipEntryRow {
  id: string;
  batchId: string;
  date: string;
  createdAt: string;
  kind: FactoryWipKind;
  kindLabel: string;
  productName: string;
  color: string;
  size: string;
  sku: string;
  qtyChange: number;
  actorName: string;
  note: string;
}

export function wipEntryRows(state: AppState, filter: { kind?: FactoryWipKind | ""; from?: number; to?: number; search?: string } = {}): WipEntryRow[] {
  const q = (filter.search ?? "").trim().toLowerCase();
  const rows: WipEntryRow[] = [];
  for (const e of Object.values(state.factoryWipEntries ?? {})) {
    if (filter.kind && e.kind !== filter.kind) continue;
    const t = new Date(e.date).getTime();
    if (filter.from !== undefined && t < filter.from) continue;
    if (filter.to !== undefined && t > filter.to) continue;
    const v = state.variants[e.variantId];
    const row: WipEntryRow = {
      id: e.id,
      batchId: e.batchId,
      date: e.date,
      createdAt: e.createdAt,
      kind: e.kind,
      kindLabel: FACTORY_WIP_KIND_LABEL_TH[e.kind],
      productName: (v ? state.products[v.productId]?.sellingName : undefined) ?? "ไม่ทราบรุ่น",
      color: v?.color ?? "",
      size: v?.size ?? "",
      sku: v?.sku ?? "",
      qtyChange: e.qtyChange,
      actorName: e.actorName,
      note: e.note ?? "",
    };
    if (q && ![row.productName, row.color, row.size, row.sku, row.note, row.actorName].some((x) => x.toLowerCase().includes(q))) continue;
    rows.push(row);
  }
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.productName.localeCompare(b.productName, "th"));
}

export function wipHistorySheetRows(rows: WipEntryRow[]): (string | number)[][] {
  return [["วันที่", "ประเภท", "รุ่น", "สี", "ไซซ์", "SKU", "จำนวน", "ผู้บันทึก", "หมายเหตุ"], ...rows.map((r) => [r.date.slice(0, 10), r.kindLabel, r.productName, r.color, r.size, r.sku, r.qtyChange, r.actorName, r.note])];
}
