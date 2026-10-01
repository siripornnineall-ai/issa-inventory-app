"use client";

import { QrLabel } from "./QrLabel";
import type { LabelCalibration } from "@/lib/utils/labelCalibration";
import { buildLabelPrintCss } from "@/lib/utils/labelPrintCss";
import type { Product, ProductVariant, UnitToken } from "@/lib/types";

export interface PrintLabelItem {
  product: Product;
  variant: ProductVariant;
  token: UnitToken;
  brandLogoUrl?: string;
}

// พิมพ์ป้าย QR ได้ 2 ชนิดกระดาษ (เลือกที่ calibration.paper):
// - A4: กริดหลายดวงต่อแผ่น สำหรับแผ่นสติกเกอร์ตัดดวงไว้ล่วงหน้า (ติดบน A4 แล้วป้อนเครื่องพิมพ์เอกสารทั่วไป)
// - ม้วน: 1 ดวงต่อ 1 หน้ากระดาษขนาดเท่าดวง สำหรับเครื่องพิมพ์ฉลาก/ความร้อน เช่น 50x30 มม.
// ตำแหน่ง/ขนาดปรับได้ผ่าน calibration (ตั้งค่าในหน้าพิมพ์ ไม่ต้องแก้โค้ดทุกครั้งที่ไม่ตรงช่อง) CSS สร้างใน labelPrintCss.ts
export function PrintableQrLabels({ items, calibration }: { items: PrintLabelItem[]; calibration: LabelCalibration }) {
  if (items.length === 0) return null;

  return (
    <>
      <style>{buildLabelPrintCss(calibration)}</style>
      <div className="qr-label-page">
        <div className="qr-label-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map(({ product, variant: v, token, brandLogoUrl }) => (
            <div key={token.id} className="qr-label-card flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-2 text-left">
              <QrLabel value={token.id} size={80} logoUrl={brandLogoUrl} />
              <div className="qr-label-text min-w-0">
                <p className="qr-label-name truncate text-xs font-medium leading-tight">{product.sellingName}</p>
                <p className="qr-label-variant truncate text-xs text-[var(--color-on-surface-variant)]">
                  {v.color} / {v.size}
                </p>
                {product.shape && <p className="qr-label-shape truncate text-[10px] leading-tight text-[var(--color-on-surface-variant)]">{product.shape}</p>}
                <p className="qr-label-sku truncate font-mono text-[10px] leading-tight">{v.sku}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
