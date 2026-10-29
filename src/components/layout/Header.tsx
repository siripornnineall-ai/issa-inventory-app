"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, HelpCircle, KeyRound, LogOut, ChevronDown, Menu, Grid3x3 } from "lucide-react";
import { ChangePasswordDialog } from "@/components/account/ChangePassword";
import { PinSetupDialog } from "@/components/account/PinSetup";
import { useCurrentUser } from "@/lib/auth/session";
import { useActions, useStore } from "@/lib/store";
import { ROLE_LABEL_TH } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { emptyState } from "@/lib/store/state";
import { NotificationBell } from "./NotificationBell";
import { RefreshButton } from "./RefreshButton";
import { useMobileNav } from "./MobileNavContext";
import { getLoadStats, subscribeLoadStats } from "@/lib/store/loadStats";

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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const loadStats = useSyncExternalStore(subscribeLoadStats, getLoadStats, () => null);
  const { setOpen: setMobileNavOpen } = useMobileNav();

  return (
    <header
      className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 pb-4 sm:px-6 sm:pb-5 lg:px-8 lg:pb-6"
      style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
    >
      {/* มือถือ: แถวบนเป็นปุ่มล้วน หัวข้อลงมาแถวของตัวเองเต็มความกว้าง (ไม่งั้นตัวอักษรถูกบีบเป็นคำละบรรทัด) / จอ sm ขึ้นไป: อยู่แถวเดียวกันเหมือนเดิม */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3 sm:flex-nowrap">
        <div className="order-1 flex shrink-0 items-start gap-3 sm:contents">
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
        </div>
        <div className="order-3 min-w-0 basis-full sm:order-2 sm:flex-1 sm:basis-0">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-[var(--color-on-surface)] sm:truncate sm:text-2xl lg:text-[28px]">{title}</h1>
          {description && <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">{description}</p>}
        </div>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:ml-0 sm:gap-3">
          <RefreshButton />
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
                <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setPasswordOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                  >
                    <KeyRound className="h-4 w-4" /> เปลี่ยนรหัสผ่าน
                  </button>
                  {user.role !== "admin" && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setPinOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                    >
                      <Grid3x3 className="h-4 w-4" /> ตั้ง PIN เข้าระบบ
                    </button>
                  )}
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
                  {loadStats && (
                    <p className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] leading-snug text-[var(--color-on-surface-variant)]">
                      {loadStats.kind}ล่าสุด: ดึงข้อมูล {(loadStats.fetchMs / 1000).toFixed(1)} วินาที ({loadStats.rows.toLocaleString("th-TH")} รายการ)
                      {loadStats.slowest.length > 0 && ` · ช้าสุด ${loadStats.slowest.map((s) => `${s.table} ${(s.ms / 1000).toFixed(1)}วิ`).join(", ")}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <PinSetupDialog open={pinOpen} onClose={() => setPinOpen(false)} />
    </header>
  );
}
