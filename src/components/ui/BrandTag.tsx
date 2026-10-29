"use client";

import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils/cn";
import { brandColor, brandTint } from "@/lib/utils/brandColor";

// ชื่อแบรนด์พร้อมสีประจำแบรนด์: "chip" = ป้ายพื้นจาง ๆ ใช้ในหัวการ์ดสินค้า, "dot" = จุดสีนำหน้าชื่อ ใช้ในตารางและรายการ
// ตัวอักษรใช้สีข้อความปกติ สีแบรนด์ใช้แค่จุดและพื้นจาง เพื่อให้อ่านชัดทุกแบรนด์ (ฟ้าน้ำทะเลใช้เป็นตัวอักษรขาวไม่ชัด)
export function BrandTag({
  brandId,
  variant = "dot",
  fallback = "-",
  className,
}: {
  brandId?: string | null;
  variant?: "chip" | "dot";
  fallback?: string;
  className?: string;
}) {
  const brand = useStore((s) => (brandId ? s.brands[brandId] : undefined));
  if (!brand) return <span className={className}>{fallback}</span>;
  const color = brandColor(brand);
  const dot = <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
  if (variant === "chip") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold text-[var(--color-on-surface)]", className)}
        style={{ background: brandTint(color, 14), borderColor: brandTint(color, 45) }}
      >
        {dot}
        {brand.name}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {dot}
      {brand.name}
    </span>
  );
}
