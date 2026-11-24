import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOM_LABEL_MAX } from "@/lib/utils/returnReasons";

// เหตุผลที่ลูกค้าคืน / คำที่ลูกค้าพูด ที่ผู้ใช้เพิ่มเอง: อ่านเขียนตรง ไม่ผ่าน state ของแอป (ตารางเล็ก)
export type ReturnOptionKind = "reason" | "tag";
export interface ReturnCustomOption {
  id: string;
  kind: ReturnOptionKind;
  label: string;
}

export async function loadReturnOptions(supabase: SupabaseClient): Promise<ReturnCustomOption[]> {
  const res = await supabase.from("return_custom_options").select("id, kind, label").order("created_at", { ascending: true }).limit(500);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as ReturnCustomOption[];
}

export function cleanLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export async function addReturnOption(supabase: SupabaseClient, kind: ReturnOptionKind, rawLabel: string, user: { id: string; name: string }): Promise<ReturnCustomOption> {
  const label = cleanLabel(rawLabel);
  if (!label) throw new Error("กรุณาพิมพ์ข้อความ");
  if (label.length > CUSTOM_LABEL_MAX) throw new Error(`ยาวเกินไป (ไม่เกิน ${CUSTOM_LABEL_MAX} ตัวอักษร)`);
  const res = await supabase.from("return_custom_options").insert({ kind, label, created_by: user.id, created_by_name: user.name }).select("id, kind, label").single();
  if (res.error) throw new Error(res.error.code === "23505" ? "มีข้อความนี้อยู่แล้ว" : res.error.message);
  return res.data as ReturnCustomOption;
}

export async function removeReturnOption(supabase: SupabaseClient, id: string): Promise<void> {
  const res = await supabase.from("return_custom_options").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}
