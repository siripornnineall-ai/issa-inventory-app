"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// ลิงก์ "กลับ" ที่ย้อนประวัติเบราว์เซอร์จริง (เหมือนปุ่มย้อนกลับ) แทนการ push หน้าเดิมซ้ำเข้าไปในประวัติ
// ถ้า push หน้าสินค้ากลับเข้าไปอีกรอบ ประวัติจะเป็น สินค้า → ป้าย → สินค้า แล้วกดย้อนกลับก็วนไปมาไม่รู้จบ
// ถ้าไม่มีประวัติให้ย้อน (เปิดลิงก์ตรง/แท็บใหม่) ใช้ href สำรองเป็นหน้าปลายทางแทน
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
