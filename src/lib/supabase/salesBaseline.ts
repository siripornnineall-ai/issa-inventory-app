import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaselineInput, } from "@/lib/utils/productionPlan";
import type { BaselineRow } from "@/lib/utils/salesBaselineImport";

// ยอดขายอ้างอิงรายเดือนสำหรับวางแผนผลิต: อ่าน/เขียนตรง ไม่ผ่าน state ของแอป ไม่แตะสต็อก

export interface BaselineDbRow {
  month: string;
  product_id: string;
  color: string;
  size: string;
  qty: number;
}

// ยอดล่าสุดต่อ (รุ่น, สี, ไซซ์) คือแถวของเดือนใหม่สุดที่มี และคืนรายชื่อเดือนที่เคยนำเข้า
export async function loadBaseline(supabase: SupabaseClient): Promise<{ rows: BaselineInput[]; months: string[] }> {
  const res = await supabase.from("sales_baseline").select("month, product_id, color, size, qty").order("month", { ascending: false }).limit(20000);
  if (res.error) throw new Error(res.error.message);
  const data = (res.data ?? []) as BaselineDbRow[];
  const seen = new Set<string>();
  const rows: BaselineInput[] = [];
  for (const r of data) {
    const key = `${r.product_id}|${r.color}|${r.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ productId: r.product_id, color: r.color, size: r.size, qty: Number(r.qty) });
  }
  return { rows, months: [...new Set(data.map((r) => r.month))] };
}

export async function saveBaseline(supabase: SupabaseClient, rows: BaselineRow[], ctx: { month: string; fileName: string; userId: string; userName: string }): Promise<number> {
  const payload = rows.map((r) => ({
    month: ctx.month,
    product_id: r.productId,
    color: r.color,
    size: r.size,
    qty: r.qty,
    source_file: ctx.fileName,
    imported_by: ctx.userId,
    imported_by_name: ctx.userName,
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const res = await supabase.from("sales_baseline").upsert(payload.slice(i, i + 500), { onConflict: "month,product_id,color,size" });
    if (res.error) throw new Error(res.error.message);
  }
  return payload.length;
}
