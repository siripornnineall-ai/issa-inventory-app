"use client";

import Link from "next/link";
import { useCan } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

// แถบกล่องสลับหน้าของงานสินค้าคืน หน้าตาเดียวกับแถบเลือกของหน้าสต็อกภาพรวม (กล่องที่อยู่หน้านี้เป็นสีเขียวเข้ม)
// "ยกเลิกใบรับเข้า" เห็นเฉพาะคนมีสิทธิ์ปรับยอดสต็อก
export type ReturnNavPage = "record" | "summary";

export function ReturnNav({ active }: { active: ReturnNavPage }) {
  const canCancel = useCan("stock.adjust");
  const items: { id: string; href: string; label: string; page?: ReturnNavPage }[] = [
    { id: "record", href: "/stock-return", label: "บันทึกรับคืน", page: "record" },
    { id: "summary", href: "/stock-return/summary", label: "สรุปสินค้าคืน/เปลี่ยน", page: "summary" },
    ...(canCancel ? [{ id: "cancel", href: "/stock-in/cancel", label: "รับเข้าผิด? ยกเลิกใบรับเข้า" }] : []),
  ];
  return (
    <nav aria-label="เมนูสินค้าคืน" className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white p-1">
      {items.map((it) => {
        const isActive = it.page === active;
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors",
              isActive ? "bg-[var(--color-primary-container)] text-white" : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
