"use client";

import { QrLabel } from "./QrLabel";
import type { LabelCalibration } from "@/lib/utils/labelCalibration";
import type { Product, ProductVariant, UnitToken } from "@/lib/types";

export interface PrintLabelItem {
  product: Product;
  variant: ProductVariant;
  token: UnitToken;
  brandLogoUrl?: string;
}

// พิมพ์เป็นกริดหลายดวงต่อแผ่น A4 — สำหรับแผ่นสติกเกอร์ตัดดวงไว้ล่วงหน้า (ติดบน A4 แล้วป้อนเครื่องพิมพ์เอกสารทั่วไป)
// ตำแหน่ง/ขนาดช่องปรับได้ผ่าน calibration (ตั้งค่าในหน้าพิมพ์ ไม่ต้องแก้โค้ดทุกครั้งที่ไม่ตรงช่อง)
export function PrintableQrLabels({ items, calibration }: { items: PrintLabelItem[]; calibration: LabelCalibration }) {
  if (items.length === 0) return null;

  const { columns, cellWidthMm, cellHeightMm, colGapMm, rowGapMm, marginTopMm, marginLeftMm } = calibration;
  const qrSizeMm = Math.max(8, Math.min(cellWidthMm, cellHeightMm) - 5);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          .qr-label-page {
            padding-top: ${marginTopMm}mm !important;
            padding-left: ${marginLeftMm}mm !important;
          }
          .qr-label-grid {
            display: grid !important;
            grid-template-columns: repeat(${columns}, ${cellWidthMm}mm) !important;
            gap: ${rowGapMm}mm ${colGapMm}mm !important;
            justify-content: start !important;
          }
          .qr-label-card {
            width: ${cellWidthMm}mm;
            height: ${cellHeightMm}mm;
            box-sizing: border-box;
            border: none !important;
            border-radius: 0 !important;
            padding: 1.5mm !important;
            gap: 2mm !important;
            break-inside: avoid;
          }
          .qr-label-card svg {
            width: ${qrSizeMm}mm !important;
            height: ${qrSizeMm}mm !important;
          }
        }
      `}</style>
      <div className="qr-label-page">
        <div className="qr-label-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map(({ product, variant: v, token, brandLogoUrl }) => (
            <div key={token.id} className="qr-label-card flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-2 text-left">
              <QrLabel value={token.id} size={80} logoUrl={brandLogoUrl} />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium leading-tight">{product.sellingName}</p>
                <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                  {v.color} / {v.size}
                </p>
                {product.shape && <p className="truncate text-[10px] leading-tight text-[var(--color-on-surface-variant)]">{product.shape}</p>}
                <p className="truncate font-mono text-[10px] leading-tight">{v.sku}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
