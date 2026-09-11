"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { SingleImageUploader } from "@/components/ui/SingleImageUploader";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/toast";

interface FitCoverRow {
  shape_label: string;
  image_url: string;
  alt_text: string | null;
}

/**
 * "Find Your Perfect Fit" cover photos on the storefront homepage — one
 * photo per pant shape. Lives in its own small table (storefront_fit_covers)
 * outside the app's usual Zustand/write-through-sync state, since it's a
 * narrow admin utility, not core business data — so this reads/writes
 * Supabase directly instead of going through useActions().
 */
export function FitCoversCard() {
  const state = useStore();
  const fits = Object.values(state.productShapeOptions)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.label);

  const [covers, setCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("storefront_fit_covers")
      .select("shape_label, image_url, alt_text")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toastError("โหลดรูปคู่ทรงไม่สำเร็จ: " + error.message);
        } else {
          const map: Record<string, string> = {};
          for (const row of (data ?? []) as FitCoverRow[]) map[row.shape_label] = row.image_url;
          setCovers(map);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setCover(shapeLabel: string, url: string) {
    setCovers((prev) => ({ ...prev, [shapeLabel]: url }));
    const { error } = await createClient()
      .from("storefront_fit_covers")
      .upsert({ shape_label: shapeLabel, image_url: url, alt_text: shapeLabel, updated_at: new Date().toISOString() });
    if (error) {
      toastError("บันทึกรูปไม่สำเร็จ: " + error.message);
    } else {
      toastSuccess(`บันทึกรูปของ "${shapeLabel}" แล้ว — จะขึ้นเว็บภายในไม่เกิน 1 นาที`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>รูปคู่ทรงกางเกง (หน้า &quot;Find Your Perfect Fit&quot;)</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          เลือกรูปที่จะใช้แทนแต่ละทรงบนหน้าแรกของเว็บลูกค้า — ถ้าทรงไหนยังไม่ตั้งรูป ระบบจะเลือกรูปสินค้าตัวแรกที่เจอในทรงนั้นให้อัตโนมัติ
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 pt-0">
        {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
        {!loading && fits.length === 0 && (
          <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีทรงกางเกงในระบบ — เพิ่มทรงได้จากฟอร์มสินค้า</p>
        )}
        {!loading &&
          fits.map((fit) => (
            <SingleImageUploader
              key={fit}
              label={fit}
              value={covers[fit] ?? ""}
              onChange={(url) => setCover(fit, url)}
              folder="fit-covers"
              hint="ถ้าไม่ตั้ง จะใช้รูปสินค้าตัวแรกในทรงนี้แทน"
            />
          ))}
      </CardContent>
    </Card>
  );
}
