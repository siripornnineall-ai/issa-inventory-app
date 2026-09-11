import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-white",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pt-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-[var(--color-on-surface)]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-[var(--color-on-surface-variant)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-6", className)} {...props} />;
}

export function KpiCard({
  icon,
  label,
  value,
  unit,
  trend,
  className,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <Card
      className={cn("p-4 sm:p-5", clickable && "cursor-pointer text-left transition-shadow hover:shadow-[var(--shadow-micro)]", className)}
      {...(clickable ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && onClick?.() } : {})}
    >
      <div className="flex items-start justify-between">
        {icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-container)] text-[var(--color-primary-container)] sm:h-10 sm:w-10">
            {icon}
          </div>
        )}
        {trend && (
          <span className={cn("text-xs font-medium", trend.positive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
            {trend.value}
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-xs text-[var(--color-on-surface-variant)] sm:mt-4 sm:text-sm">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-1 text-xl font-semibold leading-tight text-[var(--color-on-surface)] sm:text-[28px] sm:leading-none">
        {value}
        {unit && <span className="text-xs font-normal text-[var(--color-on-surface-variant)] sm:text-sm">{unit}</span>}
      </p>
    </Card>
  );
}
