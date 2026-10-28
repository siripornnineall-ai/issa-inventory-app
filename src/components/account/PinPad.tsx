"use client";

import { useEffect } from "react";
import { Delete } from "lucide-react";
import { PIN_LENGTH } from "@/lib/supabase/pinAuth";

// แป้นกรอก PIN: จุดแสดงจำนวนหลักที่กรอกแล้ว + ปุ่มตัวเลข (กดด้วยนิ้วบนมือถือ) และรับแป้นพิมพ์จริงบนคอมพิวเตอร์ด้วย
export function PinPad({ value, onChange, disabled, error }: { value: string; onChange: (v: string) => void; disabled?: boolean; error?: boolean }) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) onChange((value + e.key).slice(0, PIN_LENGTH));
      else if (e.key === "Backspace") onChange(value.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, disabled]);

  const press = (d: string) => !disabled && onChange((value + d).slice(0, PIN_LENGTH));

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3" role="img" aria-label={`กรอกแล้ว ${value.length} จาก ${PIN_LENGTH} หลัก`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={
              "h-3.5 w-3.5 rounded-full border-2 transition-colors " +
              (i < value.length ? (error ? "border-[var(--color-danger)] bg-[var(--color-danger)]" : "border-[var(--color-primary-container)] bg-[var(--color-primary-container)]") : "border-[var(--color-border-strong)] bg-transparent")
            }
          />
        ))}
      </div>
      <div className="grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={disabled}
            className="h-14 rounded-2xl border border-[var(--color-border)] bg-white text-xl font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)] active:bg-[var(--color-surface-container)] disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => press("0")}
          disabled={disabled}
          className="h-14 rounded-2xl border border-[var(--color-border)] bg-white text-xl font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)] active:bg-[var(--color-surface-container)] disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => !disabled && onChange(value.slice(0, -1))}
          disabled={disabled || value.length === 0}
          aria-label="ลบหลักล่าสุด"
          className="flex h-14 items-center justify-center rounded-2xl text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container)] disabled:opacity-30"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
