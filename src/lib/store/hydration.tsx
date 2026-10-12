"use client";

import { useEffect, useState } from "react";
import { useStore } from "./index";
import { createClient } from "@/lib/supabase/client";
import { fetchAppState } from "@/lib/supabase/fetch";
import { markRefreshed, msSinceLastRefresh, refreshAppData } from "./refresh";

const AUTO_REFRESH_AFTER_MS = 2 * 60 * 1000;

export function AppHydration({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const state = await fetchAppState(supabase);
        state.currentUserId = state.users[session.user.id] ? session.user.id : null;
        if (!cancelled) {
          useStore.getState().actions.hydrate(state);
          markRefreshed();
        }
      } catch (e) {
        console.error("โหลดข้อมูลจาก Supabase ไม่สำเร็จ", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // กลับเข้าแอปจากพื้นหลัง (เปิดจอ/สลับกลับมา) หลังผ่านไปนานพอ ดึงข้อมูลล่าสุดให้เองเงียบ ๆ
  // แอปที่ติดตั้งบนมือถือแทบไม่ถูกโหลดใหม่ จึงเห็นข้อมูลเก่าค้างเป็นชั่วโมง/เป็นวัน
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (msSinceLastRefresh() < AUTO_REFRESH_AFTER_MS) return;
      void refreshAppData();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-on-surface-variant)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent" />
          <p className="text-sm">กำลังโหลดระบบ ISSA Apparel...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
