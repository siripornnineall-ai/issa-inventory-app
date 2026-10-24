"use client";

import type { MouseEvent } from "react";
import { FormField, Select } from "@/components/ui/Field";
import { SingleImageUploader } from "@/components/ui/SingleImageUploader";
import type { BannerLayout, BannerOverlay, BannerTextAlign } from "@/lib/types";

/** Copy shown in the preview (the banner's own heading/tagline fields live elsewhere on the page). */
export interface BannerPreviewCopy {
  line1: string;
  line2: string;
  tagline: string;
  button: string;
}

const OVERLAY_CLASS: Record<BannerOverlay, string> = {
  none: "",
  soft: "bg-gradient-to-t from-black/45 via-black/5 to-transparent",
  medium: "bg-gradient-to-t from-black/65 via-black/20 to-transparent",
};

const ALIGN_CLASS: Record<BannerTextAlign, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

function Preview({
  src,
  layout,
  copy,
  frame,
  onPick,
}: {
  src: string;
  layout: BannerLayout;
  copy: BannerPreviewCopy;
  frame: "desktop" | "mobile";
  onPick?: (x: number, y: number) => void;
}) {
  const position = `${layout.focusX}% ${layout.focusY}%`;
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPick(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100));
  };
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-[var(--color-on-surface-variant)]">
        {frame === "desktop" ? "คอมพิวเตอร์ (ตัวอย่าง)" : "มือถือ (ตัวอย่าง)"}
        {onPick && " — คลิกบนรูปเพื่อตั้งจุดสำคัญ"}
      </p>
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-[var(--color-surface-container)] ${frame === "desktop" ? "aspect-[21/9]" : "mx-auto max-w-[220px] aspect-[4/5]"} ${onPick ? "cursor-crosshair" : ""}`}
        onClick={handleClick}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--color-on-surface-variant)]">ยังไม่มีรูป</div>
        )}
        {layout.showText && <div className={`absolute inset-0 ${OVERLAY_CLASS[layout.overlay]}`} />}
        {layout.showText && (
          <div className={`absolute inset-0 flex flex-col justify-end p-3 text-white ${ALIGN_CLASS[layout.textAlign]} ${frame === "desktop" ? "p-5" : ""}`}>
            <span className="mb-1.5 block h-0.5 w-6 bg-[#fae6cd]" />
            <p className={`font-medium leading-tight ${frame === "desktop" ? "text-base" : "text-sm"}`}>
              {copy.line1}
              {copy.line1 && copy.line2 && <br />}
              {copy.line2}
            </p>
            {copy.tagline && <p className="mt-1 text-[10px] text-white/85">{copy.tagline}</p>}
            <span className="mt-2 inline-block rounded bg-white px-2 py-1 text-[10px] font-semibold text-[#002228]">{copy.button}</span>
          </div>
        )}
        {onPick && src && (
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
            style={{ left: `${layout.focusX}%`, top: `${layout.focusY}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Settings UI for one storefront banner (hero or promo): desktop + mobile
 * image, focal point, text alignment, show/hide the website's own text,
 * overlay strength — with a live desktop/mobile preview so the owner can
 * check nothing important is cropped before saving.
 */
export function BannerEditor({
  title,
  folder,
  imageUrl,
  onImageChange,
  layout,
  onLayoutChange,
  copy,
}: {
  title: string;
  folder: string;
  imageUrl: string;
  onImageChange: (url: string) => void;
  layout: BannerLayout;
  onLayoutChange: (next: BannerLayout) => void;
  copy: BannerPreviewCopy;
}) {
  const set = (patch: Partial<BannerLayout>) => onLayoutChange({ ...layout, ...patch });
  const mobileSrc = layout.mobileImageUrl || imageUrl;

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="mb-3 text-sm font-semibold text-[var(--color-on-surface)]">{title}</p>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
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
          <div className="grid grid-cols-2 gap-3">
            <FormField label={`จุดสำคัญแนวนอน ${layout.focusX}%`}>
              <input type="range" min={0} max={100} value={layout.focusX} onChange={(e) => set({ focusX: Number(e.target.value) })} className="w-full" />
            </FormField>
            <FormField label={`จุดสำคัญแนวตั้ง ${layout.focusY}%`}>
              <input type="range" min={0} max={100} value={layout.focusY} onChange={(e) => set({ focusY: Number(e.target.value) })} className="w-full" />
            </FormField>
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            จุดสำคัญคือส่วนของรูปที่ต้องเห็นเสมอ (เช่น หน้านางแบบ) เมื่อจอมีสัดส่วนต่างจากรูป ระบบจะครอปรอบจุดนี้
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Preview src={imageUrl} layout={layout} copy={copy} frame="desktop" onPick={(x, y) => set({ focusX: x, focusY: y })} />
          <Preview src={mobileSrc} layout={layout} copy={copy} frame="mobile" />
        </div>
      </div>
    </div>
  );
}
