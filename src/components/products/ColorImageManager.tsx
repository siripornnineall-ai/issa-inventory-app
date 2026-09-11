"use client";

import { useState } from "react";
import { Check, Expand } from "lucide-react";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import type { ProductImage } from "@/lib/types";
import { newId } from "@/lib/utils/ids";

export function ColorImageManager({
  colors,
  images,
  onChange,
  availableImages = [],
}: {
  colors: string[];
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  availableImages?: ProductImage[];
}) {
  const [activeColor, setActiveColor] = useState(colors[0] ?? "");
  const [previewImg, setPreviewImg] = useState<ProductImage | null>(null);

  if (colors.length === 0) return null;
  const active = colors.includes(activeColor) ? activeColor : colors[0];

  function imagesForColor(color: string) {
    return images.filter((i) => i.color === color).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function setImagesForColor(color: string, next: ProductImage[]) {
    const others = images.filter((i) => i.color !== color);
    onChange([...others, ...next.map((img) => ({ ...img, color }))]);
  }

  function assignExistingImage(img: ProductImage) {
    const current = imagesForColor(active);
    if (current.some((i) => i.url === img.url)) return;
    setImagesForColor(active, [
      ...current,
      { ...img, id: newId(), color: active, isMain: current.length === 0, sortOrder: current.length },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--color-on-surface)]">รูปภาพแยกตามสี (แบบ Shopee)</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => {
          const count = imagesForColor(c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveColor(c)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                active === c
                  ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white"
                  : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
              }`}
            >
              {c} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--color-on-surface-variant)]">
        สีที่ไม่มีรูปภาพเฉพาะ จะแสดงรูปภาพหลักของสินค้าแทนโดยอัตโนมัติ
      </p>
      {availableImages.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--color-border-strong)] p-3">
          <p className="text-xs font-medium text-[var(--color-on-surface-variant)]">
            เลือกจากรูปที่มีอยู่แล้ว (คลิกเพื่อกำหนดให้สี &quot;{active}&quot;) ไม่ต้องอัปโหลดซ้ำ
          </p>
          <div className="flex flex-wrap gap-2">
            {availableImages.map((img) => {
              const assigned = imagesForColor(active).some((i) => i.url === img.url);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => assignExistingImage(img)}
                  className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--color-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {assigned && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary-container)]/70">
                      <Check className="h-6 w-6 text-white" />
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImg(img);
                    }}
                    title="ดูรูปขนาดใหญ่"
                    className="absolute right-1 top-1 rounded-md bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Expand className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <ImageUploader
        images={imagesForColor(active)}
        onChange={(next) => setImagesForColor(active, next)}
        kind="selling"
        label={`รูปภาพสำหรับสี "${active}"`}
      />
      {previewImg && <ImageLightbox src={previewImg.url} alt="" onClose={() => setPreviewImg(null)} />}
    </div>
  );
}
