"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import * as Icons from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "./nav";
import { useMobileNav } from "./MobileNavContext";
import { useCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { ROLE_LABEL_TH } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <Icon className={className} />;
}

function SidebarLink({ href, label, icon, onNavigate }: NavItem & { onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      <NavIcon name={icon} className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const user = useCurrentUser();
  const { open, setOpen } = useMobileNav();
  const pathname = usePathname();

  // ปิดเมนูมือถืออัตโนมัติทุกครั้งที่เปลี่ยนหน้า
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex h-screen w-[280px] shrink-0 flex-col bg-[var(--color-primary)] px-4 pb-6 transition-[left] duration-200 ease-out print:hidden",
          "lg:static lg:z-auto",
          open ? "max-lg:left-0" : "max-lg:-left-[280px]"
        )}
        style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 1rem))" }}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div>
            <p className="text-xl font-semibold tracking-tight text-white">ISSA Apparel</p>
            <p className="text-[11px] uppercase tracking-wider text-white/50">Inventory Management</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pb-4">
          {NAV_SECTIONS.map((section) => {
            const visible = section.items.filter((item) => !item.perm || hasPermission(user?.role, item.perm));
            if (visible.length === 0) return null;
            return (
              <div key={section.title} className="flex flex-col gap-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{section.title}</p>
                {visible.map((item) => (
                  <SidebarLink key={item.href} {...item} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            );
          })}
        </nav>
        {user && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-white/50">{ROLE_LABEL_TH[user.role]}</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
