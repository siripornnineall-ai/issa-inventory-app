"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/utils/money";

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
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center" role="status">
        <CheckCircle2 className="h-14 w-14 text-[var(--color-success)]" />
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            เลขที่ <span className="font-semibold text-[var(--color-on-surface)]">{info.docNo}</span> · {formatNumber(info.totalQty)} ชิ้น ({info.lineCount} รายการ)
          </p>
          <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">บันทึกเรียบร้อยแล้ว ไม่ต้องกดบันทึกซ้ำ</p>
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
