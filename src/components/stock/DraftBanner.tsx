"use client";

import { Button } from "@/components/ui/Button";
import { formatThaiDateTime } from "@/lib/utils/date";

// แถบถามตอนเปิดหน้าแล้วพบรายการที่เคยทำค้างไว้ยังไม่ได้บันทึก
export function DraftBanner({ savedAt, summary, onRestore, onDiscard }: { savedAt: string; summary: string; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-container)] p-3 text-sm">
      <p>
        พบรายการที่ทำค้างไว้ยังไม่ได้บันทึก ({summary}) เมื่อ {formatThaiDateTime(savedAt)} ต้องการทำต่อไหม
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onRestore}>
          ทำต่อ
        </Button>
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          ทิ้งรายการนี้
        </Button>
      </div>
    </div>
  );
}
