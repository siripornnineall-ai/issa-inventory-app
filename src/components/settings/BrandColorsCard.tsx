"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useActions, useStore } from "@/lib/store";
import { toastError, toastSuccess } from "@/lib/toast";
import { brandColor, brandTint, isHexColor } from "@/lib/utils/brandColor";
import type { Brand } from "@/lib/types";

function BrandColorRow({ brand }: { brand: Brand }) {
  const { upsertBrand } = useActions();
  const saved = brandColor(brand);
  const [draft, setDraft] = useState(saved);
  const [hex, setHex] = useState(saved);
  const changed = draft.toLowerCase() !== saved.toLowerCase();

  function pick(value: string) {
    setHex(value);
    if (isHexColor(value)) setDraft(value);
  }

  function save() {
    try {
      upsertBrand({ id: brand.id, color: draft.toUpperCase() });
      toastSuccess(`บันทึกสี ${brand.name} เรียบร้อยแล้ว`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกสีไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="color"
        aria-label={`สีของ ${brand.name}`}
        value={draft}
        onChange={(e) => pick(e.target.value)}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--color-border)] bg-white p-1"
      />
      <input
        aria-label={`รหัสสีของ ${brand.name}`}
        value={hex}
        onChange={(e) => pick(e.target.value)}
        maxLength={7}
        spellCheck={false}
        className="h-10 w-28 rounded-lg border border-[var(--color-border)] bg-white px-3 font-mono text-sm uppercase"
      />
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold text-[var(--color-on-surface)]"
        style={{ background: brandTint(draft, 14), borderColor: brandTint(draft, 45) }}
      >
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: draft }} />
        {brand.name}
      </span>
      <Button onClick={save} disabled={!changed || !isHexColor(hex)} variant="secondary">
        บันทึก
      </Button>
    </div>
  );
}

// สีประจำแบรนด์: ใช้เป็นจุดสี/แถบสีเฉพาะตรงที่โชว์ชื่อแบรนด์ (แดชบอร์ด รายการสินค้า ออเดอร์) ไม่เปลี่ยนสีธีมของระบบ
export function BrandColorsCard() {
  const brands = Object.values(useStore((s) => s.brands)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Card>
      <CardHeader>
        <CardTitle>สีประจำแบรนด์</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          ใช้เป็นจุดสีและแถบสีตรงที่แสดงชื่อแบรนด์ เช่น แดชบอร์ด รายการสินค้า ออเดอร์ (ตั้งต้นจากสีพื้นโลโก้) ตัวอักษรยังเป็นสีปกติเพื่อให้อ่านชัด
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {brands.map((b) => (
          <BrandColorRow key={`${b.id}-${b.color ?? ""}`} brand={b} />
        ))}
      </CardContent>
    </Card>
  );
}
