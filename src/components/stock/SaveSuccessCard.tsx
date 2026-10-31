"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/utils/money";
import { useSyncStatus } from "@/lib/store/useSyncStatus";

export interface SavedInfo {
  docNo: string;
  totalQty: number;
  lineCount: number;
}

// หน้ายืนยันหลังบันทึกสำเร็จ: ผู้ใช้เห็นชัดว่าเสร็จแล้ว พร้อมเลขที่ใบ ไม่ต้องสงสัยแล้วกดบันทึกซ้ำ
export function SaveSuccessCard({
  title,
  info,
  againLabel,
  onAgain,
  backHref,
  backLabel,
}: {
  title: string;
  info: SavedInfo;
  againLabel: string;
  onAgain: () => void;
  backHref: string;
  backLabel: string;
}) {
  // เขียวเต็มตัวต่อเมื่อฐานข้อมูลรับครบแล้ว: ระหว่างส่งขึ้นว่ากำลังบันทึก ถ้าส่งไม่สำเร็จเตือนสีแดง (ไม่บอกว่าเรียบร้อย)
  const sync = useSyncStatus();
  const failed = sync.failed > 0;
  const sending = !failed && sync.pending > 0;
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center" role="status">
        {failed ? <AlertTriangle className="h-14 w-14 text-[var(--color-danger)]" /> : sending ? <Loader2 className="h-14 w-14 animate-spin text-[var(--color-on-surface-variant)]" /> : <CheckCircle2 className="h-14 w-14 text-[var(--color-success)]" />}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            เลขที่ <span className="font-semibold text-[var(--color-on-surface)]">{info.docNo}</span> · {formatNumber(info.totalQty)} ชิ้น ({info.lineCount} รายการ)
          </p>
          {failed ? (
            <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]">ยังไม่เข้าฐานข้อมูล ระบบกำลังส่งใหม่ให้ อย่าเพิ่งปิดแอปและอย่ากดบันทึกซ้ำ</p>
          ) : sending ? (
            <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">กำลังบันทึกลงฐานข้อมูล... รอสักครู่</p>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">บันทึกลงฐานข้อมูลเรียบร้อยแล้ว ไม่ต้องกดบันทึกซ้ำ</p>
          )}
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button onClick={onAgain}>{againLabel}</Button>
          <Link href="/history">
            <Button variant="secondary" className="w-full">
              ดูในประวัติการเคลื่อนไหว
            </Button>
          </Link>
          <Link href={backHref}>
            <Button variant="ghost" className="w-full">
              {backLabel}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
