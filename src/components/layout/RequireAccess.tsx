"use client";

import { ShieldAlert } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/ui/EmptyState";

export function RequireAccess({ perm, children }: { perm: Permission; children: React.ReactNode }) {
  const user = useCurrentUser();
  if (!hasPermission(user?.role, perm)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-10 w-10" />}
        title="ไม่มีสิทธิ์เข้าถึงหน้านี้"
        description="บัญชีของคุณไม่มีสิทธิ์ใช้งานส่วนนี้ กรุณาติดต่อผู้ดูแลระบบหากต้องการสิทธิ์เพิ่มเติม"
      />
    );
  }
  return <>{children}</>;
}
