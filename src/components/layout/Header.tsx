"use client";

import { useState } from "react";
import { ArrowLeft, HelpCircle, LogOut, ChevronDown, Menu } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/session";
import { useActions, useStore } from "@/lib/store";
import { ROLE_LABEL_TH } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { emptyState } from "@/lib/store/state";
import { NotificationBell } from "./NotificationBell";
import { useMobileNav } from "./MobileNavContext";

export function Header({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const user = useCurrentUser();
  const { logout } = useActions();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { setOpen: setMobileNavOpen } = useMobileNav();

  return (
    <header
      className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 pb-4 sm:px-6 sm:pb-5 lg:px-8 lg:pb-6"
      style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-on-surface-variant)]"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-on-surface-variant)] lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold leading-tight tracking-tight text-[var(--color-on-surface)] sm:text-2xl lg:text-[28px]">{title}</h1>
            {description && <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationBell />
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-on-surface-variant)]" aria-label="ช่วยเหลือ">
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white py-1 pl-1 pr-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-sm font-semibold text-white">
                  {user.name.slice(0, 1)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight text-[var(--color-on-surface)]">{user.name}</span>
                  <span className="block text-[11px] leading-tight text-[var(--color-on-surface-variant)]">{ROLE_LABEL_TH[user.role]}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-[var(--color-on-surface-variant)] sm:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
                  <button
                    onClick={async () => {
                      await createClient().auth.signOut();
                      useStore.getState().actions.hydrate(emptyState());
                      logout();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-surface-container)]"
                  >
                    <LogOut className="h-4 w-4" /> ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </header>
  );
}
