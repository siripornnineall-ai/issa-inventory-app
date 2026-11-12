import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "@/lib/store/state";
import type { SosParsed } from "@/lib/utils/sosImport";
import { matchSosVariant, sosCostPerPiece } from "@/lib/utils/sosMapping";
import type { SosBranch, SosImportRow, SosSummaryRow } from "@/lib/utils/sosAnalysis";

// สาขาหน้าร้าน SOS: อ่าน/เขียนฐานข้อมูลโดยตรง (ไม่ผ่าน state ของแอป เพราะข้อมูลโตทุกเดือน ดึงเฉพาะตอนเปิดหน้า SOS)
// ไม่แตะสต็อกคลังหลักเลย

export interface SosFeedbackRow {
  id: string;
  created_at: string;
  branch_id: string | null;
  product_name: string | null;
  sos_code: string | null;
  kind: "good" | "bad" | "request" | "other";
  note: string;
  author_id: string | null;
  author_name: string;
}
export interface SosSalesLineRow {
  id: string;
  import_id: string;
  branch_id: string;
  section: "main" | "credit";
  sos_code: string;
  description: string;
  qty: number;
  net: number | null;
  variant_id: string | null;
}
export interface SosStockLineRow {
  id: string;
  import_id: string;
  branch_id: string;
  as_of: string;
  sos_code: string;
  description: string;
  qty: number;
  variant_id: string | null;
}

export interface SosOverview {
  branches: SosBranch[];
  imports: SosImportRow[];
  summaries: SosSummaryRow[];
  feedback: SosFeedbackRow[];
  codeMap: Record<string, string>;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? ([] as unknown)) as T;
}

export async function loadSosOverview(supabase: SupabaseClient, opts: { finance: boolean }): Promise<SosOverview> {
  const feedback = must<SosFeedbackRow[]>(await supabase.from("sos_feedback").select("*").order("created_at", { ascending: false }).limit(500));
  if (!opts.finance) return { branches: [], imports: [], summaries: [], feedback, codeMap: {} };
  const [branches, imports, summaries, codeMap] = await Promise.all([
    supabase.from("sos_branches").select("*").order("name"),
    supabase.from("sos_imports").select("*").order("period_start", { ascending: false }),
    supabase.from("sos_summaries").select("*"),
    supabase.from("sos_code_map").select("sos_code, variant_id"),
  ]);
  return {
    branches: must<SosBranch[]>(branches),
    imports: must<SosImportRow[]>(imports),
    summaries: must<SosSummaryRow[]>(summaries),
    feedback,
    codeMap: Object.fromEntries(must<{ sos_code: string; variant_id: string }[]>(codeMap).map((r) => [r.sos_code, r.variant_id])),
  };
}

export async function loadSosLines(supabase: SupabaseClient, importIds: string[]): Promise<{ sales: SosSalesLineRow[]; stock: SosStockLineRow[] }> {
  if (importIds.length === 0) return { sales: [], stock: [] };
  const [sales, stock] = await Promise.all([
    supabase.from("sos_sales_lines").select("id, import_id, branch_id, section, sos_code, description, qty, net, variant_id").in("import_id", importIds).limit(20000),
    supabase.from("sos_stock_lines").select("id, import_id, branch_id, as_of, sos_code, description, qty, variant_id").in("import_id", importIds).limit(20000),
  ]);
  return { sales: must<SosSalesLineRow[]>(sales), stock: must<SosStockLineRow[]>(stock) };
}

export async function setBranchRent(supabase: SupabaseClient, branchId: string, rent: number | null): Promise<void> {
  const res = await supabase.from("sos_branches").update({ rent_monthly: rent }).eq("id", branchId);
  if (res.error) throw new Error(res.error.message);
}

export async function saveCodeMapping(supabase: SupabaseClient, sosCode: string, variantId: string): Promise<void> {
  const res = await supabase.from("sos_code_map").upsert({ sos_code: sosCode, variant_id: variantId, updated_at: new Date().toISOString() });
  if (res.error) throw new Error(res.error.message);
  // อัปเดตรายการที่นำเข้าไปแล้วให้ใช้การจับคู่ใหม่ด้วย
  const a = await supabase.from("sos_sales_lines").update({ variant_id: variantId }).eq("sos_code", sosCode);
  const b = await supabase.from("sos_stock_lines").update({ variant_id: variantId }).eq("sos_code", sosCode);
  if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
}

export async function addFeedback(supabase: SupabaseClient, input: { branchId: string | null; productName: string; sosCode: string; kind: SosFeedbackRow["kind"]; note: string; authorId: string; authorName: string }): Promise<void> {
  const res = await supabase.from("sos_feedback").insert({
    branch_id: input.branchId,
    product_name: input.productName.trim() || null,
    sos_code: input.sosCode.trim() || null,
    kind: input.kind,
    note: input.note.trim(),
    author_id: input.authorId,
    author_name: input.authorName,
  });
  if (res.error) throw new Error(res.error.message);
}

export async function deleteFeedback(supabase: SupabaseClient, id: string): Promise<void> {
  const res = await supabase.from("sos_feedback").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

async function insertChunks(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[], size = 400): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const res = await supabase.from(table).insert(rows.slice(i, i + size));
    if (res.error) throw new Error(res.error.message);
  }
}

