import { createClient } from "./client";
import { useStore } from "@/lib/store";
import { newId } from "@/lib/utils/ids";

// สมุดบันทึกการสแกน QR: บันทึกทุกครั้งที่ยิง (ผ่าน / ซ้ำ / ถูกปฏิเสธ) ตั้งแต่ตอนยิง แล้วเติมเลขที่ใบเมื่อกดบันทึกใบสำเร็จ
// เป็นข้อมูลตรวจสอบอย่างเดียว: ทำเบื้องหลังแบบ "พยายามส่ง" ถ้าส่งไม่สำเร็จ (เน็ตหลุด / ตารางยังไม่พร้อม) จะไม่ขวางการสแกนหรือการบันทึกใบ
// และไม่แตะสต็อกหรือป้ายเลย ไม่เก็บเข้า state ของแอป (ข้อมูลโตทุกวัน หน้าประวัติดึงเองตามช่วงวันที่)

export type ScanAction = "in" | "out";
export type ScanOutcome = "ok" | "duplicate" | "rejected";
export type ScanPage = "stock_in" | "stock_out" | "stock_return";

export const SCAN_PAGE_LABEL_TH: Record<ScanPage, string> = { stock_in: "รับเข้า", stock_out: "เบิกออก", stock_return: "รับคืน" };

function currentActor(): { id: string; name: string } | null {
  const s = useStore.getState();
  const u = s.currentUserId ? s.users[s.currentUserId] : undefined;
  return u ? { id: u.id, name: u.name } : null;
}

export function logTokenScan(input: { token: { id: string; code?: string | null }; variantId?: string; action: ScanAction; page: ScanPage; outcome: ScanOutcome; reason?: string }): void {
  try {
    const actor = currentActor();
    if (!actor) return;
    const supabase = createClient();
    const result = supabase.from("scan_log").insert({
      id: newId(),
      scanned_at: new Date().toISOString(),
      token_id: input.token.id,
      token_code: input.token.code ?? null,
      variant_id: input.variantId ?? null,
      action: input.action,
      page: input.page,
      outcome: input.outcome,
      reason: input.reason ?? null,
      actor_id: actor.id,
      actor_name: actor.name,
    });
    void Promise.resolve(result).then(
      (res: { error?: unknown } | undefined) => {
        if (res?.error) console.warn("บันทึกประวัติการสแกนไม่สำเร็จ", res.error);
      },
      (e: unknown) => console.warn("บันทึกประวัติการสแกนไม่สำเร็จ", e)
    );
  } catch (e) {
    console.warn("บันทึกประวัติการสแกนไม่สำเร็จ", e);
  }
}

// กดบันทึกใบสำเร็จ: เติมเลขที่ใบให้การสแกน (ที่ผ่าน) ของป้ายเหล่านี้ที่ผู้ใช้คนนี้ยิงไว้และยังว่าง (ย้อนหลังไม่เกิน 48 ชั่วโมง กันปนกับรอบเก่า)
export function markScansSaved(tokenIds: string[], docNo: string, action: ScanAction): void {
  if (tokenIds.length === 0) return;
  try {
    const actor = currentActor();
    if (!actor) return;
    const supabase = createClient();
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const result = supabase
      .from("scan_log")
      .update({ saved_doc_no: docNo })
      .in("token_id", tokenIds)
      .eq("actor_id", actor.id)
      .eq("action", action)
      .eq("outcome", "ok")
      .is("saved_doc_no", null)
      .gte("scanned_at", since);
    void Promise.resolve(result).then(
      (res: { error?: unknown } | undefined) => {
        if (res?.error) console.warn("เติมเลขที่ใบให้ประวัติการสแกนไม่สำเร็จ", res.error);
      },
      (e: unknown) => console.warn("เติมเลขที่ใบให้ประวัติการสแกนไม่สำเร็จ", e)
    );
  } catch (e) {
    console.warn("เติมเลขที่ใบให้ประวัติการสแกนไม่สำเร็จ", e);
  }
}

// ยกเลิกออเดอร์แบบคืนสต็อก: ล้างสถานะ "ออกแล้ว" ของป้ายรายชิ้นที่สแกนออกไว้ในใบเบิกของออเดอร์นั้น เพื่อให้สแกนออกใหม่ได้ทันที (ไม่ต้องรอ 3 ชั่วโมงตามตัวกันสแกนซ้ำ)
// หาป้ายจากสมุดบันทึกการสแกน (saved_doc_no = เลขที่ใบเบิก) ล้างเฉพาะป้ายที่สถานะล่าสุดยังเป็น "ออก" และไม่ได้ถูกสแกนต่อหลังใบนั้น (last_action_at ไม่เกิน notAfterIso)
// ทำแบบ "พยายามทำ" ไม่ขวางการยกเลิก ไม่ throw: ถ้าผู้ใช้ไม่มีสิทธิ์อ่านสมุดสแกน (view.history) หรือเน็ตหลุด จะไม่ล้างอะไร (ป้ายค้างสถานะเดิม สแกนออกใหม่ได้หลังครบ 3 ชั่วโมงหรือเลือกสินค้าเอง)
// คืนจำนวนป้ายที่ล้างได้ ไม่แตะสต็อก
export async function releaseScannedTokens(input: { docNo: string | undefined; notAfterIso: string }): Promise<number> {
  if (!input.docNo) return 0;
  try {
    const supabase = createClient();
    const logs = await supabase.from("scan_log").select("token_id").eq("saved_doc_no", input.docNo).eq("action", "out").eq("outcome", "ok");
    if (logs.error || !Array.isArray(logs.data)) return 0;
    const ids = [...new Set((logs.data as { token_id: string | null }[]).map((r) => r.token_id).filter((x): x is string => Boolean(x)))];
    if (ids.length === 0) return 0;
    const upd = await supabase
      .from("unit_tokens")
      .update({ last_action: null, last_action_at: null })
      .in("id", ids)
      .eq("last_action", "out")
      .lte("last_action_at", input.notAfterIso)
      .select("id");
    if (upd.error || !Array.isArray(upd.data)) return 0;
    const cleared = (upd.data as { id: string }[]).map((r) => r.id);
    // ให้ state ในเครื่องตรงกับฐานข้อมูลทันที (ไม่ผ่าน sync เพราะฐานข้อมูลถูกเขียนแล้ว)
    const store = useStore.getState();
    const local = cleared.map((id) => store.unitTokens[id]).filter(Boolean).map((t) => ({ ...t, lastAction: undefined, lastActionAt: undefined }));
    if (local.length > 0) store.actions.mergeUnitTokens(local);
    return cleared.length;
  } catch (e) {
    console.warn("ล้างสถานะป้ายหลังยกเลิกออเดอร์ไม่สำเร็จ", e);
    return 0;
  }
}
