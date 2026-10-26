"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { SingleImageUploader } from "@/components/ui/SingleImageUploader";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/utils/ids";
import { toastError, toastSuccess } from "@/lib/toast";

interface Slide {
  id: string;
  brand_id: string;
  image_url: string;
  mobile_image_url: string;
  link_url: string;
  sort_order: number;
  active: boolean;
}

const BUCKET = "storefront-assets";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PER_BRAND = 8;
/** Same order as the storefront's brand sections. */
const BRAND_ORDER = ["ISSA Apparel", "ISSA Activewear", "Fasonaf"];

async function loadSlides(): Promise<Slide[] | null> {
  const { data, error } = await createClient().from("storefront_brand_slides").select("*").order("sort_order").order("created_at");
  if (error) {
    toastError("โหลดสไลด์ไม่สำเร็จ: " + error.message);
    return null;
  }
  return (data ?? []) as Slide[];
}

/**
 * Image slider per brand on the storefront home page — a carousel that
 * sits in the middle of that brand's "Shop the Feed" clips (after the
 * first row). Writes Supabase directly like the other storefront-content
 * cards (table storefront_brand_slides, public view *_public for the site).
 */
export function BrandSlidesCard() {
  const state = useStore();
  const brands = Object.values(state.brands)
    .filter((b) => b.active)
    .sort((a, b) => {
      const ia = BRAND_ORDER.indexOf(a.name);
      const ib = BRAND_ORDER.indexOf(b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
    });

  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  /** Collapsed/expanded per brand; all collapsed at first, like the video card. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const allOpen = brands.length > 0 && brands.every((b) => open[b.id]);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function reload() {
    const rows = await loadSlides();
    if (rows) setSlides(rows);
  }

  useEffect(() => {
    let cancelled = false;
    loadSlides().then((rows) => {
      if (cancelled) return;
      if (rows) setSlides(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function patch(id: string, changes: Partial<Slide>, successMessage?: string) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    const { error } = await createClient().from("storefront_brand_slides").update(changes).eq("id", id);
    if (error) {
      toastError("บันทึกไม่สำเร็จ: " + error.message);
      await reload();
    } else if (successMessage) {
      toastSuccess(successMessage);
    }
  }

  async function handleFile(brandId: string, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastError(`ไฟล์ "${file.name}" ไม่ใช่รูปภาพ`);
      return;
    }
    if (file.size > MAX_SIZE) {
      toastError(`ไฟล์ "${file.name}" มีขนาดเกิน 5MB`);
      return;
    }
    const mine = slides.filter((s) => s.brand_id === brandId);
    if (mine.length >= MAX_PER_BRAND) {
      toastError(`ใส่ได้สูงสุด ${MAX_PER_BRAND} รูปต่อแบรนด์ — ลบรูปเก่าก่อน`);
      return;
    }
    setUploadingFor(brandId);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `brand-slides/${brandId}/${newId()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const nextOrder = mine.length ? Math.max(...mine.map((s) => s.sort_order)) + 1 : 0;
      const { error: insertError } = await supabase
        .from("storefront_brand_slides")
        .insert({ brand_id: brandId, image_url: data.publicUrl, sort_order: nextOrder });
      if (insertError) throw insertError;
      await reload();
      setOpen((prev) => ({ ...prev, [brandId]: true }));
      toastSuccess("เพิ่มรูปสไลด์แล้ว — ขึ้นเว็บภายในไม่เกิน 1 นาที");
    } catch (e) {
      toastError(e instanceof Error ? `อัปโหลดไม่สำเร็จ: ${e.message}` : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploadingFor(null);
    }
  }

  async function move(group: Slide[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= group.length) return;
    const a = group[index];
    const b = group[target];
    setSlides((prev) =>
      prev
        .map((s) => (s.id === a.id ? { ...s, sort_order: b.sort_order } : s.id === b.id ? { ...s, sort_order: a.sort_order } : s))
        .sort((x, y) => x.sort_order - y.sort_order),
    );
    const supabase = createClient();
    const [r1, r2] = await Promise.all([
      supabase.from("storefront_brand_slides").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("storefront_brand_slides").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      toastError("สลับลำดับไม่สำเร็จ: " + (r1.error ?? r2.error)?.message);
      await reload();
    }
  }

  async function remove(slide: Slide) {
    setPendingDelete(null);
    const supabase = createClient();
    const { error } = await supabase.from("storefront_brand_slides").delete().eq("id", slide.id);
    if (error) {
      toastError("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    const marker = `/object/public/${BUCKET}/`;
    for (const url of [slide.image_url, slide.mobile_image_url]) {
      const idx = url.indexOf(marker);
      if (idx >= 0) await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(idx + marker.length))]);
    }
    setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    toastSuccess("ลบรูปสไลด์แล้ว");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>สไลด์รูปของแต่ละแบรนด์ (คั่นกลางวิดีโอบนหน้าแรก)</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          รูปเลื่อนอัตโนมัติ มีลูกศรและจุดให้กด อยู่กลางส่วนวิดีโอของแบรนด์นั้น (หลังวิดีโอแถวแรก) สูงสุด {MAX_PER_BRAND} รูปต่อแบรนด์ —
          ใช้รูปขนาดเดียวกันทุกรูป (แนะนำ 2400×1000 แนวนอน) เพื่อให้สไลด์สูงเท่ากันและไม่ถูกครอป ใส่ลิงก์ให้แต่ละรูปได้ ถ้าไม่มีรูป เว็บจะไม่แสดงสไลด์
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
        {!loading && brands.length > 0 && (
          <div className="flex items-center justify-between text-xs text-[var(--color-on-surface-variant)]">
            <span>{slides.length} รูปรวมทุกแบรนด์</span>
            <button
              type="button"
              onClick={() => setOpen(Object.fromEntries(brands.map((b) => [b.id, !allOpen])))}
              className="underline"
            >
              {allOpen ? "พับทั้งหมด" : "ขยายทั้งหมด"}
            </button>
          </div>
        )}
        {!loading &&
          brands.map((b) => {
            const mine = slides.filter((s) => s.brand_id === b.id);
            const isOpen = Boolean(open[b.id]);
            return (
              <div key={b.id} className="rounded-lg border border-[var(--color-border)]">
                <div className="flex items-center gap-3 pr-3">
                  <button
                    type="button"
                    onClick={() => setOpen((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
                    className="flex flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                  >
                    <span className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {b.name}
                      <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">{mine.length}/{MAX_PER_BRAND} รูป</span>
                    </span>
                    <span className="text-xs font-normal text-[var(--color-on-surface-variant)] underline">{isOpen ? "พับ" : "ขยาย"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={uploadingFor === b.id || mine.length >= MAX_PER_BRAND}
                    onClick={() => inputRefs.current[b.id]?.click()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-3 py-1.5 text-sm text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingFor === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    เพิ่มรูปสไลด์
                  </button>
                  <input
                    ref={(el) => {
                      inputRefs.current[b.id] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleFile(b.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-3">
                    {mine.length === 0 && <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีรูป — กด &quot;เพิ่มรูปสไลด์&quot;</p>}
                    {mine.map((s, index) => (
                      <div key={s.id} className={`flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row ${s.active ? "" : "opacity-60"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image_url} alt="" className="h-28 w-full shrink-0 rounded-md bg-[var(--color-surface-container)] object-cover sm:w-56" />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                            ลิงก์เมื่อกดรูป (ไม่บังคับ) — เช่น /collections/brand-{encodeURIComponent(b.name)} หรือ https://…
                            <Input
                              defaultValue={s.link_url}
                              placeholder="/collections/all"
                              onBlur={(e) => {
                                const next = e.target.value.trim();
                                if (next !== s.link_url) patch(s.id, { link_url: next }, "บันทึกลิงก์แล้ว");
                              }}
                            />
                          </label>
                          <SingleImageUploader
                            label="รูปสำหรับมือถือ (แนวตั้ง ไม่บังคับ — ไม่ใส่จะใช้รูปเดียวกัน)"
                            value={s.mobile_image_url}
                            onChange={(url) => patch(s.id, { mobile_image_url: url }, "บันทึกรูปมือถือแล้ว")}
                            folder={`brand-slides/${b.id}/mobile`}
                          />
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => move(mine, index, -1)}
                              disabled={index === 0}
                              className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface-container)] disabled:opacity-40"
                            >
                              <ArrowUp className="h-3.5 w-3.5" /> เลื่อนขึ้น
                            </button>
                            <button
                              type="button"
                              onClick={() => move(mine, index, 1)}
                              disabled={index === mine.length - 1}
                              className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface-container)] disabled:opacity-40"
                            >
                              <ArrowDown className="h-3.5 w-3.5" /> เลื่อนลง
                            </button>
                            <button
                              type="button"
                              onClick={() => patch(s.id, { active: !s.active }, s.active ? "ซ่อนรูปนี้จากเว็บแล้ว" : "แสดงรูปนี้บนเว็บแล้ว")}
                              className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface-container)]"
                            >
                              {s.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {s.active ? "ซ่อน" : "แสดง"}
                            </button>
                            {pendingDelete === s.id ? (
                              <>
                                <button type="button" onClick={() => remove(s)} className="rounded bg-[var(--color-danger)] px-2 py-1 text-white">
                                  ยืนยันลบ
                                </button>
                                <button type="button" onClick={() => setPendingDelete(null)} className="px-2 py-1 underline">
                                  ยกเลิก
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDelete(s.id)}
                                className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-danger)] hover:bg-[var(--color-surface-container)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> ลบ
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
