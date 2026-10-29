// สีประจำแบรนด์ ใช้เป็นจุดสี/แถบสี/พื้นจาง ๆ เฉพาะตรงที่ต้องบอกว่าเป็นแบรนด์ไหน ไม่ใช่สีธีมของทั้งระบบ
// ตัวอักษรบนป้ายแบรนด์ใช้สีข้อความปกติเสมอ (สีแบรนด์อ่อนอย่างฟ้าน้ำทะเลใช้เป็นตัวอักษรขาวไม่ชัด) สีแบรนด์ใช้แค่จุดและพื้นจาง
import type { CSSProperties } from "react";

export const NEUTRAL_BRAND_COLOR = "#6b7f83";
const DARK_TEXT = "#0c1e20";

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

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// สีตัวอักษรที่อ่านชัดกว่าบนพื้นสีนี้ (ขาว หรือเขียวเข้มเกือบดำ)
export function readableOn(background: string): string {
  return contrast(background, "#ffffff") >= contrast(background, DARK_TEXT) ? "#ffffff" : DARK_TEXT;
}

// ผสมสีกับสีดำให้เข้มขึ้น (amount 0-1)
export function darken(color: string, amount: number): string {
  const out = channels(color).map((v) => Math.round(v * (1 - amount)).toString(16).padStart(2, "0"));
  return `#${out.join("")}`;
}

// ตัวแปรสีของแถบหัวตาราง: --bar = แถบหัวตาราง, --bar-strong = แถบ "รวม" (เข้มกว่า) พร้อมสีตัวอักษรที่อ่านชัดบนแต่ละแถบ
// ใช้กับ style ของกล่องที่ครอบตาราง ตารางอ่านค่าด้วย var(--bar, สีเดิม) แบรนด์ไม่มีสี → คืน undefined ตารางใช้สีเขียวเดิม
export function brandBarStyle(brand?: { color?: string } | null): CSSProperties | undefined {
  if (!brand || !isHexColor(brand.color)) return undefined;
  const strong = darken(brand.color, 0.35);
  return {
    "--bar": brand.color,
    "--bar-fg": readableOn(brand.color),
    "--bar-strong": strong,
    "--bar-strong-fg": readableOn(strong),
  } as CSSProperties;
}
