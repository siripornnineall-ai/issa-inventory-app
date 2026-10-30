"use client";

import { cn } from "@/lib/utils/cn";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string; // ข้อความอธิบายสั้น ๆ ใต้ชื่อ
}

// กล่องเลือกแบบเดียวกับแถบเลือกของหน้าสต็อกภาพรวม: กล่องที่เลือกอยู่เป็นสีเขียวเข้มตัวอักษรขาว กล่องอื่นเป็นพื้นขาว
// เลือกได้ทีละข้อ ปุ่มทุกกล่องใช้ aria-pressed (อ่านออกเสียง/ทดสอบได้) columns = คลาส grid เช่น "grid-cols-2 sm:grid-cols-4"
export function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  columns = "grid-cols-2 sm:grid-cols-4",
  ariaLabel,
  className,
}: {
  options: ChoiceOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  columns?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("grid gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1", columns, className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-lg px-3 py-2 text-center transition-colors",
              active ? "bg-[var(--color-primary-container)] text-white" : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
            )}
          >
            <span className="text-sm font-semibold">{o.label}</span>
            {o.hint && <span className={cn("mt-0.5 text-[11px] font-normal leading-tight", active ? "text-white/80" : "text-[var(--color-on-surface-variant)]")}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
