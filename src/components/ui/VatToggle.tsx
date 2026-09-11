"use client";

export function VatToggle({ value, onChange }: { value: boolean; onChange: (vatEnabled: boolean) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1 print:hidden">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
          !value ? "bg-[var(--color-primary-container)] text-white" : "text-[var(--color-on-surface-variant)]"
        }`}
      >
        ไม่มี VAT
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
          value ? "bg-[var(--color-primary-container)] text-white" : "text-[var(--color-on-surface-variant)]"
        }`}
      >
        VAT 7%
      </button>
    </div>
  );
}