export interface ImportResult {
  importId: string;
  branchName: string;
  salesLines: number;
  stockLines: number;
  mapped: number;
  unmapped: number;
  replaced: boolean;
}

// นำเข้าไฟล์ SOS หนึ่งไฟล์ (หนึ่งสาขา หนึ่งงวด) ถ้ามีงวดเดียวกันของสาขานั้นอยู่แล้ว ต้องสั่ง replace: true จึงจะลบของเก่าแล้วใส่ใหม่
// ไม่มีทรานแซกชันฝั่งแอป: ถ้าขั้นใดล้ม จะลบรายการนำเข้าที่ค้างครึ่งทางทิ้ง (ลบตามด้วย cascade) แล้วแจ้งข้อผิดพลาด
export async function importSosParsed(
  supabase: SupabaseClient,
  parsed: SosParsed,
  ctx: { state: AppState; fileName: string; userId: string; userName: string; codeMap: Record<string, string>; replace: boolean }
): Promise<ImportResult> {
  const found = must<{ id: string }[]>(await supabase.from("sos_branches").select("id").eq("name", parsed.branchName));
  let branchId = found[0]?.id;
  if (!branchId) {
    const ins = await supabase.from("sos_branches").insert({ name: parsed.branchName }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    branchId = (ins.data as { id: string }).id;
  }

  const existing = must<{ id: string }[]>(await supabase.from("sos_imports").select("id").eq("branch_id", branchId).eq("period_start", parsed.periodStart).eq("period_end", parsed.periodEnd));
  let replaced = false;
  if (existing.length > 0) {
    if (!ctx.replace) throw new Error(`นำเข้างวด ${parsed.periodStart} ถึง ${parsed.periodEnd} ของ ${parsed.branchName} ไปแล้ว`);
    const del = await supabase.from("sos_imports").delete().eq("id", existing[0].id);
    if (del.error) throw new Error(del.error.message);
    replaced = true;
  }

  const variantFor = (code: string, description: string): string | null => ctx.codeMap[code] ?? matchSosVariant(ctx.state, description).variantId;
  const autoMapped: Record<string, string> = {};
  const resolve = (code: string, description: string) => {
    const v = variantFor(code, description);
    if (v && !ctx.codeMap[code]) autoMapped[code] = v;
    return v;
  };

  const main = parsed.sales.filter((l) => l.section === "main");
  const credit = parsed.sales.filter((l) => l.section === "credit");
  const imp = await supabase
    .from("sos_imports")
    .insert({ branch_id: branchId, file_name: ctx.fileName, period_start: parsed.periodStart, period_end: parsed.periodEnd, stock_as_of: parsed.stockAsOf, imported_by: ctx.userId, imported_by_name: ctx.userName })
    .select("id")
    .single();
  if (imp.error) throw new Error(imp.error.message);
  const importId = (imp.data as { id: string }).id;

  try {
    const s = parsed.summary;
    const sum = await supabase.from("sos_summaries").insert({
      import_id: importId,
      sales_total: s.salesTotal,
      gp: s.gp,
      after_gp: s.afterGp,
      other_fees: s.otherFees,
      received: s.received,
      wht: s.wht,
      received_incl_vat: s.receivedInclVat,
      vat: s.vat,
      received_ex_vat: s.receivedExVat,
      main_qty: main.reduce((a, l) => a + l.qty, 0),
      main_net: main.reduce((a, l) => a + l.net, 0),
      credit_qty: credit.reduce((a, l) => a + l.qty, 0),
      credit_net: credit.reduce((a, l) => a + l.net, 0),
      main_cogs: main.reduce((a, l) => a + l.qty * sosCostPerPiece(l.description), 0),
    });
    if (sum.error) throw new Error(sum.error.message);

    let mapped = 0;
    let unmapped = 0;
    const salesRows = parsed.sales.map((l) => {
      const variantId = resolve(l.code, l.description);
      if (variantId) mapped += 1;
      else unmapped += 1;
      return { import_id: importId, branch_id: branchId, section: l.section, sos_code: l.code, description: l.description, qty: l.qty, unit_price: l.unitPrice, gross: l.gross, discount: l.discount, net: l.net, variant_id: variantId };
    });
    await insertChunks(supabase, "sos_sales_lines", salesRows);
    const asOf = parsed.stockAsOf ?? parsed.periodEnd;
    const stockRows = parsed.stock.map((l) => ({ import_id: importId, branch_id: branchId, as_of: asOf, sos_code: l.code, description: l.description, qty: l.qty, variant_id: resolve(l.code, l.description) }));
    await insertChunks(supabase, "sos_stock_lines", stockRows);

    const newMaps = Object.entries(autoMapped).map(([sos_code, variant_id]) => ({ sos_code, variant_id }));
    if (newMaps.length > 0) {
      const up = await supabase.from("sos_code_map").upsert(newMaps, { onConflict: "sos_code", ignoreDuplicates: true });
      if (up.error) throw new Error(up.error.message);
    }
    return { importId, branchName: parsed.branchName, salesLines: salesRows.length, stockLines: stockRows.length, mapped, unmapped, replaced };
  } catch (e) {
    await supabase.from("sos_imports").delete().eq("id", importId);
    throw e;
  }
}
