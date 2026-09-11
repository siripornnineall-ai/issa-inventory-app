"use client";

import { useEffect, useState } from "react";
import { useStore } from "./index";
import { createClient } from "@/lib/supabase/client";
import { fetchAppState } from "@/lib/supabase/fetch";

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
