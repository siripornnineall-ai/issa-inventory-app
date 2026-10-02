import { CODE128_QUIET_MODULES, code128Bars } from "@/lib/utils/code128";

// วาดบาร์โค้ด Code 128 จากสายบิต: 1 โมดูล = 1 หน่วยใน viewBox ปรับกว้าง/สูงจริงเป็น มม. ผ่านตัวแปร CSS
// --bc-w / --bc-h (ถูกกำหนดนอก @media print ด้วย !important จึงชนะกฎขนาด QR เดิมของโหมด A4)
// preserveAspectRatio="none" ยืดตามแนวตั้งได้อิสระ ส่วนแนวนอนยืดเท่ากันทุกแท่ง อัตราส่วนความกว้างแท่ง/ช่องจึงไม่เพี้ยน
export function Code128Svg({ bits, widthMm, heightMm }: { bits: string; widthMm: number; heightMm: number }) {
  const bars = code128Bars(bits);
  const q = CODE128_QUIET_MODULES;
  return (
    <svg
      className="barcode-svg"
      viewBox={`${-q} 0 ${bits.length + q * 2} 1`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label="บาร์โค้ด"
      style={{ ["--bc-w" as string]: `${widthMm}mm`, ["--bc-h" as string]: `${heightMm}mm` }}
    >
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={1} fill="#000" />
      ))}
    </svg>
  );
}
