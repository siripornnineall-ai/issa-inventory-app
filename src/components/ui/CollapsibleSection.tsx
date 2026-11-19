"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// หัวข้อที่กดเปิด/ปิดได้ ใช้จัดหน้าตั้งค่าที่ยาวให้เป็นช่อง ๆ เนื้อหายังอยู่ในหน้า (แค่ซ่อน) ข้อมูลที่กรอกค้างไว้จึงไม่หายตอนพับ
export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  nested = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  nested?: boolean; // อยู่ในช่องใหญ่อีกที: ใช้กรอบบางกว่า
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("rounded-2xl border border-[var(--color-border)] bg-white", nested && "bg-[var(--color-surface-container)]/40")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left"
      >
        <span>
          <span className={cn("block font-semibold text-[var(--color-on-surface)]", nested ? "text-base" : "text-lg")}>{title}</span>
          {description && <span className="mt-0.5 block text-sm text-[var(--color-on-surface-variant)]">{description}</span>}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-[var(--color-on-surface-variant)] transition-transform", open && "rotate-180")} />
      </button>
      <div hidden={!open} className="flex flex-col gap-4 px-3 pb-4 sm:px-4">
        {children}
      </div>
    </section>
  );
}
