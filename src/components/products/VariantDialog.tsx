"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { useActions, useStore } from "@/lib/store";
import type { ProductVariant } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";
import { genSkuV2, suggestColorCode } from "@/lib/utils/ids";

interface VariantDialogProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  existing?: ProductVariant;
}

export function VariantDialog(props: VariantDialogProps) {
  if (!props.open) return null;
  return <VariantDialogForm {...props} />;
}

function VariantDialogForm({ open, onClose, productId, existing }: VariantDialogProps) {
  const { addVariant, updateVariant, upsertColorCode } = useActions();
  const product = useStore((s) => s.products[productId]);
  const brand = useStore((s) => (product?.brandId ? s.brands[product.brandId] : undefined));
  const colorCodes = useStore((s) => s.colorCodes);

  const [color, setColor] = useState(existing?.color ?? "");
  const [colorCode, setColorCode] = useState("");
  const [colorCodeTouched, setColorCodeTouched] = useState(false);

  function handleColorChange(value: string) {
    setColor(value);
    if (!colorCodeTouched) {
      const trimmed = value.trim();
      const exact = Object.values(colorCodes).find((c) => c.thaiName === trimmed);
      setColorCode(trimmed ? exact?.code ?? suggestColorCode(trimmed, colorCodes) : "");
    }
  }
  const [size, setSize] = useState(existing?.size ?? "");
  const [isDefective, setIsDefective] = useState(existing?.isDefective ?? false);
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [skuTouched, setSkuTouched] = useState(Boolean(existing?.sku));
  const [purchasePrice, setPurchasePrice] = useState(existing?.purchasePrice ?? 0);
  const [sellingPrice, setSellingPrice] = useState(existing?.sellingPrice ?? 0);
  const [reorderPoint, setReorderPoint] = useState(existing?.reorderPoint ?? 5);
  const [storageLocation, setStorageLocation] = useState(existing?.storageLocation ?? "");
  const [saving, setSaving] = useState(false);

  const colorSuggestions = useMemo(() => {
    const q = color.trim().toLowerCase();
    if (!q) return [];
    return Object.values(colorCodes).filter((c) => c.thaiName.toLowerCase().includes(q)).slice(0, 5);
  }, [colorCodes, color]);

  const canPreview = Boolean(brand && product?.modelCode && colorCode && size && !existing);
  const previewSku = canPreview
    ? genSkuV2({ brandCode: brand!.code, modelCode: product!.modelCode!, colorCode, size, isDefective })
    : "";

  function applySku(value: string) {
    setSku(value);
    setSkuTouched(true);
  }

  function handleSave() {
    if (!color.trim() || !size.trim()) {
      toastError("กรุณาระบุสีและไซซ์");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        updateVariant(existing.id, { color, size, sku, isDefective, purchasePrice, sellingPrice, reorderPoint, storageLocation });
        toastSuccess("แก้ไขตัวเลือกสินค้าเรียบร้อยแล้ว");
      } else {
        if (colorCode.trim()) upsertColorCode(colorCode, color);
        addVariant(productId, {
          color,
          colorCode: colorCode || undefined,
          isDefective,
          size,
          sku: (skuTouched ? sku : previewSku) || undefined,
          purchasePrice,
          sellingPrice,
          reorderPoint,
          storageLocation: storageLocation || undefined,
        });
        toastSuccess("เพิ่มตัวเลือกสินค้าเรียบร้อยแล้ว");
      }
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? "แก้ไขตัวเลือกสินค้า" : "เพิ่มตัวเลือกสินค้าใหม่"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave} loading={saving}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="สี" required>
          <Input value={color} onChange={(e) => handleColorChange(e.target.value)} />
          {!existing && colorSuggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {colorSuggestions.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setColor(c.thaiName);
                    setColorCode(c.code);
                    setColorCodeTouched(true);
                  }}
                  className="rounded-lg border border-dashed border-[var(--color-border-strong)] px-2 py-1 text-xs text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
                >
                  {c.thaiName} ({c.code})
                </button>
              ))}
            </div>
          )}
        </FormField>
        <FormField label="ไซซ์" required>
          <Input value={size} onChange={(e) => setSize(e.target.value)} />
        </FormField>
        {!existing && brand && product?.modelCode && (
          <FormField label="รหัสสี" hint="สร้างให้อัตโนมัติจากชื่อสี แก้เองได้ถ้าต้องการ">
            <Input
              value={colorCode}
              onChange={(e) => {
                setColorCode(e.target.value.toUpperCase());
                setColorCodeTouched(true);
              }}
            />
          </FormField>
        )}
        <FormField label="มีตำหนิ (จะเพิ่ม DF ใน SKU)">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefective} onChange={(e) => setIsDefective(e.target.checked)} className="h-4 w-4" />
            สินค้ามีตำหนิ
          </label>
        </FormField>
        <FormField
          label="SKU"
          hint={canPreview ? `ตัวอย่าง: ${previewSku} (เว้นว่างเพื่อใช้ค่านี้)` : "เว้นว่างเพื่อสร้างอัตโนมัติ"}
          className="col-span-2"
        >
          <Input value={skuTouched ? sku : previewSku} onChange={(e) => applySku(e.target.value)} placeholder={previewSku || undefined} />
        </FormField>
        <FormField label="ราคาซื้อ">
          <Input type="number" min={0} value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} />
        </FormField>
        <FormField label="ราคาขาย">
          <Input type="number" min={0} value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} />
        </FormField>
        <FormField label="จุดแจ้งเตือนใกล้หมด">
          <Input type="number" min={0} value={reorderPoint} onChange={(e) => setReorderPoint(Number(e.target.value))} />
        </FormField>
        <FormField label="ตำแหน่งจัดเก็บ">
          <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
        </FormField>
      </div>
    </Dialog>
  );
}
