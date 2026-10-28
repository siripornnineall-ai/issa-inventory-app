"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { fullMonthOf, monthLabel, monthPeriod, type Period } from "@/lib/utils/period";
import { shiftMonth } from "@/lib/utils/salesMatrix";

// ตัวเลือกช่วงเวลา: ลูกศรเดือนก่อน/ถัดไป (ตั้งเป็นทั้งเดือน ไม่ให้เลือกเดือนอนาคต) หรือกำหนดวันที่เริ่ม-สิ้นสุดเองได้
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const today = new Date();
  const currentMonth = monthPeriod(today.getFullYear(), today.getMonth());
  const month = fullMonthOf(value);
  const anchor = month ?? { year: Number(value.from.slice(0, 4)), month0: Number(value.from.slice(5, 7)) - 1 };
  const atCurrent = anchor.year === today.getFullYear() && anchor.month0 === today.getMonth();
  const isCurrentMonth = value.from === currentMonth.from && value.to === currentMonth.to;

  function go(delta: number) {
    const m = shiftMonth(anchor.year, anchor.month0, delta);
    onChange(monthPeriod(m.year, m.month0));
  }

  // วันที่เริ่มเลยวันสิ้นสุด (หรือกลับกัน) ให้อีกฝั่งตามมา ช่องว่าง (ลบวันที่) ไม่เปลี่ยนค่า
  function setFrom(from: string) {
    if (from) onChange({ from, to: from > value.to ? from : value.to });
  }
  function setTo(to: string) {
    if (to) onChange({ from: to < value.from ? to : value.from, to });
  }

  return (
    <>
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1" role="group" aria-label="เลือกเดือน">
        <button type="button" onClick={() => go(-1)} aria-label="เดือนก่อน" className="rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[9.5rem] px-2 text-center text-sm font-semibold text-[var(--color-on-surface)]">{month ? monthLabel(month.year, month.month0) : "กำหนดช่วงเอง"}</span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={atCurrent}
          aria-label="เดือนถัดไป"
          className="rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 text-sm" role="group" aria-label="เลือกช่วงวันที่">
        <Input type="date" value={value.from} onChange={(e) => setFrom(e.target.value)} aria-label="ตั้งแต่วันที่" className="w-40" />
        <span className="text-[var(--color-on-surface-variant)]">ถึง</span>
        <Input type="date" value={value.to} onChange={(e) => setTo(e.target.value)} aria-label="ถึงวันที่" className="w-40" />
      </div>
      {!isCurrentMonth && (
        <Button variant="ghost" size="sm" onClick={() => onChange(currentMonth)}>
          เดือนนี้
        </Button>
      )}
    </>
  );
}
