"use client";

import { useEffect, useState } from "react";
import { useStore } from "./index";
import { createClient } from "@/lib/supabase/client";
import { fetchAppState, type LoadProgress } from "@/lib/supabase/fetch";
import { markRefreshed, msSinceLastRefresh, refreshAppData } from "./refresh";
import { countStateRows, currentSlowest, recordLoadStats } from "./loadStats";

const AUTO_REFRESH_AFTER_MS = 2 * 60 * 1000;

export function AppHydration({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  // ความคืบหน้าตอนโหลด (โชว์บนหน้าจอหมุน): ถ้าค้างนานจะรู้ว่ารอตารางไหนอยู่ ใช้แคปหน้าจอส่งมาตรวจได้
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (ready) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [ready]);

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
        const startedAt = performance.now();
        const state = await fetchAppState(supabase, (p) => {
          if (!cancelled) setProgress(p);
        });
        recordLoadStats({ kind: "เปิดแอป", fetchMs: Math.round(performance.now() - startedAt), rows: countStateRows(state), at: Date.now(), slowest: currentSlowest() });
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
          {elapsed >= 2 && (
            <p className="max-w-xs text-center text-xs">
              ผ่านไป {elapsed} วินาที{progress && ` · โหลดข้อมูลแล้ว ${progress.done}/${progress.total}`}
              {progress && progress.pending.length > 0 && elapsed >= 4 && <span className="mt-1 block">กำลังรอ: {progress.pending.slice(0, 4).join(", ")}</span>}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
