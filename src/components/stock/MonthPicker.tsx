"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { shiftMonth } from "@/lib/utils/salesMatrix";

export interface YearMonth {
  year: number;
  month0: number;
}

export const monthLabel = (year: number, month0: number) => new Date(year, month0, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

// ตัวเลือกเดือนปฏิทิน: ลูกศรเดือนก่อน/ถัดไป (ไม่ให้เลือกเดือนอนาคต) และปุ่มกลับมาเดือนนี้
export function MonthPicker({ value, onChange }: { value: YearMonth; onChange: (v: YearMonth) => void }) {
  const today = new Date();
  const current = { year: today.getFullYear(), month0: today.getMonth() };
  const isCurrent = value.year === current.year && value.month0 === current.month0;
  return (
    <>
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1" role="group" aria-label="เลือกเดือน">
        <button
          type="button"
          onClick={() => onChange(shiftMonth(value.year, value.month0, -1))}
          aria-label="เดือนก่อน"
          className="rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[9.5rem] px-2 text-center text-sm font-semibold text-[var(--color-on-surface)]">{monthLabel(value.year, value.month0)}</span>
        <button
          type="button"
          onClick={() => onChange(shiftMonth(value.year, value.month0, 1))}
          disabled={isCurrent}
          aria-label="เดือนถัดไป"
          className="rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {!isCurrent && (
        <Button variant="ghost" size="sm" onClick={() => onChange(current)}>
          เดือนนี้
        </Button>
      )}
    </>
  );
}
