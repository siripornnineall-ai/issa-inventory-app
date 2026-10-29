// สีประจำแบรนด์ ใช้เป็นจุดสี/แถบสี/พื้นจาง ๆ เฉพาะตรงที่ต้องบอกว่าเป็นแบรนด์ไหน ไม่ใช่สีธีมของทั้งระบบ
// ตัวอักษรบนป้ายแบรนด์ใช้สีข้อความปกติเสมอ (สีแบรนด์อ่อนอย่างฟ้าน้ำทะเลใช้เป็นตัวอักษรขาวไม่ชัด) สีแบรนด์ใช้แค่จุดและพื้นจาง
export const NEUTRAL_BRAND_COLOR = "#6b7f83";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function brandColor(brand?: { color?: string } | null): string {
  return brand && isHexColor(brand.color) ? brand.color : NEUTRAL_BRAND_COLOR;
}

// พื้นจางและเส้นขอบของป้ายแบรนด์ ผสมสีแบรนด์กับสีขาว
export function brandTint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}
