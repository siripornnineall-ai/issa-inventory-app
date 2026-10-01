import type { LabelCalibration } from "./labelCalibration";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

// ขนาดดวงสติกเกอร์แบบม้วน (มม.) กันค่า 0/ติดลบจากช่องกรอก
export function rollSizeMm(c: Pick<LabelCalibration, "rollWidthMm" | "rollHeightMm">) {
  return { w: clamp(c.rollWidthMm, 20, 200), h: clamp(c.rollHeightMm, 15, 200) };
}

// สร้าง CSS ของหน้าพิมพ์ป้าย QR ตามชนิดกระดาษ
// โหมด A4 ต้องได้ผลเหมือนเดิมทุกประการ (ผู้ใช้อาจปรับค่าให้ตรงกับแผ่นสติกเกอร์แล้ว) ห้ามแก้เมื่อไม่จำเป็น
export function buildLabelPrintCss(c: LabelCalibration): string {
  if (c.paper === "roll") return buildRollCss(c);
  return buildA4Css(c);
}

function buildA4Css(c: LabelCalibration): string {
  const { columns, cellWidthMm, cellHeightMm, colGapMm, rowGapMm, marginTopMm, marginLeftMm } = c;
  const qrSizeMm = Math.max(8, Math.min(cellWidthMm, cellHeightMm) - 5);
  return `
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
      `;
}

// ม้วนสติกเกอร์ความร้อน: 1 ดวง = 1 หน้ากระดาษขนาดเท่าดวงพอดี (@page size) ไม่มีขอบกระดาษ
// ส่วนขนาดดวง/ตัวอักษรกำหนดนอก @media print ด้วย เพื่อให้ตัวอย่างบนหน้าจอเป็นขนาดจริงตรงกับที่จะพิมพ์
function buildRollCss(c: LabelCalibration): string {
  const { w, h } = rollSizeMm(c);
  const pad = 1.5;
  const gap = 1.5;
  // เว้นความสูงนิดเดียว กันเนื้อหาล้นหน้าแล้วเครื่องพิมพ์ดันออกดวงว่างเพิ่ม
  const cardH = +(h - 0.4).toFixed(2);
  // QR กว้างราว 44% ของดวง (50 มม. -> 22 มม.) เหลือที่ให้ตัวอักษรฝั่งขวามากขึ้น QR ระดับ H ขนาดนี้สแกนติดสบาย
  const qr = +clamp(Math.min(h - pad * 2, w * 0.44), 10, 80).toFixed(2);
  const k = clamp(c.rollTextScalePct ?? 100, 60, 200) / 100;
  const fs = (pt: number) => +(pt * k).toFixed(2);
  const ox = Number.isFinite(c.rollOffsetXMm) ? c.rollOffsetXMm : 0;
  const oy = Number.isFinite(c.rollOffsetYMm) ? c.rollOffsetYMm : 0;
  return `
        .qr-label-grid {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 4mm !important;
        }
        .qr-label-card {
          width: ${w}mm;
          height: ${cardH}mm;
          box-sizing: border-box;
          overflow: hidden;
          padding: ${pad}mm !important;
          gap: ${gap}mm !important;
          border-radius: 0 !important;
          background: #fff;
          position: relative;
          left: ${ox}mm;
          top: ${oy}mm;
        }
        .qr-label-card, .qr-label-card * { color: #000 !important; }
        .qr-label-card svg {
          width: ${qr}mm !important;
          height: ${qr}mm !important;
          flex-shrink: 0;
        }
        .qr-label-text { flex: 1 1 0; min-width: 0; }
        .qr-label-name {
          font-size: ${fs(9)}pt !important;
          font-weight: 700 !important;
          line-height: 1.15 !important;
          white-space: normal !important;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        /* สี/ไซซ์ต้องเห็นครบเสมอ ถ้าชื่อสียาวให้ขึ้นบรรทัดใหม่ ห้ามตัดเป็น ... (ไซซ์อยู่ท้ายบรรทัดจะหายก่อน) */
        .qr-label-variant {
          font-size: ${fs(9.5)}pt !important;
          line-height: 1.2 !important;
          margin-top: 0.4mm;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          overflow-wrap: anywhere;
        }
        .qr-label-shape {
          font-size: ${fs(7)}pt !important;
          line-height: 1.15 !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }
        .qr-label-sku {
          font-size: ${fs(7)}pt !important;
          line-height: 1.15 !important;
          white-space: normal !important;
          word-break: break-all;
          margin-top: 0.4mm;
        }
        @media print {
          @page { size: ${w}mm ${h}mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .qr-print-root { padding: 0 !important; margin: 0 !important; max-width: none !important; width: ${w}mm !important; }
          .qr-label-page { padding: 0 !important; }
          .qr-label-grid { display: block !important; }
          .qr-label-card {
            border: none !important;
            break-inside: avoid;
            break-after: page;
            page-break-after: always;
          }
          .qr-label-card:last-child { break-after: auto; page-break-after: auto; }
        }
      `;
}
