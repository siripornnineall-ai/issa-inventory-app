"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pendingSyncCount } from "@/lib/store";

// เครื่องที่เปิดแอปค้างไว้ยังใช้โค้ดเวอร์ชันเก่า (เคยทำให้ใบรับเข้าหายเมื่อเลขที่ชนกัน เพราะเครื่องเก่ายังไม่รู้วิธีออกเลขใหม่)
// ป้ายนี้ถามเซิร์ฟเวอร์เป็นระยะว่าเวอร์ชันล่าสุดคืออะไร ถ้าไม่ตรงกับของเครื่อง ขึ้นป้ายให้กดอัปเดต
// ไม่บังคับโหลดใหม่เอง เพราะบางคนกำลังสแกน/กรอกอยู่ รายการที่ยังไม่ได้ส่งถูกจดไว้ในเครื่องแล้ว โหลดใหม่ไม่ทำให้หาย
export const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const VERSION_SNOOZE_MS = 10 * 60 * 1000;

function myBuildId(): string {
  return process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
}

export async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: unknown };
    return typeof body.id === "string" && body.id.length > 0 ? body.id : null;
  } catch {
    return null; // ออฟไลน์/เซิร์ฟเวอร์ไม่ตอบ: ไม่ถือว่ามีเวอร์ชันใหม่
  }
}

export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (myBuildId() === "dev") return; // เครื่องพัฒนา/ไม่มีเลขเวอร์ชัน: ไม่ตรวจ
    let alive = true;
    const check = () => {
      void fetchLatestBuildId().then((id) => {
        if (!alive || !id) return;
        setLatest(id);
        setNow(Date.now());
      });
    };
    const first = window.setTimeout(check, 3000);
    const timer = window.setInterval(check, VERSION_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);

  const mine = myBuildId();
  if (mine === "dev" || !latest || latest === mine || now < snoozedUntil) return null;

  const unsent = pendingSyncCount();
  return (
    <div role="status" className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-warning)] bg-[var(--color-warning-container)] px-4 py-2.5 text-sm text-[var(--color-on-surface)]">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">มีเวอร์ชันใหม่ของแอป</p>
        <p className="text-xs">
          {unsent > 0 ? `มี ${unsent} รายการที่ยังส่งไม่เสร็จ ระบบจดไว้ในเครื่องแล้ว อัปเดตแล้วจะส่งต่อให้เอง` : "ถ้ากำลังสแกนหรือกรอกอยู่ ให้บันทึกก่อนแล้วค่อยกดอัปเดต"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => window.location.reload()}>
          อัปเดตตอนนี้
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const t = Date.now();
            setNow(t);
            setSnoozedUntil(t + VERSION_SNOOZE_MS);
          }}
        >
          ไว้ทีหลัง
        </Button>
      </div>
    </div>
  );
}
