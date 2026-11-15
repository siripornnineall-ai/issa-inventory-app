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

// ยอดขายอ้างอิงทุกเดือนที่เคยนำเข้า (แถวต่อ เดือน-รุ่น-สี-ไซซ์) และรายชื่อเดือน (ใหม่ไปเก่า)
export async function loadBaseline(supabase: SupabaseClient): Promise<{ rows: (BaselineInput & { month: string })[]; months: string[] }> {
  const res = await supabase.from("sales_baseline").select("month, product_id, color, size, qty").order("month", { ascending: false }).limit(20000);
  if (res.error) throw new Error(res.error.message);
  const data = (res.data ?? []) as BaselineDbRow[];
  return {
    rows: data.map((r) => ({ month: r.month.slice(0, 7), productId: r.product_id, color: r.color, size: r.size, qty: Number(r.qty) })),
    months: [...new Set(data.map((r) => r.month.slice(0, 7)))],
  };
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
