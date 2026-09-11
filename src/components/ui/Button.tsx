import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-[var(--color-primary-container)] text-white hover:bg-[var(--color-primary)] disabled:bg-[var(--color-bg-dim)]",
  secondary: "bg-[var(--color-secondary-beige)] text-[var(--color-on-surface)] hover:bg-[#e6ddcf]",
  ghost: "bg-transparent text-[var(--color-primary-container)] border border-[var(--color-primary-container)]/40 hover:bg-[var(--color-surface-container)]",
  danger: "bg-[var(--color-danger)] text-white hover:bg-[#a01414]",
  link: "bg-transparent text-[var(--color-primary-container)] underline-offset-4 hover:underline px-0",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
          variantClasses[variant],
          variant !== "link" && sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
