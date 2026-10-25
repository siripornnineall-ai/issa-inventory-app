"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { BannerEditor } from "@/components/settings/BannerEditor";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/toast";
import { DEFAULT_BANNER_LAYOUT, type BannerLayout, type BannerOverlay, type BannerTextAlign } from "@/lib/types";

interface BrandBannerForm {
  imageUrl: string;
  headingLine1: string;
  headingLine2: string;
  tagline: string;
  layout: BannerLayout;
}

const EMPTY: BrandBannerForm = { imageUrl: "", headingLine1: "", headingLine2: "", tagline: "", layout: DEFAULT_BANNER_LAYOUT };

/** Same order as the storefront's brand sections. */
const BRAND_ORDER = ["ISSA Apparel", "ISSA Activewear", "Fasonaf"];
/** The main brand's banner is the site hero (edited in the storefront card), so it gets no extra banner here. */
const MAIN_BRAND = "ISSA Apparel";

interface Row {
  brand_id: string;
  image_url: string;
  mobile_image_url: string;
  heading_line1: string;
  heading_line2: string;
  tagline: string;
  text_align: string;
  show_text: boolean;
  overlay: string;
  focus_x: number;
  focus_y: number;
}

function fromRow(r: Row): BrandBannerForm {
  return {
    imageUrl: r.image_url ?? "",
    headingLine1: r.heading_line1 ?? "",
    headingLine2: r.heading_line2 ?? "",
    tagline: r.tagline ?? "",
    layout: {
      mobileImageUrl: r.mobile_image_url ?? "",
      focusX: r.focus_x ?? 50,
      focusY: r.focus_y ?? 50,
      textAlign: (r.text_align as BannerTextAlign) || "left",
      showText: r.show_text !== false,
      overlay: (r.overlay as BannerOverlay) || "soft",
    },
  };
}

function toRow(brandId: string, f: BrandBannerForm): Row & { updated_at: string } {
  return {
    brand_id: brandId,
    image_url: f.imageUrl,
    mobile_image_url: f.layout.mobileImageUrl,
    heading_line1: f.headingLine1.trim(),
    heading_line2: f.headingLine2.trim(),
    tagline: f.tagline.trim(),
    text_align: f.layout.textAlign,
    show_text: f.layout.showText,
    overlay: f.layout.overlay,
    focus_x: f.layout.focusX,
    focus_y: f.layout.focusY,
    updated_at: new Date().toISOString(),
  };
}

/**
 * One banner per brand for the storefront home page: it sits above that
 * brand's product rail (the main hero at the top of the page is edited in
 * the storefront card above). Writes Supabase directly, like the other
 * storefront-content cards (table storefront_brand_banners, public view
 * storefront_brand_banners_public — only rows with a picture).
 */
export function BrandBannersCard() {
  const state = useStore();
  const brands = Object.values(state.brands)
    .filter((b) => b.active && b.name !== MAIN_BRAND)
    .sort((a, b) => {
      const ia = BRAND_ORDER.indexOf(a.name);
      const ib = BRAND_ORDER.indexOf(b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
    });

  const [forms, setForms] = useState<Record<string, BrandBannerForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("storefront_brand_banners")
      .select("*")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toastError("โหลดแบนเนอร์แบรนด์ไม่สำเร็จ: " + error.message);
        else setForms(Object.fromEntries(((data ?? []) as Row[]).map((r) => [r.brand_id, fromRow(r)])));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(brandId: string, patch: Partial<BrandBannerForm>) {
    setForms((prev) => ({ ...prev, [brandId]: { ...(prev[brandId] ?? EMPTY), ...patch } }));
  }

  async function save(brandId: string, brandName: string) {
    setSaving(brandId);
    const { error } = await createClient().from("storefront_brand_banners").upsert(toRow(brandId, forms[brandId] ?? EMPTY));
    setSaving(null);
    if (error) toastError("บันทึกไม่สำเร็จ: " + error.message);
    else toastSuccess(`บันทึกแบนเนอร์ ${brandName} แล้ว — ขึ้นเว็บภายในไม่เกิน 1 นาที`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>แบนเนอร์ของแต่ละแบรนด์ (หน้าแรกของเว็บ)</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          แบนเนอร์เต็มความกว้างที่อยู่เหนือการ์ดสินค้าของแบรนด์นั้นบนหน้าแรก — ISSA Apparel ใช้แบนเนอร์ใหญ่บนสุดของเว็บอยู่แล้ว (แก้ที่การ์ด &quot;เว็บไซต์หน้าร้าน&quot; ด้านบน)
          แบรนด์ที่ไม่ใส่รูปจะไม่มีแบนเนอร์ แสดงเฉพาะการ์ดสินค้ากับวิดีโอ
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
        {!loading &&
          brands.map((b) => {
            const f = forms[b.id] ?? EMPTY;
            return (
              <div key={b.id} className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-base font-semibold text-[var(--color-on-surface)]">{b.name}</p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <FormField label="หัวข้อ บรรทัดที่ 1">
                    <Input value={f.headingLine1} onChange={(e) => update(b.id, { headingLine1: e.target.value })} />
                  </FormField>
                  <FormField label="หัวข้อ บรรทัดที่ 2">
                    <Input value={f.headingLine2} onChange={(e) => update(b.id, { headingLine2: e.target.value })} />
                  </FormField>
                </div>
                <FormField label="คำโปรยใต้หัวข้อ">
                  <Input value={f.tagline} onChange={(e) => update(b.id, { tagline: e.target.value })} />
                </FormField>
                <BannerEditor
                  title={`รูปแบนเนอร์ ${b.name}`}
                  folder={`brand-banner/${b.id}`}
                  imageUrl={f.imageUrl}
                  onImageChange={(url) => update(b.id, { imageUrl: url })}
                  layout={f.layout}
                  onLayoutChange={(layout) => update(b.id, { layout })}
                />
                <div className="flex items-center gap-3">
                  <Button onClick={() => save(b.id, b.name)} disabled={saving === b.id}>
                    {saving === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    บันทึกแบนเนอร์ {b.name}
                  </Button>
                  {f.imageUrl && (
                    <button type="button" onClick={() => update(b.id, { imageUrl: "" })} className="text-xs text-[var(--color-on-surface-variant)] underline">
                      เอารูปออก (กดบันทึกเพื่อซ่อนแบนเนอร์นี้)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
