"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/toast";

/** Icon the storefront shows for a channel. "link" is a generic chain icon. */
export const CHANNEL_PLATFORMS: { value: string; label: string; placeholder: string }[] = [
  { value: "line", label: "LINE", placeholder: "https://lin.ee/xxxxx" },
  { value: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/xxxxx" },
  { value: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/xxxxx" },
  { value: "tiktok", label: "TikTok", placeholder: "https://www.tiktok.com/@xxxxx" },
  { value: "shopee", label: "Shopee", placeholder: "https://shopee.co.th/xxxxx" },
  { value: "lazada", label: "Lazada", placeholder: "https://www.lazada.co.th/shop/xxxxx" },
  { value: "line-shopping", label: "LINE Shopping / MyShop", placeholder: "https://shop.line.me/@xxxxx" },
  { value: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@xxxxx" },
  { value: "link", label: "อื่น ๆ (ไอคอนลิงก์)", placeholder: "https://..." },
];

interface ChannelRow {
  id: string;
  platform: string;
  label: string;
  url: string;
  sort_order: number;
  active: boolean;
  /** true for rows added in this session and not yet saved */
  isNew?: boolean;
}

async function loadChannels(): Promise<ChannelRow[] | null> {
  const { data, error } = await createClient()
    .from("storefront_channels")
    .select("id, platform, label, url, sort_order, active")
    .order("sort_order")
    .order("created_at");
  if (error) {
    toastError("โหลดช่องทางไม่สำเร็จ: " + error.message);
    return null;
  }
  return (data ?? []) as ChannelRow[];
}

function defaultLabel(platform: string) {
  const p = CHANNEL_PLATFORMS.find((x) => x.value === platform);
  return p && p.value !== "link" ? p.label.replace(" / MyShop", "") : "";
}

/**
 * Editable list of contact / sales channels shown in the storefront footer
 * and Contact page (table storefront_channels). Edits are kept locally
 * until "บันทึกช่องทาง" so the owner can reorder/add/remove in one go.
 */
export function ChannelsEditor() {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadChannels().then((data) => {
      if (cancelled) return;
      if (data) setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(id: string, changes: Partial<ChannelRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    setDirty(true);
  }

  function add() {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    setRows((prev) => [...prev, { id, platform: "link", label: "", url: "", sort_order: prev.length, active: true, isNew: true }]);
    setDirty(true);
  }

  function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    const row = rows.find((r) => r.id === id);
    if (row && !row.isNew) setRemoved((prev) => [...prev, id]);
    setDirty(true);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setDirty(true);
  }

  async function save() {
    const cleaned = rows.map((r, i) => ({
      ...r,
      label: r.label.trim() || defaultLabel(r.platform) || "ลิงก์",
      url: r.url.trim(),
      sort_order: i,
    }));
    const missingUrl = cleaned.find((r) => r.url === "");
    if (missingUrl) {
      toastError(`ช่อง "${missingUrl.label}" ยังไม่ได้ใส่ลิงก์ — ใส่ลิงก์หรือลบช่องนั้นออกก่อนบันทึก`);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const upsertRows = cleaned.map(({ id, platform, label, url, sort_order, active }) => ({
      id,
      platform,
      label,
      url,
      sort_order,
      active,
      updated_at: now,
    }));
    const { error: upsertError } = await supabase.from("storefront_channels").upsert(upsertRows);
    const { error: deleteError } =
      removed.length > 0 ? await supabase.from("storefront_channels").delete().in("id", removed) : { error: null };
    setSaving(false);
    if (upsertError || deleteError) {
      toastError("บันทึกช่องทางไม่สำเร็จ: " + (upsertError ?? deleteError)?.message);
      return;
    }
    setRows(cleaned.map((r) => ({ ...r, isNew: false })));
    setRemoved([]);
    setDirty(false);
    toastSuccess("บันทึกช่องทางแล้ว — จะขึ้นเว็บภายในไม่เกิน 1 นาที");
  }

  return (
    <div className="mt-2 border-t border-[var(--color-outline-variant)] pt-4">
      <p className="mb-1 text-sm font-medium text-[var(--color-on-surface)]">ช่องทางติดต่อและช่องทางขาย (แสดงที่หน้า Contact และท้ายเว็บ)</p>
      <p className="mb-3 text-xs text-[var(--color-on-surface-variant)]">
        เพิ่ม ลบ หรือสลับลำดับได้เอง เลือก &quot;ไอคอน&quot; ให้ตรงแพลตฟอร์ม ชื่อที่แสดงจะใช้ชื่อแพลตฟอร์มถ้าเว้นว่าง
      </p>

      {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const platform = CHANNEL_PLATFORMS.find((p) => p.value === row.platform) ?? CHANNEL_PLATFORMS[CHANNEL_PLATFORMS.length - 1];
          return (
            <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-[170px_1fr_1.6fr_auto] sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                ไอคอน
                <Select
                  value={row.platform}
                  onChange={(e) => {
                    const next = e.target.value;
                    const keepLabel = row.label.trim() !== "" && row.label !== defaultLabel(row.platform);
                    update(row.id, { platform: next, label: keepLabel ? row.label : defaultLabel(next) });
                  }}
                >
                  {CHANNEL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                ชื่อที่แสดง
                <Input value={row.label} placeholder={defaultLabel(row.platform) || "เช่น เว็บไซต์หลัก"} onChange={(e) => update(row.id, { label: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
                ลิงก์
                <Input value={row.url} placeholder={platform.placeholder} onChange={(e) => update(row.id, { url: e.target.value })} />
              </label>
              <div className="flex items-center gap-1 pb-0.5">
                <button
                  type="button"
                  aria-label="เลื่อนขึ้น"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-surface-container)] disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="เลื่อนลง"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  className="rounded border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-surface-container)] disabled:opacity-40"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="ลบช่องทางนี้"
                  onClick={() => remove(row.id)}
                  className="rounded border border-[var(--color-border)] p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface-container)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && rows.length === 0 && (
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีช่องทาง — กด &quot;เพิ่มช่องทาง&quot;</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
        >
          <Plus className="h-4 w-4" /> เพิ่มช่องทาง
        </button>
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "กำลังบันทึก..." : "บันทึกช่องทาง"}
        </Button>
        {dirty && !saving && <span className="text-xs text-[var(--color-on-surface-variant)]">มีการแก้ไขที่ยังไม่ได้บันทึก</span>}
      </div>
    </div>
  );
}
