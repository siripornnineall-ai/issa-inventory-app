"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileNavProvider } from "./MobileNavContext";
import { useCan, useCurrentUser } from "@/lib/auth/session";
import { requiredPermForPath } from "@/lib/auth/routes";
import { NoAccess } from "./RequireAccess";
import { Header } from "./Header";
import { PageContainer } from "./PageContainer";
import { ForcePasswordChange } from "@/components/account/ChangePassword";
import { PinReminder } from "@/components/account/PinReminder";
import { SyncStatusBanner } from "./SyncStatusBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  // สิทธิ์เข้าถึงหน้า: ถ้าผู้ดูแลระบบไม่ให้ตำแหน่งนี้เข้าหน้านี้ กันไว้แม้พิมพ์ลิงก์ตรง ๆ (ส่วนที่ไม่อยู่ในรายการใช้สิทธิ์ของหน้านั้นเอง)
  const needPerm = requiredPermForPath(pathname ?? "");
  const canViewPage = useCan(needPerm ?? "view.dashboard");

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
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <SyncStatusBanner />
          <PinReminder />
          {needPerm && !canViewPage ? (
            <>
              <Header title="ไม่มีสิทธิ์เข้าถึง" />
              <PageContainer>
                <NoAccess />
              </PageContainer>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </MobileNavProvider>
  );
}
