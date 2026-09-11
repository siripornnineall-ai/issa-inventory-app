"use client";

import { useEffect } from "react";

// ป้องกันการปิด/รีเฟรชแท็บเมื่อมีข้อมูลในฟอร์มที่ยังไม่ได้บันทึก
// หมายเหตุ: ครอบคลุมเฉพาะการปิดแท็บ/รีเฟรช ไม่ครอบคลุมการกดลิงก์ภายในแอป (ข้อจำกัดของ Next.js App Router)
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
