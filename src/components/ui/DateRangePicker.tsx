"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DateRangePreset } from "@/lib/types";
import { endOfTodayISO, startOfMonthISO, startOfTodayISO } from "@/lib/utils/date";

export interface DateRangeValue {
  preset: DateRangePreset;
  from: string;
  to: string;
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
  { key: "this_month", label: "เดือนนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

export function computeRange(preset: DateRangePreset, customFrom?: string, customTo?: string): DateRangeValue {
  const to = endOfTodayISO();
  switch (preset) {
    case "today":
      return { preset, from: startOfTodayISO(), to };
    case "7d": {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return { preset, from: d.toISOString(), to };
    }
    case "30d": {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      d.setHours(0, 0, 0, 0);
      return { preset, from: d.toISOString(), to };
    }
    case "this_month":
      return { preset, from: startOfMonthISO(), to };
    case "custom":
      return {
        preset,
        from: customFrom ? new Date(customFrom).toISOString() : startOfTodayISO(),
        to: customTo ? new Date(new Date(customTo).setHours(23, 59, 59, 999)).toISOString() : to,
      };
  }
}

export function useDateRange(initial: DateRangePreset = "30d") {
  const [value, setValue] = useState<DateRangeValue>(() => computeRange(initial));
  return { value, setValue };
}

export function DateRangePicker({ value, onChange }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void }) {
  const [customFrom, setCustomFrom] = useState(value.from.slice(0, 10));
  const [customTo, setCustomTo] = useState(value.to.slice(0, 10));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(computeRange(p.key, customFrom, customTo))}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              value.preset === p.key ? "bg-[var(--color-primary-container)] text-white" : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5">
          <Calendar className="h-4 w-4 text-[var(--color-on-surface-variant)]" />
          <input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              onChange(computeRange("custom", e.target.value, customTo));
            }}
            className="text-sm outline-none"
          />
          <span className="text-[var(--color-on-surface-variant)]">-</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              onChange(computeRange("custom", customFrom, e.target.value));
            }}
            className="text-sm outline-none"
          />
        </div>
      )}
    </div>
  );
}
