"use client";

import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2, GripVertical, ImageOff, Expand, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ProductImage } from "@/lib/types";
import { newId } from "@/lib/utils/ids";
import { toastError } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { ImageLightbox } from "./ImageLightbox";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB ต่อไฟล์ (จำลองขีดจำกัดจริง)

// อัปโหลดไฟล์จริงขึ้น Supabase Storage แล้วเก็บแค่ URL สาธารณะไว้ในฐานข้อมูล
// (เดิมเก็บเป็น base64 ตรงในคอลัมน์ url ทำให้ตาราง product_images บวมจนโหลดข้อมูลทั้งระบบช้า/timeout)
async function uploadToStorage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${newId()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export function ImageUploader({
  images,
  onChange,
  kind,
  label = "รูปภาพ",
  hint = "PNG, JPG ขนาดไม่เกิน 5MB",
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  kind: "source" | "selling";
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewImg, setPreviewImg] = useState<ProductImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const additions: ProductImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toastError(`ไฟล์ "${file.name}" ไม่ใช่รูปภาพ`);
          continue;
        }
        if (file.size > MAX_SIZE) {
          toastError(`ไฟล์ "${file.name}" มีขนาดเกิน 5MB`);
          continue;
        }
        try {
          const url = await uploadToStorage(file);
          additions.push({ id: newId(), url, isMain: false, sortOrder: images.length + additions.length, kind });
        } catch (e) {
          toastError(e instanceof Error ? `อัปโหลด "${file.name}" ไม่สำเร็จ: ${e.message}` : `อัปโหลด "${file.name}" ไม่สำเร็จ`);
        }
      }
      if (additions.length === 0) return;
      const merged = [...images, ...additions];
      if (!merged.some((i) => i.isMain)) merged[0].isMain = true;
      onChange(merged);
    } finally {
      setUploading(false);
    }
  }

  function setMain(id: string) {
    onChange(images.map((i) => ({ ...i, isMain: i.id === id })));
  }

  function remove(id: string) {
    const rest = images.filter((i) => i.id !== id);
    if (rest.length > 0 && !rest.some((i) => i.isMain)) rest[0].isMain = true;
    onChange(rest);
  }

  function move(id: string, direction: -1 | 1) {
    const idx = images.findIndex((i) => i.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((img, i) => ({ ...img, sortOrder: i })));
  }

  // ลากรูปไปวางบนรูปอื่นเพื่อย้ายตำแหน่ง: รูปที่ลากไปอยู่ตำแหน่งของรูปที่วางทับ ที่เหลือขยับตาม
  function dropOn(targetId: string) {
    const fromId = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (!fromId || fromId === targetId) return;
    const from = images.findIndex((i) => i.id === fromId);
    const to = images.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((img, i) => ({ ...img, sortOrder: i })));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--color-on-surface)]">{label}</p>
      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <div
            key={img.id}
            data-testid="image-tile"
            draggable
            onDragStart={(e) => {
              setDraggingId(img.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", img.id);
            }}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overId !== img.id) setOverId(img.id);
            }}
            onDragLeave={() => setOverId((cur) => (cur === img.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(img.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
            }}
            className={cn(
              "group relative h-28 w-28 cursor-grab overflow-hidden rounded-xl border bg-[var(--color-surface-container)] active:cursor-grabbing",
              overId === img.id && draggingId !== img.id
                ? "border-[var(--color-primary-container)] ring-4 ring-[var(--color-primary-container)]/25"
                : "border-[var(--color-border)]",
              draggingId === img.id && "opacity-40"
            )}
          >
            <button type="button" onClick={() => setPreviewImg(img)} className="block h-full w-full" title="ดูรูปขนาดใหญ่ (กดค้างแล้วลากเพื่อสลับตำแหน่ง)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="รูปสินค้า" draggable={false} className="h-full w-full object-cover" />
            </button>
            {img.isMain && (
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-[var(--color-primary-container)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Star className="h-3 w-3 fill-current" /> หลัก
              </span>
            )}
            <button
              type="button"
              onClick={() => setPreviewImg(img)}
              title="ดูรูปขนาดใหญ่"
              className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => move(img.id, -1)} title="เลื่อนไปก่อนหน้า" className="rounded p-1 text-white hover:bg-white/20">
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              {!img.isMain && (
                <button type="button" onClick={() => setMain(img.id)} title="ตั้งเป็นรูปหลัก" className="rounded p-1 text-white hover:bg-white/20">
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" onClick={() => remove(img.id)} title="ลบรูป" className="rounded p-1 text-white hover:bg-white/20">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(img.id, 1)} title="เลื่อนไปถัดไป" className="rounded p-1 text-white hover:bg-white/20">
                <GripVertical className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--color-border-strong)] text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          <span className="text-xs">{uploading ? "กำลังอัปโหลด..." : "เพิ่มรูป"}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {images.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)]">
          <ImageOff className="h-3.5 w-3.5" /> {hint}
        </p>
      )}
      {previewImg && <ImageLightbox src={previewImg.url} alt="รูปสินค้า" onClose={() => setPreviewImg(null)} />}
    </div>
  );
}
