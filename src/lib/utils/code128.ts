import JsBarcode from "jsbarcode";

// บาร์โค้ด Code 128 สำหรับป้ายสินค้า — ให้ JsBarcode เข้ารหัสเป็นสายบิต (1 = แท่งดำ 0 = ช่องขาว) ต่อหนึ่งโมดูล
// แล้วเราวาดเป็น SVG เอง (ดู Code128Svg) ไม่พึ่ง DOM จึงใช้ได้ทั้งตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์และในเทสต์
// Code 128 รองรับเฉพาะอักขระ ASCII: SKU เก่าที่มีชื่อสีภาษาไทยเข้ารหัสไม่ได้ (คืน null) ผู้เรียกต้องมีทางสำรอง

// โซนเงียบด้านซ้าย/ขวา (หน่วย: โมดูล) มาตรฐานแนะนำ 10 แต่ป้าย 50 มม. แคบ จึงใช้ 6 ร่วมกับขอบสีขาวของป้าย
export const CODE128_QUIET_MODULES = 6;

export function encodeCode128(text: string): string | null {
  if (!text || /[^\x20-\x7e]/.test(text)) return null;
  try {
    const target: { encodings?: { data: string }[] } = {};
    JsBarcode(target, text, { format: "CODE128", margin: 0 });
    return target.encodings?.map((e) => e.data).join("") || null;
  } catch {
    return null;
  }
}

// จำนวนโมดูลทั้งหมดรวมโซนเงียบสองข้าง ใช้คำนวณความกว้างจริงของป้ายว่าแท่งบางเกินไปไหม
export function code128TotalModules(text: string): number | null {
  const bits = encodeCode128(text);
  return bits ? bits.length + CODE128_QUIET_MODULES * 2 : null;
}

// รวมบิตที่ติดกันเป็นแท่งเดียว (x = ตำแหน่งโมดูลเริ่มต้น, w = ความกว้างเป็นโมดูล) เพื่อวาดเป็น <rect> น้อยที่สุด
export function code128Bars(bits: string): { x: number; w: number }[] {
  const bars: { x: number; w: number }[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let j = i;
      while (j < bits.length && bits[j] === "1") j++;
      bars.push({ x: i, w: j - i });
      i = j;
    } else {
      i++;
    }
  }
  return bars;
}
