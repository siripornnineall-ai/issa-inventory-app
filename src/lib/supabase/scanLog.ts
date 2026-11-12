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
