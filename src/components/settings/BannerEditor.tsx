"use client";

import { FormField, Select } from "@/components/ui/Field";
import { SingleImageUploader } from "@/components/ui/SingleImageUploader";
import type { BannerLayout, BannerOverlay, BannerTextAlign } from "@/lib/types";

/**
 * Settings UI for one storefront banner (hero or promo): desktop + mobile
 * image, text alignment, show/hide the website's own text, overlay
 * strength. No preview and no focal-point sliders — the owner asked for
 * the simplest form; the focal point stays at the stored value (50/50 by default).
 */
export function BannerEditor({
  title,
  folder,
  imageUrl,
  onImageChange,
  layout,
  onLayoutChange,
}: {
  title: string;
  folder: string;
  imageUrl: string;
  onImageChange: (url: string) => void;
  layout: BannerLayout;
  onLayoutChange: (next: BannerLayout) => void;
}) {
  const set = (patch: Partial<BannerLayout>) => onLayoutChange({ ...layout, ...patch });

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="mb-3 text-sm font-semibold text-[var(--color-on-surface)]">{title}</p>
      <div className="flex flex-col gap-4">
        <SingleImageUploader label="รูปสำหรับคอมพิวเตอร์ (แนวนอน แนะนำ 2400×1000)" value={imageUrl} onChange={onImageChange} folder={folder} />
        <SingleImageUploader
          label="รูปสำหรับมือถือ (แนวตั้ง แนะนำ 1080×1350) — ไม่ใส่จะใช้รูปคอมแทน"
          value={layout.mobileImageUrl}
          onChange={(url) => set({ mobileImageUrl: url })}
          folder={`${folder}-mobile`}
        />
        {layout.mobileImageUrl && (
          <button type="button" onClick={() => set({ mobileImageUrl: "" })} className="self-start text-xs text-[var(--color-on-surface-variant)] underline">
            ไม่ใช้รูปมือถือแยก
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="จัดตำแหน่งข้อความ">
            <Select value={layout.textAlign} onChange={(e) => set({ textAlign: e.target.value as BannerTextAlign })}>
              <option value="left">ซ้าย</option>
              <option value="center">กลาง</option>
              <option value="right">ขวา</option>
            </Select>
          </FormField>
          <FormField label="เฉดสีทับภาพ (ให้ตัวหนังสืออ่านง่าย)">
            <Select value={layout.overlay} onChange={(e) => set({ overlay: e.target.value as BannerOverlay })}>
              <option value="none">ไม่ใส่</option>
              <option value="soft">อ่อน (แนะนำ)</option>
              <option value="medium">กลาง</option>
            </Select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-on-surface)]">
          <input type="checkbox" checked={layout.showText} onChange={(e) => set({ showText: e.target.checked })} className="h-4 w-4" />
          แสดงหัวข้อ คำโปรย และปุ่มของเว็บทับบนรูป
          <span className="text-xs text-[var(--color-on-surface-variant)]">(ปิดถ้ารูปมีข้อความอยู่แล้ว)</span>
        </label>
      </div>
    </div>
  );
}
