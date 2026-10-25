"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Link as LinkIcon, Loader2, Trash2, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/utils/ids";
import { toastError, toastSuccess } from "@/lib/toast";

interface FeedItem {
  id: string;
  video_url: string;
  poster_url: string;
  product_id: string | null;
  /** Which brand's section on the home page the clip sits under (null → first brand). */
  brand_id: string | null;
  caption: string;
  sort_order: number;
  active: boolean;
}

const MAX_ITEMS = 8;
const MAX_SIZE = 30 * 1024 * 1024; // 30MB
const BUCKET = "storefront-assets";

type Platform = "tiktok" | "instagram" | "youtube" | "facebook";
const PLATFORM_LABEL: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook" };

/**
 * Where a pasted link points. Mirrors the storefront's parser
 * (issa-storefront/src/lib/video-embed.ts): platform links play in that
 * platform's embed; anything else must be a direct video file.
 */
function detectLink(raw: string): { kind: Platform | "file"; url: string } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "ลิงก์ไม่ถูกต้อง — ต้องขึ้นต้นด้วย https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "ลิงก์ต้องขึ้นต้นด้วย https://" };
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\.|^vm\.|^vt\./, "");
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return { kind: "tiktok", url: url.toString() };
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    if (!/\/(reel|reels|p|tv)\/[^/]+/.test(url.pathname)) return { error: "ลิงก์ Instagram ต้องเป็นลิงก์ของโพสต์/Reel (มี /reel/… หรือ /p/…) ไม่ใช่หน้าโปรไฟล์" };
    return { kind: "instagram", url: url.toString() };
  }
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
    const hasId = host === "youtu.be" || url.searchParams.get("v") || /\/(shorts|embed|live)\/[^/]+/.test(url.pathname);
    if (!hasId) return { error: "ลิงก์ YouTube ต้องเป็นลิงก์ของคลิป (youtube.com/shorts/… หรือ youtu.be/…) ไม่ใช่หน้าช่อง" };
    return { kind: "youtube", url: url.toString() };
  }
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch" || host === "fb.com") {
    return { kind: "facebook", url: url.toString() };
  }
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.pathname + url.search)) return { kind: "file", url: url.toString() };
  return {
    error: "รองรับเฉพาะลิงก์ TikTok, Instagram, YouTube, Facebook หรือลิงก์ไฟล์วิดีโอโดยตรง (.mp4) — ลิงก์จาก Google Drive/Dropbox ใช้ไม่ได้ ให้อัปโหลดไฟล์แทน",
  };
}

function platformOf(videoUrl: string): Platform | null {
  const d = detectLink(videoUrl);
  if ("error" in d || d.kind === "file") return null;
  return d.kind;
}

/** Returns null (after toasting) when the query fails. */
async function loadFeedItems(): Promise<FeedItem[] | null> {
  const { data, error } = await createClient()
    .from("storefront_feed_items")
    .select("id, video_url, poster_url, product_id, brand_id, caption, sort_order, active")
    .order("sort_order")
    .order("created_at");
  if (error) {
    toastError("โหลดวิดีโอไม่สำเร็จ: " + error.message);
    return null;
  }
  return (data ?? []) as FeedItem[];
}

/**
 * "Shop the Feed" videos on the storefront homepage — short styling clips,
 * each optionally linked to a product. Like FitCoversCard this is a narrow
 * admin utility outside the app's Zustand state, so it talks to Supabase
 * directly (table storefront_feed_items, public view *_public for the site).
 */
