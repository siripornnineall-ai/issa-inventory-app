import { parseSosDescription, sosCostPerPiece } from "./sosMapping";

// วิเคราะห์ข้อมูลสาขา SOS: กำไร/ขาดทุนรายสาขารายเดือน และข้อเสนอแนะ SKU (กฎที่อ่านตรวจสอบได้ ยึดยอดขายจริงเป็นหลัก feedback เป็นข้อมูลประกอบ)

export interface SosBranch {
  id: string;
  name: string;
  rent_monthly: number | null;
}
export interface SosImportRow {
  id: string;
  branch_id: string;
  period_start: string;
  period_end: string;
  stock_as_of: string | null;
  file_name: string | null;
}
export interface SosSummaryRow {
  import_id: string;
  sales_total: number | null;
  gp: number | null;
  other_fees: number | null;
  received_ex_vat: number | null;
  main_qty: number;
  main_net: number;
  credit_qty: number;
  credit_net: number;
  main_cogs: number | null;
}

export interface BranchMonthPnL {
  importId: string;
  branchId: string;
  branchName: string;
  periodStart: string;
  periodEnd: string;
  pieces: number;
  salesTotal: number;
  gp: number;
  gpPct: number | null;
  otherFees: number;
  received: number; // ยอดที่เราได้รับจริงก่อนหักภาษี ณ ที่จ่าย (Ex.Vat)
  cogs: number;
  profitBeforeRent: number;
  rent: number | null;
  netProfit: number | null; // null = ยังไม่ได้กรอกค่าเช่า
  creditQty: number;
  creditNet: number;
}

export function buildPnL(branches: SosBranch[], imports: SosImportRow[], summaries: SosSummaryRow[]): BranchMonthPnL[] {
  const byBranch = new Map(branches.map((b) => [b.id, b]));
  const sumByImport = new Map(summaries.map((s) => [s.import_id, s]));
  const out: BranchMonthPnL[] = [];
  for (const imp of imports) {
    const b = byBranch.get(imp.branch_id);
    const s = sumByImport.get(imp.id);
    if (!b || !s) continue;
    const received = Number(s.received_ex_vat ?? 0);
    const cogs = Number(s.main_cogs ?? s.main_qty * 200);
    const rent = b.rent_monthly === null || b.rent_monthly === undefined ? null : Number(b.rent_monthly);
    const profitBeforeRent = received - cogs;
    const salesTotal = Number(s.sales_total ?? 0);
    out.push({
      importId: imp.id,
      branchId: b.id,
      branchName: b.name,
      periodStart: imp.period_start,
      periodEnd: imp.period_end,
      pieces: s.main_qty,
      salesTotal,
      gp: Number(s.gp ?? 0),
      gpPct: salesTotal > 0 ? Math.round((Number(s.gp ?? 0) / salesTotal) * 1000) / 10 : null,
      otherFees: Number(s.other_fees ?? 0),
      received,
      cogs,
      profitBeforeRent,
      rent,
      netProfit: rent === null ? null : profitBeforeRent - rent,
      creditQty: s.credit_qty,
      creditNet: Number(s.credit_net),
    });
  }
  return out.sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.branchName.localeCompare(b.branchName));
}

// ---------- ข้อเสนอแนะ SKU ----------
export interface AdviceSale {
  code: string;
  description: string;
  qty: number;
}
export interface AdviceStock {
  code: string;
  description: string;
  qty: number;
}
export interface AdviceFeedback {
  kind: "good" | "bad" | "request" | "other";
  note: string;
  sos_code?: string | null;
  product_name?: string | null;
}

export interface AdviceItem {
  code: string;
  description: string;
  qty: number; // จำนวนที่แนะนำ เพิ่ม (add/new) หรือ จำนวนที่มีอยู่ที่ควรถอน (remove)
  reason: string;
  notes: string[]; // feedback ทีมขายที่เกี่ยวข้อง (ประกอบเท่านั้น)
  caution?: string;
}
export interface BranchAdvice {
  restock: AdviceItem[]; // ขายแล้วของหมด ควรเติม
  addNew: AdviceItem[]; // ขายดีที่สาขาอื่น ยังไม่มีที่สาขานี้
  remove: AdviceItem[]; // มีของแต่ไม่ขายเลยในช่วงที่ดู ควรถอน
  skippedOverCapacity: AdviceItem[];
  capacity: number;
  addPieces: number;
  removePieces: number;
}

