"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PrintableQrLabels, type PrintLabelItem } from "@/components/products/PrintableQrLabels";
import { LabelCalibrationPanel } from "@/components/products/LabelCalibrationPanel";
import { useStore, useActions } from "@/lib/store";
import { productVariants } from "@/lib/store/selectors";
import { compareSizes } from "@/lib/utils/sizes";
import { useLabelCalibration } from "@/lib/utils/labelCalibration";
import { preloadImages } from "@/lib/utils/preloadImages";
import { toastError } from "@/lib/toast";
import { buildPrintLogos } from "@/lib/utils/printLogo";
import type { ProductVariant } from "@/lib/types";

export default function ProductLabelsPage() {
  const params = useParams<{ id: string }>();
  const state = useStore();
  const { mintUnitTokens } = useActions();
  const { calibration, update: updateCalibration, reset: resetCalibration } = useLabelCalibration();
  const product = state.products[params.id];
  const brand = product?.brandId ? state.brands[product.brandId] : undefined;
  const variants = useMemo(() => (product ? productVariants(state, product.id) : []), [state, product]);

  const variantIdsKey = variants.map((v) => v.id).join(",");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  if (variantIdsKey !== selectedKey) {
    setSelectedKey(variantIdsKey);
    setSelected(new Set(variants.map((v) => v.id)));
    setQuantities(Object.fromEntries(variants.map((v) => [v.id, 1])));
  }

  const [printBatch, setPrintBatch] = useState<PrintLabelItem[] | null>(null);
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    if (!printBatch || printBatch.length === 0) return;
    let cancelled = false;
    preloadImages(printBatch.map((b) => b.brandLogoUrl)).then(() => {
      if (!cancelled) requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelled = true;
    };
  }, [printBatch]);

  const groups = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      if (!map.has(v.color)) map.set(v.color, []);
      map.get(v.color)!.push(v);
    }
    return Array.from(map.entries()).map(([color, rows]) => ({ color, rows: [...rows].sort((a, b) => compareSizes(a.size, b.size)) }));
  }, [variants]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleColor(color: string, ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function setQty(variantId: string, raw: string) {
    const n = Math.max(0, Math.floor(Number(raw)) || 0);
    setQuantities((prev) => ({ ...prev, [variantId]: n }));
  }

  const totalToPrint = variants.reduce((sum, v) => sum + (selected.has(v.id) ? (quantities[v.id] ?? 1) : 0), 0);

  async function handlePrint() {
    setMinting(true);
    try {
      const batch: PrintLabelItem[] = [];
      for (const v of variants) {
        if (!selected.has(v.id)) continue;
        const qty = quantities[v.id] ?? 1;
        if (qty <= 0) continue;
        // ทั้งบาร์โค้ดและ QR สร้างรหัสเฉพาะใบใหม่ทุกครั้งที่พิมพ์ (บาร์โค้ดใช้รหัสสั้น 8 ตัว QR ใช้ id เต็ม)
        const tokens = mintUnitTokens(v.id, qty);
        for (const token of tokens) batch.push({ product, variant: v, token, brandLogoUrl: brand?.logoUrl });
      }
      if (batch.length === 0) {
        toastError("กรุณาเลือกสี/ไซซ์และระบุจำนวนอย่างน้อย 1 ใบ");
        return;
      }
      // เครื่องพิมพ์ฉลากพิมพ์ได้แค่ขาวดำ: แปลงโลโก้กลาง QR เป็นขาวดำที่ตัดกันชัด ไม่งั้นโลโก้พื้นสีอ่อนจะกลายเป็นช่องว่าง
      let finalBatch = batch;
      if (calibration.paper === "roll" && batch.some((b) => b.token && b.brandLogoUrl)) {
        const logos = await buildPrintLogos(batch.map((b) => b.brandLogoUrl));
        finalBatch = batch.map((b) => (b.brandLogoUrl ? { ...b, brandLogoUrl: logos.get(b.brandLogoUrl) ?? b.brandLogoUrl } : b));
      }
      setPrintBatch(finalBatch);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setMinting(false);
    }
  }

  if (!product) {
    return <div className="p-8 text-sm text-[var(--color-on-surface-variant)]">ไม่พบสินค้านี้ในระบบ</div>;
  }

  return (
    <div className="qr-print-root mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/products/${product.id}`} className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับไปหน้าสินค้า
        </Link>
        <Button onClick={handlePrint} disabled={totalToPrint === 0} loading={minting}>
          <Printer className="h-4 w-4" /> พิมพ์ป้าย ({totalToPrint} ใบ)
        </Button>
      </div>

      <h1 className="mb-1 text-lg font-semibold print:hidden">ป้ายสินค้า — {product.sellingName}</h1>
      <p className="mb-4 text-xs text-[var(--color-on-surface-variant)] print:hidden">แต่ละใบที่ปริ้นจะมีรหัสเฉพาะตัวไม่ซ้ำกัน (ทั้งบาร์โค้ดและ QR) ใช้กันสแกนซ้ำชิ้นเดิมตอนรับเข้า/เบิกออก/นับสต็อก</p>

      {variants.length === 0 ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">สินค้านี้ยังไม่มีตัวเลือกสี/ไซซ์</p>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--color-border)] p-4 print:hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">เลือกสี/ไซซ์ และจำนวนใบที่จะปริ้น</p>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-[var(--color-primary-container)] hover:underline" onClick={() => setSelected(new Set(variants.map((v) => v.id)))}>
                  เลือกทั้งหมด
                </button>
                <button type="button" className="text-xs text-[var(--color-on-surface-variant)] hover:underline" onClick={() => setSelected(new Set())}>
                  ไม่เลือกเลย
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {groups.map((group) => {
                const ids = group.rows.map((v) => v.id);
                const allSelected = ids.every((id) => selected.has(id));
                const someSelected = ids.some((id) => selected.has(id));
                return (
                  <div key={group.color} className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allSelected && someSelected;
                        }}
                        onChange={() => toggleColor(group.color, ids)}
                        className="h-4 w-4"
                      />
                      {group.color}
                    </label>
                    <div className="ml-6 flex flex-wrap gap-2">
                      {group.rows.map((v) => (
                        <label
                          key={v.id}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                            selected.has(v.id) ? "border-[var(--color-primary-container)] text-[var(--color-primary-container)]" : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                          }`}
                        >
                          <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} className="h-3.5 w-3.5" />
                          {v.size}
                          <input
                            type="number"
                            min={0}
                            value={quantities[v.id] ?? 1}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setQty(v.id, e.target.value)}
                            disabled={!selected.has(v.id)}
                            className="w-12 rounded border border-[var(--color-border)] bg-white px-1 py-0.5 text-xs disabled:bg-[var(--color-surface-container)]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <LabelCalibrationPanel calibration={calibration} onChange={updateCalibration} onReset={resetCalibration} />

          {!printBatch || printBatch.length === 0 ? (
            <p className="text-sm text-[var(--color-on-surface-variant)] print:hidden">ยังไม่ได้ปริ้น — กด &quot;พิมพ์ป้าย&quot; เพื่อเปิดหน้าต่างพิมพ์</p>
          ) : (
            <PrintableQrLabels items={printBatch} calibration={calibration} />
          )}
        </>
      )}
    </div>
  );
}
