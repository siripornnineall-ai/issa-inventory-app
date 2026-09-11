import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-strong)] py-16 text-center">
      {icon && <div className="text-[var(--color-on-surface-variant)]">{icon}</div>}
      <p className="text-base font-medium text-[var(--color-on-surface)]">{title}</p>
      {description && <p className="max-w-sm text-sm text-[var(--color-on-surface-variant)]">{description}</p>}
      {action}
    </div>
  );
}
