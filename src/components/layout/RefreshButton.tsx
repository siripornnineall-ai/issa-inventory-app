"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshAppData } from "@/lib/store/refresh";
import { toastError, toastSuccess } from "@/lib/toast";

// ปุ่มดึงข้อมูลล่าสุดจากฐานข้อมูล: ไม่ต้องปิดแอปแล้วเปิดใหม่ และรายการที่สแกนค้างไว้ในหน้าไม่หาย
export function RefreshButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    const res = await refreshAppData();
    setLoading(false);
    if (res === "ok") toastSuccess("อัปเดตข้อมูลล่าสุดแล้ว");
    else if (res === "busy") toastError("ยังมีรายการที่กำลังบันทึกอยู่ รอสักครู่แล้วลองใหม่");
    else if (res === "no-session") toastError("หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่");
    else toastError("อัปเดตข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label="อัปเดตข้อมูลล่าสุด"
      title="อัปเดตข้อมูลล่าสุด"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-on-surface-variant)] disabled:opacity-60"
    >
      <RefreshCw className={`h-[18px] w-[18px] ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
