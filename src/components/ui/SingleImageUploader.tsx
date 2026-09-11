"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { newId } from "@/lib/utils/ids";
import { toastError } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadToStorage(file: File, bucket: string, folder: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${newId()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Single-image field (one URL, not a list) for storefront/brand assets —
 *  hero banner, promo banner, per-fit cover photos, brand logos.
 *  Defaults to the "storefront-assets" bucket (public read, admin/manager write). */
export function SingleImageUploader({
  value,
  onChange,
  folder,
  bucket = "storefront-assets",
  label,
  hint = "PNG, JPG ขนาดไม่เกิน 5MB",
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  bucket?: string;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastError(`ไฟล์ "${file.name}" ไม่ใช่รูปภาพ`);
      return;
    }
    if (file.size > MAX_SIZE) {
      toastError(`ไฟล์ "${file.name}" มีขนาดเกิน 5MB`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToStorage(file, bucket, folder);
      onChange(url);
    } catch (e) {
      toastError(e instanceof Error ? `อัปโหลดไม่สำเร็จ: ${e.message}` : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-sm font-medium text-[var(--color-on-surface)]">{label}</p>}
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container)]">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label ?? "รูปภาพ"} className="h-full w-full object-cover" />
          )}
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {hint && <p className="text-xs text-[var(--color-on-surface-variant)]">{hint}</p>}
    </div>
  );
}
