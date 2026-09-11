"use client";

import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
            active === tab.id
              ? "text-[var(--color-primary-container)]"
              : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
          )}
        >
          {tab.label}
          {active === tab.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary-container)]" />}
        </button>
      ))}
    </div>
  );
}