const sumBy = <T,>(list: T[], key: (t: T) => string, val: (t: T) => number) => {
  const m = new Map<string, number>();
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + val(x));
  return m;
};

function relatedNotes(fb: AdviceFeedback[], code: string, description: string): AdviceFeedback[] {
  const d = description.toLowerCase();
  return fb.filter((f) => (f.sos_code && f.sos_code === code) || (f.product_name && f.product_name.trim() && d.includes(f.product_name.trim().toLowerCase())));
}

// sales/stock: ของสาขานี้ (ยอดขายในช่วงที่ดู และสต็อกล่าสุด) otherBranchSales: ยอดขายของสาขาอื่นในช่วงเดียวกัน
// capacity: จำนวนชิ้นที่สาขาเพิ่มได้สุทธิ (ถอนของออกแล้วเพิ่มได้อีกเท่าที่ถอน) ค่าตั้งต้น 20
export function buildAdvice(input: { sales: AdviceSale[]; stock: AdviceStock[]; otherBranchSales: AdviceSale[]; feedback: AdviceFeedback[]; capacity?: number }): BranchAdvice {
  const capacity = input.capacity ?? 20;
  const sold = sumBy(input.sales, (s) => s.code, (s) => s.qty);
  const inStock = sumBy(input.stock, (s) => s.code, (s) => Math.max(0, s.qty));
  const otherSold = sumBy(input.otherBranchSales, (s) => s.code, (s) => s.qty);
  const desc = new Map<string, string>();
  for (const x of [...input.stock, ...input.sales, ...input.otherBranchSales]) if (!desc.has(x.code)) desc.set(x.code, x.description);
  const isProduct = (code: string) => sosCostPerPiece(desc.get(code) ?? "") > 0;

  const mk = (code: string, qty: number, reason: string): AdviceItem => {
    const d = desc.get(code) ?? code;
    const notes = relatedNotes(input.feedback, code, d);
    const item: AdviceItem = { code, description: d, qty, reason, notes: notes.map((n) => n.note) };
    return item;
  };

  // ควรถอน: มีของ แต่ไม่ขายเลยที่สาขานี้ ถ้าทีมขายบอกว่าขายดี/มีคนถามหา ให้ตรวจก่อน (ยอดขายจริงยังเป็นหลัก)
  const remove: AdviceItem[] = [];
  for (const [code, qty] of inStock) {
    if (qty <= 0 || (sold.get(code) ?? 0) > 0 || !isProduct(code)) continue;
    const item = mk(code, qty, `มีของ ${qty} ชิ้น แต่ไม่ขายเลยในช่วงที่ดู`);
    const good = relatedNotes(input.feedback, code, item.description).some((f) => f.kind === "good" || f.kind === "request");
    if (good) item.caution = "ทีมขายแจ้งว่าขายดีหรือมีลูกค้าถามหา ลองตรวจก่อนถอน";
    remove.push(item);
  }
  remove.sort((a, b) => b.qty - a.qty || a.description.localeCompare(b.description));

  // ควรเติม: ขายได้ แต่ตอนนี้ของหมด
  const restockAll: AdviceItem[] = [];
  for (const [code, q] of sold) {
    if (q <= 0 || (inStock.get(code) ?? 0) > 0 || !isProduct(code)) continue;
    restockAll.push(mk(code, Math.min(Math.max(q, 1), 3), `ขายได้ ${q} ชิ้นในช่วงที่ดู แต่ตอนนี้ของหมด`));
  }
  restockAll.sort((a, b) => (sold.get(b.code) ?? 0) - (sold.get(a.code) ?? 0) || a.description.localeCompare(b.description));

  // ควรเพิ่มรายการใหม่: ขายดีที่สาขาอื่น (อย่างน้อย 2 ชิ้น) แต่สาขานี้ไม่มีของและไม่เคยขายในช่วงที่ดู
  const newAll: AdviceItem[] = [];
  for (const [code, q] of otherSold) {
    if (q < 2 || (inStock.get(code) ?? 0) > 0 || (sold.get(code) ?? 0) > 0 || !isProduct(code)) continue;
    newAll.push(mk(code, 1, `ขายได้ ${q} ชิ้นที่สาขาอื่นในช่วงเดียวกัน แต่สาขานี้ยังไม่มี`));
  }
  newAll.sort((a, b) => (otherSold.get(b.code) ?? 0) - (otherSold.get(a.code) ?? 0) || a.description.localeCompare(b.description));

  // เติมได้ไม่เกินโควตา (+capacity) บวกกับจำนวนที่ถอนออกไป: ถอนทั้งหมดที่แนะนำ แล้วจัดลำดับเติมก่อนเพิ่มรายการใหม่
  const removePieces = remove.reduce((s, r) => s + r.qty, 0);
  let budget = capacity + removePieces;
  const restock: AdviceItem[] = [];
  const addNew: AdviceItem[] = [];
  const skipped: AdviceItem[] = [];
  for (const [list, target] of [[restockAll, restock], [newAll, addNew]] as const) {
    for (const item of list) {
      if (item.qty <= budget) {
        target.push(item);
        budget -= item.qty;
      } else {
        skipped.push(item);
      }
    }
  }
  return { restock, addNew, remove, skippedOverCapacity: skipped, capacity, addPieces: [...restock, ...addNew].reduce((s, r) => s + r.qty, 0), removePieces };
}

