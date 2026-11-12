import type { AppState } from "@/lib/store/state";
import { modelOfDescription, type BranchMonthPnL, type SosImportRow } from "./sosAnalysis";
import { parseSosDescription } from "./sosMapping";
import { compareSizes } from "./sizes";
import { compareColors } from "./colorOrder";

// ตัวช่วยของหน้า SOS: เลือกช่วงเวลา/สาขา จัดอันดับยอดขาย (ลงถึงสี/ไซซ์) สรุปรายสาขา และอัตราขายต่อสต็อก

// ---------- ช่วงเวลา ----------
export type PeriodMode = "latest" | "last2" | string; // string = YYYY-MM-DD วันเริ่มของงวดที่เลือก

export function periodsOf(imports: SosImportRow[]): string[] {
  return [...new Set(imports.map((i) => i.period_start))].sort().reverse();
}

export function selectedPeriods(imports: SosImportRow[], mode: PeriodMode): string[] {
  const ps = periodsOf(imports);
  if (mode === "latest") return ps.slice(0, 1);
  if (mode === "last2") return ps.slice(0, 2);
  return ps.includes(mode) ? [mode] : ps.slice(0, 1);
}

export function selectImports(imports: SosImportRow[], branchId: string, mode: PeriodMode): SosImportRow[] {
  const ps = new Set(selectedPeriods(imports, mode));
  return imports.filter((i) => ps.has(i.period_start) && (!branchId || i.branch_id === branchId));
}

// ---------- อธิบายรายการของ SOS ----------
export interface LineInfo {
  model: string;
  color: string;
  size: string;
  label: string; // สี / ไซซ์
  key: string;
}
export interface LineLike {
  variant_id: string | null;
  description: string;
  sos_code: string;
}

// ถ้าจับคู่กับสินค้าเราได้ ใช้ชื่อรุ่น/สี/ไซซ์ของเรา ไม่งั้นอ่านจากคำอธิบายของ SOS
export function describeLine(state: AppState, l: LineLike): LineInfo {
  const v = l.variant_id ? state.variants[l.variant_id] : undefined;
  const p = v ? state.products[v.productId] : undefined;
  if (v && p) return { model: p.sellingName, color: v.color, size: v.size, label: `${v.color} / ${v.size}`, key: l.sos_code };
  const parsed = parseSosDescription(l.description);
  const model = modelOfDescription(l.description);
  const color = parsed.colorTh ?? parsed.colorEn ?? "";
  const size = parsed.size ?? "";
  const label = color || size ? `${color || "-"} / ${size || "-"}` : l.description.replace(model, "").trim() || l.description;
  return { model, color, size, label, key: l.sos_code };
}

// ---------- จัดอันดับยอดขาย ----------
export interface SaleLine extends LineLike {
  branch_id: string;
  qty: number;
  net: number | null;
}
export interface SkuRank {
  key: string;
  label: string;
  color: string;
  size: string;
  qty: number;
  net: number;
  byBranch: Record<string, number>;
}
export interface ModelRank {
  rank: number;
  model: string;
  qty: number;
  net: number;
  sharePct: number;
  byBranch: Record<string, number>;
  skus: SkuRank[];
}

export function rankModels(state: AppState, lines: SaleLine[]): ModelRank[] {
  interface Acc {
    qty: number;
    net: number;
    byBranch: Record<string, number>;
    skus: Map<string, SkuRank>;
  }
  const models = new Map<string, Acc>();
  for (const l of lines) {
    if (l.qty <= 0) continue;
    const info = describeLine(state, l);
    const m: Acc = models.get(info.model) ?? { qty: 0, net: 0, byBranch: {}, skus: new Map<string, SkuRank>() };
    m.qty += l.qty;
    m.net += Number(l.net ?? 0);
    m.byBranch[l.branch_id] = (m.byBranch[l.branch_id] ?? 0) + l.qty;
    const sku = m.skus.get(info.key) ?? { key: info.key, label: info.label, color: info.color, size: info.size, qty: 0, net: 0, byBranch: {} };
    sku.qty += l.qty;
    sku.net += Number(l.net ?? 0);
    sku.byBranch[l.branch_id] = (sku.byBranch[l.branch_id] ?? 0) + l.qty;
    m.skus.set(info.key, sku);
    models.set(info.model, m);
  }
  const total = [...models.values()].reduce((s, m) => s + m.qty, 0);
  const list = [...models.entries()].map(([model, m]) => ({
    model,
    qty: m.qty,
    net: m.net,
    byBranch: m.byBranch,
    skus: [...m.skus.values()].sort((a, b) => b.qty - a.qty || b.net - a.net || a.color.localeCompare(b.color, "th") || compareSizes(a.size, b.size)),
  }));
  list.sort((a, b) => b.qty - a.qty || b.net - a.net || a.model.localeCompare(b.model, "th"));
  return list.map((m, i) => ({ ...m, rank: i + 1, sharePct: total > 0 ? Math.round((m.qty / total) * 1000) / 10 : 0 }));
}

// สต็อกล่าสุดของแต่ละสาขาที่เลือก: ใช้ไฟล์งวดล่าสุดของสาขานั้นในช่วงที่เลือก
export function latestImportPerBranch(imports: SosImportRow[]): SosImportRow[] {
  const byBranch = new Map<string, SosImportRow>();
  for (const i of imports) {
    const cur = byBranch.get(i.branch_id);
    if (!cur || i.period_start > cur.period_start) byBranch.set(i.branch_id, i);
  }
  return [...byBranch.values()];
}

