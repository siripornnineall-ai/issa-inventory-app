"use client";

import Link from "next/link";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatAgo, type SaveGuard } from "@/lib/utils/saveGuard";

// เตือนก่อนบันทึกซ้ำ: เพิ่งมีใบที่รายการและจำนวนเหมือนกันทุกอย่าง (มักเกิดจากมือถือค้างแล้วกดบันทึกอีกรอบ)
export function DuplicateSaveDialog({ guard, docLabel = "ใบ" }: { guard: SaveGuard; docLabel?: string }) {
  const dup = guard.duplicate;
  return (
    <Dialog
      open={Boolean(dup)}
      onClose={guard.cancelDuplicate}
      title="เพิ่งบันทึกรายการเหมือนกันนี้ไปแล้ว"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={guard.cancelDuplicate}>
            ไม่บันทึกซ้ำ
          </Button>
          <Button variant="danger" onClick={guard.confirmDuplicate}>
            บันทึกซ้ำ
          </Button>
        </>
      }
    >
      {dup && (
        <div className="flex flex-col gap-2 text-sm text-[var(--color-on-surface)]">
          <p>
            {docLabel}เลขที่ <span className="font-semibold">{dup.no}</span> ที่มีรายการและจำนวนเหมือนกันทุกอย่าง ถูกบันทึกไปเมื่อ {formatAgo(dup.createdAt)}ที่แล้ว
          </p>
          <p className="text-[var(--color-on-surface-variant)]">
            ถ้าเมื่อครู่กดบันทึกไปแล้วแต่หน้าจอค้าง แปลว่าบันทึกสำเร็จแล้ว <b>ไม่ต้องบันทึกซ้ำ</b> ไม่งั้นจำนวนจะเพิ่มเป็นสองเท่า ตรวจได้ที่{" "}
            <Link href="/history" className="font-medium text-[var(--color-primary-container)] underline">
              ประวัติการเคลื่อนไหว
            </Link>
          </p>
        </div>
      )}
    </Dialog>
  );
}
