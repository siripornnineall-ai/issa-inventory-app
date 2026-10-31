"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { discardFailedSyncs, retryFailedSyncs } from "@/lib/store";
import { useSyncStatus } from "@/lib/store/useSyncStatus";

// แถบเตือนสีแดงค้างบนจอเมื่อมีรายการที่ยังไม่ถูกบันทึกลงฐานข้อมูล (ส่งไม่สำเร็จ) ไม่หายเองจนกว่าจะส่งสำเร็จ
// ระบบเก็บรายการไว้และส่งซ้ำให้เอง (เน็ตกลับมา / ทุก 30 วินาที / เปิดแอปใหม่) ปุ่มนี้ให้กดส่งทันที
export function SyncStatusBanner() {
  const status = useSyncStatus();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (status.failed === 0) return null;
  return (
    <>
      <div role="alert" className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-danger)] bg-[var(--color-danger-container)] px-4 py-2.5 text-sm text-[var(--color-on-danger-container)]">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">มี {status.failed} รายการที่ยังไม่ถูกบันทึกลงระบบ</p>
          <p className="text-xs">
            {status.retrying ? "กำลังส่งใหม่..." : "ยังไม่เข้าฐานข้อมูล ระบบเก็บไว้และจะส่งใหม่ให้เอง อย่าเพิ่งปิดแอป"}
            {status.lastError && ` (${status.lastError})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void retryFailedSyncs()} loading={status.retrying}>
            ส่งอีกครั้งตอนนี้
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(true)}>
            ทิ้งรายการที่ค้าง
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="ทิ้งรายการที่ค้างอยู่?"
        description={`รายการที่ยังไม่ถูกบันทึก ${status.failed} รายการจะหายไปถาวร และแอปจะโหลดข้อมูลจริงจากฐานข้อมูลมาแทน ใช้เฉพาะเมื่อส่งไม่ได้จริง ๆ หลังลองหลายครั้ง ถ้าทิ้งแล้วต้องบันทึกรายการนั้นใหม่`}
        confirmLabel="ทิ้งรายการที่ค้าง"
        danger
        onConfirm={() => {
          discardFailedSyncs();
          setConfirmDiscard(false);
        }}
      />
    </>
  );
}