// ---------- ขายแล้ว เทียบกับของที่มี (รายรุ่น) ----------
export interface SellThrough {
  model: string;
  sold: number;
  stock: number;
  status: "stuck" | "low" | "ok";
  note: string;
}
// ค้าง = มีของตั้งแต่ 5 ชิ้นแต่ไม่ขายเลย / ใกล้หมด = ขายได้ แต่ของเหลือน้อยกว่าที่ขายในช่วงที่ดู / ปกติ
export function sellThrough(state: AppState, sales: SaleLine[], stock: SaleLine[]): SellThrough[] {
  const sold = new Map<string, number>();
  for (const l of sales) if (l.qty > 0) sold.set(describeLine(state, l).model, (sold.get(describeLine(state, l).model) ?? 0) + l.qty);
  const have = new Map<string, number>();
  for (const l of stock) if (l.qty > 0) have.set(describeLine(state, l).model, (have.get(describeLine(state, l).model) ?? 0) + l.qty);
  const models = new Set([...sold.keys(), ...have.keys()]);
  const out: SellThrough[] = [];
  for (const model of models) {
    const s = sold.get(model) ?? 0;
    const h = have.get(model) ?? 0;
    let status: SellThrough["status"] = "ok";
    let note = "";
    if (s === 0 && h >= 5) {
      status = "stuck";
      note = `มีของ ${h} ชิ้น แต่ไม่ขายเลยในช่วงที่ดู`;
    } else if (s > 0 && h < s) {
      status = "low";
      note = `ขายได้ ${s} ชิ้น แต่ของเหลือ ${h} ชิ้น`;
    }
    out.push({ model, sold: s, stock: h, status, note });
  }
  return out.sort((a, b) => b.stock - a.stock || b.sold - a.sold || a.model.localeCompare(b.model, "th"));
}

// ---------- สรุปรายสาขา (รวมหลายเดือน) ----------
export interface BranchTotals {
  branchId: string;
  branchName: string;
  months: number;
  pieces: number;
  salesTotal: number;
  gp: number;
  otherFees: number;
  received: number;
  cogs: number;
  profitBeforeRent: number;
  rentPerMonth: number | null;
  rentTotal: number | null; // ค่าเช่าต่อเดือน x จำนวนเดือนที่รวม
  netProfit: number | null;
  creditQty: number;
  creditNet: number;
}

export function branchTotals(rows: BranchMonthPnL[]): BranchTotals[] {
  const map = new Map<string, BranchTotals>();
  for (const r of rows) {
    const t = map.get(r.branchId) ?? {
      branchId: r.branchId,
      branchName: r.branchName,
      months: 0,
      pieces: 0,
      salesTotal: 0,
      gp: 0,
      otherFees: 0,
      received: 0,
      cogs: 0,
      profitBeforeRent: 0,
      rentPerMonth: r.rent,
      rentTotal: null,
      netProfit: null,
      creditQty: 0,
      creditNet: 0,
    };
    t.months += 1;
    t.pieces += r.pieces;
    t.salesTotal += r.salesTotal;
    t.gp += r.gp;
    t.otherFees += r.otherFees;
    t.received += r.received;
    t.cogs += r.cogs;
    t.profitBeforeRent += r.profitBeforeRent;
    t.creditQty += r.creditQty;
    t.creditNet += r.creditNet;
    map.set(r.branchId, t);
  }
  const out = [...map.values()].map((t) => {
    const rentTotal = t.rentPerMonth === null ? null : t.rentPerMonth * t.months;
    return { ...t, rentTotal, netProfit: rentTotal === null ? null : t.profitBeforeRent - rentTotal };
  });
  // เรียงจากกำไร (หลังค่าเช่าถ้ามี ไม่งั้นก่อนค่าเช่า) มากไปน้อย
  return out.sort((a, b) => (b.netProfit ?? b.profitBeforeRent) - (a.netProfit ?? a.profitBeforeRent) || a.branchName.localeCompare(b.branchName));
}

// ---------- ตารางสี x ไซซ์ของรุ่นหนึ่ง (จากรายการ SKU ที่ขาย) ----------
export interface SkuMatrix {
  sizes: string[];
  rows: { color: string; cells: Record<string, number>; total: number }[];
  sizeTotals: Record<string, number>;
  other: SkuRank[]; // อ่านสีหรือไซซ์ไม่ได้ (ไม่เข้าตาราง)
  max: number;
}

// สีเรียงตามลำดับสีที่ตั้งไว้ (ลำดับของรุ่นก่อน แล้วลำดับมาตรฐาน) ไซซ์เรียง S ถึง 9XL
export function skuMatrix(skus: SkuRank[], product?: { colorOrder?: string[] } | null): SkuMatrix {
  const sizes = [...new Set(skus.filter((s) => s.color && s.size).map((s) => s.size))].sort(compareSizes);
  const byColor = new Map<string, Record<string, number>>();
  const other: SkuRank[] = [];
  const sizeTotals: Record<string, number> = {};
  let max = 0;
  for (const s of skus) {
    if (!s.color || !s.size) {
      other.push(s);
      continue;
    }
    const cells = byColor.get(s.color) ?? {};
    cells[s.size] = (cells[s.size] ?? 0) + s.qty;
    byColor.set(s.color, cells);
    sizeTotals[s.size] = (sizeTotals[s.size] ?? 0) + s.qty;
    max = Math.max(max, cells[s.size]);
  }
  const rows = [...byColor.entries()]
    .map(([color, cells]) => ({ color, cells, total: Object.values(cells).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => compareColors(a.color, b.color, product));
  return { sizes, rows, sizeTotals, other, max };
}
