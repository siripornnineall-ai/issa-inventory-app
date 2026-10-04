import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { stripLeadingZeros } from "@/lib/utils/numberInput";

const fieldBase =
  "w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/60 outline-none transition-shadow focus:border-[var(--color-primary-container)] focus:ring-4 focus:ring-[var(--color-primary-container)]/10 disabled:bg-[var(--color-surface-container)] disabled:text-[var(--color-on-surface-variant)]";

// ช่องตัวเลขตัดเลข 0 นำหน้าให้เอง (0180 -> 180) ทุกช่องทั้งแอปใช้ตัวนี้ จึงแก้ที่เดียว
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, onChange, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(fieldBase, className)}
    onChange={
      props.type === "number"
        ? (e) => {
            stripLeadingZeros(e.currentTarget);
            onChange?.(e);
          }
        : onChange
    }
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-[96px] resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, "appearance-none bg-no-repeat pr-9", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-[var(--color-on-surface)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-[var(--color-on-surface-variant)]">{hint}</p>}
      {error && <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
