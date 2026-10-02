"use client";

import { QrLabel } from "./QrLabel";
import { Code128Svg } from "./Code128Svg";
import type { LabelCalibration } from "@/lib/utils/labelCalibration";
import { barcodeGeometry, barcodeWidthMm, buildLabelPrintCss, isBarcode } from "@/lib/utils/labelPrintCss";
import { code128TotalModules, encodeCode128 } from "@/lib/utils/code128";
import type { Product, ProductVariant, UnitToken } from "@/lib/types";

export interface PrintLabelItem {
  product: Product;
  variant: ProductVariant;
  // ป้าย QR ต้องมีโทเคนเฉพาะตัว ส่วนป้ายบาร์โค้ดใช้ SKU จึงไม่ต้องมี
  token?: UnitToken;
  brandLogoUrl?: string;
}

// พิมพ์ป้ายได้ 2 ชนิดรหัส (calibration.codeType) และ 2 ชนิดกระดาษ (calibration.paper):
// - บาร์โค้ด Code 128 ของ SKU (ค่าเริ่มต้น) / QR รหัสเฉพาะตัวทุกใบ
// - กระดาษ A4 กริดหลายดวงต่อแผ่น (สติกเกอร์ตัดดวงไว้ล่วงหน้า) / ม้วนสติกเกอร์ 1 ดวงต่อ 1 หน้า เช่น 50x30 มม.
// ตำแหน่ง/ขนาดปรับได้ผ่าน calibration (ตั้งค่าในหน้าพิมพ์ ไม่ต้องแก้โค้ดทุกครั้งที่ไม่ตรงช่อง) CSS สร้างใน labelPrintCss.ts
// SKU ที่มีอักขระนอก ASCII (เช่นชื่อสีภาษาไทยในรหัสเก่า) เข้ารหัสบาร์โค้ดไม่ได้ ถ้ามีโทเคนจะพิมพ์เป็น QR แทน
export function PrintableQrLabels({ items, calibration }: { items: PrintLabelItem[]; calibration: LabelCalibration }) {
  if (items.length === 0) return null;

  const wantBarcode = isBarcode(calibration);
  const geom = barcodeGeometry(calibration);

  return (
    <>
      <style>{buildLabelPrintCss(calibration)}</style>
      <div className="qr-label-page">
        <div className="qr-label-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map(({ product, variant: v, token, brandLogoUrl }, idx) => {
            const bits = wantBarcode ? encodeCode128(v.sku) : null;
            if (bits) {
              const modules = code128TotalModules(v.sku) ?? bits.length;
              return (
                <div key={`${v.id}-${idx}`} className="qr-label-card barcode-card flex flex-col rounded-lg border border-[var(--color-border)] p-2 text-left">
                  <div className="bc-head">
                    <span className="bc-name">{product.sellingName}</span>
                    <span className="bc-variant">
                      {v.color} / {v.size}
                    </span>
                  </div>
                  <div className="bc-code">
                    <Code128Svg bits={bits} widthMm={barcodeWidthMm(modules, geom.innerWidthMm)} heightMm={geom.heightMm} />
                  </div>
                  <p className="bc-sku">{v.sku}</p>
                </div>
              );
            }
            if (!token) return null;
            return (
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
            );
          })}
        </div>
      </div>
    </>
  );
}
