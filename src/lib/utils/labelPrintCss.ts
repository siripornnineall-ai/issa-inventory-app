import type { LabelCalibration } from "./labelCalibration";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

// ขนาดดวงสติกเกอร์แบบม้วน (มม.) กันค่า 0/ติดลบจากช่องกรอก
export function rollSizeMm(c: Pick<LabelCalibration, "rollWidthMm" | "rollHeightMm">) {
  return { w: clamp(c.rollWidthMm, 20, 200), h: clamp(c.rollHeightMm, 15, 200) };
}

// สร้าง CSS ของหน้าพิมพ์ป้าย QR ตามชนิดกระดาษ
// โหมด A4 ต้องได้ผลเหมือนเดิมทุกประการ (ผู้ใช้อาจปรับค่าให้ตรงกับแผ่นสติกเกอร์แล้ว) ห้ามแก้เมื่อไม่จำเป็น
export function buildLabelPrintCss(c: LabelCalibration): string {
  const paperCss = c.paper === "roll" ? buildRollCss(c) : buildA4Css(c);
  // กฎของบาร์โค้ดต่อท้ายกฎกระดาษเสมอ เพื่อชนะกฎขนาด QR/ช่องไฟเดิมเมื่อความเฉพาะเจาะจงเท่ากัน
  return isBarcode(c) ? paperCss + buildBarcodeCss(c) : paperCss;
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

// ---------------------------------------------------------------------------------------------
// บาร์โค้ด Code 128

// ค่าเดิมของไฟล์ที่บันทึกไว้ก่อนมีตัวเลือกนี้ไม่มี codeType ให้ถือเป็น barcode (ค่าเริ่มต้น)
export function isBarcode(c: Pick<LabelCalibration, "codeType">): boolean {
  return (c.codeType ?? "barcode") === "barcode";
}

// ความกว้างสูงสุดของ 1 โมดูล (มม.) ถ้า SKU สั้นไม่ขยายแท่งให้หนาเกินจำเป็น
export const BARCODE_MAX_MODULE_MM = 0.3;

function textScale(c: LabelCalibration): number {
  return c.paper === "roll" ? clamp(c.rollTextScalePct ?? 100, 60, 200) / 100 : 1;
}

// พื้นที่วาดบาร์โค้ดในป้ายหนึ่งดวง: กว้างสุด = ความกว้างดวงหักขอบ, สูง = ส่วนที่เหลือหลังหักบรรทัดชื่อ/สี/ไซซ์ และบรรทัด SKU
export function barcodeGeometry(c: LabelCalibration): { innerWidthMm: number; heightMm: number } {
  const pad = 1.5;
  const { w, h } = rollSizeMm(c);
  const roll = c.paper === "roll";
  const cellW = roll ? w : c.cellWidthMm;
  const cellH = roll ? h - 0.4 : c.cellHeightMm;
  const innerW = Math.max(10, cellW - pad * 2);
  const innerH = Math.max(8, cellH - pad * 2);
  const textH = (4.2 + 2.8) * textScale(c) + 0.8;
  return { innerWidthMm: +innerW.toFixed(2), heightMm: +clamp(innerH - textH, 6, 13).toFixed(2) };
}

export function barcodeWidthMm(totalModules: number, innerWidthMm: number): number {
  return +Math.min(innerWidthMm, totalModules * BARCODE_MAX_MODULE_MM).toFixed(2);
}

function buildBarcodeCss(c: LabelCalibration): string {
  const k = textScale(c);
  const fs = (pt: number) => +(pt * k).toFixed(2);
  return `
        /* ป้ายบาร์โค้ด: แถวบนชื่อรุ่น (ซ้าย) + สี/ไซซ์ (ขวา) ตามด้วยแท่งบาร์โค้ด และ SKU ตัวอักษรใต้แท่ง */
        .barcode-card {
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: center !important;
          gap: 0.6mm !important;
        }
        .barcode-card, .barcode-card * { color: #000 !important; }
        .barcode-card .bc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1.5mm; }
        .barcode-card .bc-name {
          flex: 1 1 0;
          min-width: 0;
          font-size: ${fs(8.5)}pt;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .barcode-card .bc-variant { flex: none; font-size: ${fs(9.5)}pt; font-weight: 700; line-height: 1.2; white-space: nowrap; }
        .barcode-card .bc-code { display: flex; justify-content: center; }
        .barcode-card svg.barcode-svg { display: block; flex-shrink: 0; width: var(--bc-w) !important; height: var(--bc-h) !important; }
        .barcode-card .bc-sku {
          margin: 0;
          text-align: center;
          font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
          font-size: ${fs(7)}pt;
          line-height: 1.15;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
        }
      `;
}
