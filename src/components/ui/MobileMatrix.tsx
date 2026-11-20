"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ตารางสี × ไซซ์ แบบมือถือ: หนึ่งสี = หนึ่งการ์ด ไซซ์เป็นช่องเล็กเรียง 4 ช่องต่อแถว โชว์เฉพาะไซซ์ที่มีตัวเลข
// ไม่ต้องเลื่อนซ้าย-ขวา ใช้แทนตารางกว้างบนจอเล็ก (useIsMobile) ตัวเลือกสี/พื้นเหมือนตารางเดิม
export type MxTone = "danger-strong" | "danger" | "danger-text" | "success" | "muted";

export interface MxCell {
  value: string;
  sub?: string;
  tone?: MxTone;
  tint?: CSSProperties; // พื้นไล่ความเข้มตามจำนวน (heat)
}

export interface MxRow {
  key: string;
  label: ReactNode;
  summary?: ReactNode;
  cells: Record<string, MxCell | undefined>;
}

const TONE: Record<MxTone, string> = {
  "danger-strong": "bg-[var(--color-danger)] text-white border-transparent",
  danger: "text-[var(--color-danger)] border-[var(--color-danger)]/30",
  "danger-text": "text-[var(--color-danger)]",
  success: "bg-[var(--color-success-container)]",
  muted: "text-[var(--color-on-surface-variant)]/60",
};

function Chip({ size, cell }: { size: string; cell: MxCell }) {
  const dangerSoft = cell.tone === "danger";
  return (
    <div
      className={cn("flex min-h-[3rem] flex-col items-center justify-center rounded-lg border border-[var(--color-border)] px-1 py-1 text-center leading-tight", cell.tone && TONE[cell.tone])}
      style={dangerSoft ? { backgroundColor: "color-mix(in srgb, var(--color-danger) 14%, white)", ...cell.tint } : cell.tint}
    >
      <span className="text-[11px] font-medium opacity-70">{size}</span>
      <span className="text-[15px] font-semibold tabular-nums">{cell.value}</span>
      {cell.sub && <span className="text-[11px] opacity-85">{cell.sub}</span>}
    </div>
  );
}

export function MobileMatrix({
  sizes,
  rows,
  footer,
}: {
  sizes: string[];
  rows: MxRow[];
  footer?: { label: string; cells: Record<string, string>; summary?: ReactNode };
}) {
  const shown = rows.filter((r) => sizes.some((s) => r.cells[s]));
  // ไม่มีบรรทัดเล็กใต้เลข (เช่น "คลัง 0") → เรียง 6 ช่องต่อแถว (12 ไซซ์ = 2 แถว) มี → 4 ช่องให้ข้อความพอดี
  const hasSub = shown.some((r) => sizes.some((s) => r.cells[s]?.sub));
  const cols = hasSub ? "grid-cols-4" : "grid-cols-6";
  return (
    <div className="flex flex-col gap-2.5 px-3 pb-4">
      {shown.length === 0 && <p className="px-2 py-4 text-sm text-[var(--color-on-surface-variant)]">ไม่มีตัวเลขในรุ่นนี้</p>}
      {shown.map((r) => (
        <div key={r.key} className="rounded-xl border border-[var(--color-border)] bg-white p-2.5">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
            <span className="text-sm font-semibold">{r.label}</span>
            {r.summary && <span className="text-right text-xs text-[var(--color-on-surface-variant)]">{r.summary}</span>}
          </div>
          <div className={cn("grid gap-1.5", cols)}>
            {sizes.map((s) => (r.cells[s] ? <Chip key={s} size={s} cell={r.cells[s]!} /> : null))}
          </div>
        </div>
      ))}
      {footer && (
        <div className="rounded-xl bg-[var(--color-surface-container)] p-2.5">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
            <span className="text-sm font-semibold">{footer.label}</span>
            {footer.summary && <span className="text-right text-xs font-semibold">{footer.summary}</span>}
          </div>
          <div className={cn("grid gap-1.5", cols)}>
            {sizes.map((s) =>
              footer.cells[s] !== undefined ? (
                <div key={s} className="flex flex-col items-center rounded-lg bg-white/70 px-1 py-1 text-center leading-tight">
                  <span className="text-[11px] font-medium opacity-70">{s}</span>
                  <span className="text-sm font-semibold tabular-nums">{footer.cells[s]}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
