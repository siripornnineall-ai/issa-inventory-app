"use client";

import { useEffect, useState } from "react";
import { Grid3x3, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PinSetupDialog } from "./PinSetup";
import { useCurrentUser } from "@/lib/auth/session";
import { PIN_LENGTH, hasPin } from "@/lib/supabase/pinAuth";

// แถบเตือนบนสุดของทุกหน้า: พนักงานที่ยังไม่ได้ตั้ง PIN ให้ตั้งเพื่อเข้าระบบเร็วขึ้น (ผู้ดูแลระบบใช้ PIN ไม่ได้ จึงไม่เตือน)
// กด "ไว้ทีหลัง" ซ่อนเฉพาะรอบที่เปิดอยู่ เปิดแอปใหม่/เข้าใหม่แล้วจะเตือนอีกจนกว่าจะตั้ง
export function PinReminder() {
  const user = useCurrentUser();
  const [missing, setMissing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const eligible = Boolean(user && user.active && user.role !== "admin");
  const userId = user?.id;

  useEffect(() => {
    if (!eligible) return;
    let live = true;
    void hasPin().then((has) => live && setMissing(!has));
    return () => {
      live = false;
    };
  }, [eligible, userId]);

  return (
    <>
      {eligible && missing && !hidden && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6 lg:px-8">
          <Grid3x3 className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">ตั้ง PIN {PIN_LENGTH} หลักไว้เลย</span> ครั้งหน้าเลือกชื่อบนหน้าเข้าสู่ระบบแล้วใส่ PIN ไม่ต้องพิมพ์อีเมลและรหัสผ่าน
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              ตั้ง PIN ตอนนี้
            </Button>
            <button type="button" onClick={() => setHidden(true)} className="rounded-lg p-1.5 text-amber-900/70 hover:bg-amber-100" aria-label="ไว้ทีหลัง" title="ไว้ทีหลัง">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <PinSetupDialog open={open} onClose={() => setOpen(false)} onSaved={() => setMissing(false)} />
    </>
  );
}
