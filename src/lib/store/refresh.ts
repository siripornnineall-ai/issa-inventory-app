import { createClient } from "@/lib/supabase/client";
import { fetchAppState } from "@/lib/supabase/fetch";
import { useStore, pendingSyncCount } from "./index";
import { countStateRows, currentSlowest, recordLoadStats } from "./loadStats";

export type RefreshResult = "ok" | "busy" | "no-session" | "error";

let inFlight: Promise<RefreshResult> | null = null;
let lastRefreshAt = Date.now();

// ดึงข้อมูลล่าสุดจากฐานข้อมูลมาแทนข้อมูลในเครื่อง โดยไม่ต้องโหลดหน้าใหม่ (รายการที่สแกนค้างไว้ในหน้ารับเข้า/เบิกออกไม่หาย)
// ไม่ทำถ้ายังมีรายการที่บันทึกลงฐานข้อมูลไม่เสร็จ ไม่งั้นข้อมูลเก่าจากฐานข้อมูลจะทับสิ่งที่เพิ่งทำและยังส่งไม่ถึง
export function refreshAppData(): Promise<RefreshResult> {
  if (pendingSyncCount() > 0) return Promise.resolve("busy");
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<RefreshResult> => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return "no-session";
      const startedAt = performance.now();
      const state = await fetchAppState(supabase);
      recordLoadStats({ kind: "รีเฟรช", fetchMs: Math.round(performance.now() - startedAt), rows: countStateRows(state), at: Date.now(), slowest: currentSlowest() });
      // ระหว่างที่ดึงข้อมูล ผู้ใช้อาจทำรายการใหม่ ถ้ามีรายการค้างส่งตอนนี้ อย่าเอาข้อมูลที่ดึงมาทับ
      if (pendingSyncCount() > 0) return "busy";
      state.currentUserId = state.users[session.user.id] ? session.user.id : null;
      useStore.getState().actions.hydrate(state);
      lastRefreshAt = Date.now();
      return "ok";
    } catch (e) {
      console.error("รีเฟรชข้อมูลไม่สำเร็จ", e);
      return "error";
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function msSinceLastRefresh(): number {
  return Date.now() - lastRefreshAt;
}

export function markRefreshed() {
  lastRefreshAt = Date.now();
}