export function FeedVideosCard() {
  const state = useStore();
  const products = Object.values(state.products)
    .filter((p) => p.status === "active")
    .sort((a, b) => a.sellingName.localeCompare(b.sellingName, "th"));
  const brands = Object.values(state.brands).filter((b) => b.active);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const rows = await loadFeedItems();
    if (rows) setItems(rows);
  }

  useEffect(() => {
    let cancelled = false;
    loadFeedItems().then((rows) => {
      if (cancelled) return;
      if (rows) setItems(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function patch(id: string, changes: Partial<FeedItem>, successMessage?: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
    const { error } = await createClient()
      .from("storefront_feed_items")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toastError("บันทึกไม่สำเร็จ: " + error.message);
      await reload();
    } else if (successMessage) {
      toastSuccess(successMessage);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toastError(`ไฟล์ "${file.name}" ไม่ใช่วิดีโอ`);
      return;
    }
    if (file.size > MAX_SIZE) {
      toastError(`ไฟล์ "${file.name}" มีขนาดเกิน 30MB — ย่อไฟล์ก่อน (คลิปสั้น 10–20 วินาที กำลังดี)`);
      return;
    }
    if (items.length >= MAX_ITEMS) {
      toastError(`ใส่ได้สูงสุด ${MAX_ITEMS} คลิป — ลบคลิปเก่าก่อน`);
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `feed/${newId()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error: insertError } = await supabase
        .from("storefront_feed_items")
        .insert({ video_url: data.publicUrl, sort_order: nextOrder });
      if (insertError) throw insertError;
      await reload();
      toastSuccess("อัปโหลดวิดีโอแล้ว — เลือกสินค้าที่เกี่ยวข้องด้านล่าง จะขึ้นเว็บภายในไม่เกิน 1 นาที");
    } catch (e) {
      toastError(e instanceof Error ? `อัปโหลดไม่สำเร็จ: ${e.message}` : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function handleLink() {
    const detected = detectLink(link);
    if ("error" in detected) {
      toastError(detected.error);
      return;
    }
    if (items.length >= MAX_ITEMS) {
      toastError(`ใส่ได้สูงสุด ${MAX_ITEMS} คลิป — ลบคลิปเก่าก่อน`);
      return;
    }
    if (items.some((it) => it.video_url === detected.url)) {
      toastError("ลิงก์นี้อยู่ในรายการแล้ว");
      return;
    }
    setAddingLink(true);
    try {
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await createClient()
        .from("storefront_feed_items")
        .insert({ video_url: detected.url, sort_order: nextOrder });
      if (error) throw error;
      setLink("");
      await reload();
      const where = detected.kind === "file" ? "ไฟล์วิดีโอ" : PLATFORM_LABEL[detected.kind];
      toastSuccess(`เพิ่มคลิปจาก ${where} แล้ว — เลือกสินค้าที่เกี่ยวข้องด้านล่าง จะขึ้นเว็บภายในไม่เกิน 1 นาที`);
    } catch (e) {
      toastError(e instanceof Error ? `เพิ่มลิงก์ไม่สำเร็จ: ${e.message}` : "เพิ่มลิงก์ไม่สำเร็จ");
    } finally {
      setAddingLink(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const reordered = items.slice();
    reordered[index] = { ...b, sort_order: a.sort_order };
    reordered[target] = { ...a, sort_order: b.sort_order };
    setItems(reordered);
    const supabase = createClient();
    const [r1, r2] = await Promise.all([
      supabase.from("storefront_feed_items").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("storefront_feed_items").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      toastError("สลับลำดับไม่สำเร็จ: " + (r1.error ?? r2.error)?.message);
      await reload();
    }
  }

  async function remove(item: FeedItem) {
    setPendingDelete(null);
    const supabase = createClient();
    const { error } = await supabase.from("storefront_feed_items").delete().eq("id", item.id);
    if (error) {
      toastError("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    // Best effort: also remove the file so storage doesn't fill up. Ignore failures.
    const marker = `/object/public/${BUCKET}/`;
    const idx = item.video_url.indexOf(marker);
    if (idx >= 0) {
      const path = decodeURIComponent(item.video_url.slice(idx + marker.length));
      await supabase.storage.from(BUCKET).remove([path]);
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    toastSuccess("ลบวิดีโอแล้ว");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>วิดีโอ &quot;Shop the Feed&quot; (หน้าแรกของเว็บ)</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          คลิปสั้นแนวตั้ง (9:16) แบบ TikTok/Reels สูงสุด {MAX_ITEMS} คลิป — อัปโหลดไฟล์ MP4 (ไม่เกิน 30MB) หรือวางลิงก์คลิปจาก TikTok / Instagram / YouTube Shorts / Facebook ก็ได้ ถ้ายังไม่มีคลิป เว็บจะซ่อนส่วนนี้ให้เอง
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLink();
              }
            }}
            placeholder="วางลิงก์คลิป เช่น https://www.tiktok.com/@issa/video/… หรือ https://youtube.com/shorts/…"
            className="flex-1"
          />
          <button
            type="button"
            disabled={addingLink || !link.trim() || items.length >= MAX_ITEMS}
            onClick={handleLink}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary-container)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
            เพิ่มจากลิงก์
          </button>
        </div>
        <p className="-mt-3 text-xs text-[var(--color-on-surface-variant)]">
          คลิปจากลิงก์จะเล่นผ่านกล่องของแพลตฟอร์มนั้นบนเว็บ (ลูกค้ากดเล่นได้ในหน้าเว็บเรา) ส่วนคลิปที่อัปโหลดเองจะเล่นอัตโนมัติเมื่อชี้เมาส์
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={uploading || items.length >= MAX_ITEMS}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            {uploading ? "กำลังอัปโหลด..." : "เพิ่มวิดีโอ"}
          </button>
          <span className="text-xs text-[var(--color-on-surface-variant)]">
            {items.length}/{MAX_ITEMS} คลิป
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีวิดีโอ — กด &quot;เพิ่มวิดีโอ&quot; เพื่ออัปโหลดคลิปแรก</p>
        )}

        {items.map((item, index) => (
          <div
            key={item.id}
            className={`flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row ${item.active ? "" : "opacity-60"}`}
          >
            {platformOf(item.video_url) ? (
              <a
                href={item.video_url}
                target="_blank"
                rel="noreferrer"
                title={item.video_url}
                className="flex h-44 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-md bg-[var(--color-primary)] px-2 text-center text-white sm:w-28"
              >
                <LinkIcon className="h-5 w-5 opacity-80" />
                <span className="text-xs font-semibold">{PLATFORM_LABEL[platformOf(item.video_url)!]}</span>
                <span className="text-[10px] opacity-70">เปิดลิงก์</span>
              </a>
            ) : (
              <video
                src={item.video_url}
                poster={item.poster_url || undefined}
                controls
                muted
                playsInline
                preload="metadata"
                className="h-44 w-full shrink-0 rounded-md bg-black object-contain sm:w-28"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                  สินค้าที่อยู่ในคลิป (ลูกค้ากดแล้วไปหน้าสินค้านี้)
                  <Select
                    value={item.product_id ?? ""}
                    onChange={(e) => {
                      const productId = e.target.value || null;
                      const productBrand = productId ? state.products[productId]?.brandId : undefined;
                      // First product pick also files the clip under that product's brand.
                      const changes: Partial<FeedItem> = { product_id: productId };
                      if (!item.brand_id && productBrand) changes.brand_id = productBrand;
                      patch(item.id, changes, "บันทึกสินค้าของคลิปแล้ว");
                    }}
                  >
                    <option value="">— ไม่ผูกสินค้า —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sellingName}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                  อยู่ใต้ส่วนของแบรนด์ (บนหน้าแรก)
                  <Select
                    value={item.brand_id ?? ""}
                    onChange={(e) => patch(item.id, { brand_id: e.target.value || null }, "บันทึกแบรนด์ของคลิปแล้ว")}
                  >
                    <option value="">— ไม่ระบุ (ไปอยู่ใต้แบรนด์แรก) —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                คำบรรยายสั้น ๆ (ไม่บังคับ)
                <Input
                  defaultValue={item.caption}
                  placeholder="เช่น ลุคไปทำงานวันจันทร์"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next !== item.caption) patch(item.id, { caption: next }, "บันทึกคำบรรยายแล้ว");
                  }}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface-container)] disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" /> เลื่อนขึ้น
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface-container)] disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" /> เลื่อนลง
                </button>
                <button
                  type="button"
                  onClick={() => patch(item.id, { active: !item.active }, item.active ? "ซ่อนคลิปนี้จากเว็บแล้ว" : "แสดงคลิปนี้บนเว็บแล้ว")}
                  className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface-container)]"
                >
                  {item.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {item.active ? "ซ่อน" : "แสดง"}
                </button>
                {pendingDelete === item.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="rounded bg-[var(--color-danger)] px-2 py-1 text-white"
                    >
                      ยืนยันลบ
                    </button>
                    <button type="button" onClick={() => setPendingDelete(null)} className="px-2 py-1 underline">
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(item.id)}
                    className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-danger)] hover:bg-[var(--color-surface-container)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ลบ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
