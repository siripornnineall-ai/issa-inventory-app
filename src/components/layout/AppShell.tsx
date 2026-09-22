"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileNavProvider } from "./MobileNavContext";
import { useCurrentUser } from "@/lib/auth/session";
import { ForcePasswordChange } from "@/components/account/ChangePassword";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  // บัญชีที่ผู้ดูแลระบบเพิ่งสร้าง/ตั้งรหัสให้ ต้องตั้งรหัสผ่านของตัวเองก่อน — ครอบทุกหน้าในระบบเพราะ AppShell หุ้ม (app) ทั้งหมด
  if (user.mustChangePassword) return <ForcePasswordChange />;

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen bg-[var(--color-bg)]">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MobileNavProvider>
  );
}
