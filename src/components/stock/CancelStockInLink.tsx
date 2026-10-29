"use client";

import Link from "next/link";
import { Undo2 } from "lucide-react";
import { useCan } from "@/lib/auth/session";

// ทางเข้าหน้ายกเลิกใบรับเข้า (รับเข้าผิดรุ่น/ผิดจำนวน) เห็นเฉพาะคนที่มีสิทธิ์ปรับยอดสต็อก
export function CancelStockInLink() {
  const allowed = useCan("stock.adjust");
  if (!allowed) return null;
  return (
    <Link href="/stock-in/cancel" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]">
      <Undo2 className="h-4 w-4" /> รับเข้าผิด? ยกเลิกใบรับเข้า
    </Link>
  );
}