// ---------- สต็อกเป็นตารางสี x ไซซ์ (ฝั่งรายการของ SOS) ----------
export interface SosMatrix {
  model: string;
  total: number;
  sizes: string[];
  colors: { color: string; total: number; cells: Record<string, number> }[];
}
export function modelOfDescription(description: string): string {
  // ชื่อรุ่น = คำก่อนข้อความภาษาไทยตัวแรก (SOS ใส่ลักษณะขาตามหลังชื่อรุ่น) ถ้าขึ้นต้นด้วยภาษาไทยใช้สองคำแรก
  const words = description.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  for (const w of words) {
    if (/[ก-๙]/.test(w)) break;
    out.push(w);
  }
  return (out.length ? out : words.slice(0, 2)).join(" ");
}

export function stockMatrices(stock: AdviceStock[], sizeCompare: (a: string, b: string) => number): { matrices: SosMatrix[]; other: AdviceStock[] } {
  const byModel = new Map<string, Map<string, Record<string, number>>>();
  const other: AdviceStock[] = [];
  for (const s of stock) {
    const p = parseSosDescription(s.description);
    if (!p.colorTh || !p.size) {
      other.push(s);
      continue;
    }
    const model = modelOfDescription(s.description);
    const colors = byModel.get(model) ?? new Map<string, Record<string, number>>();
    const cells = colors.get(p.colorTh) ?? {};
    cells[p.size] = (cells[p.size] ?? 0) + s.qty;
    colors.set(p.colorTh, cells);
    byModel.set(model, colors);
  }
  const matrices: SosMatrix[] = [...byModel.entries()].map(([model, colors]) => {
    const sizes = [...new Set([...colors.values()].flatMap((c) => Object.keys(c)))].sort(sizeCompare);
    const rows = [...colors.entries()].map(([color, cells]) => ({ color, cells, total: Object.values(cells).reduce((a, b) => a + b, 0) }));
    rows.sort((a, b) => b.total - a.total || a.color.localeCompare(b.color, "th"));
    return { model, sizes, colors: rows, total: rows.reduce((s, r) => s + r.total, 0) };
  });
  matrices.sort((a, b) => b.total - a.total || a.model.localeCompare(b.model));
  return { matrices, other };
}
