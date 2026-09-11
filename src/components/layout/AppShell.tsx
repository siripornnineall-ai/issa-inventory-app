"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileNavProvider } from "./MobileNavContext";
import { useCurrentUser } from "@/lib/auth/session";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen bg-[var(--color-bg)]">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MobileNavProvider>
  );
}
