// จับคู่รายการของ SOS (รหัส B1590-Axxxx + คำอธิบาย เช่น "Billie Slim ทรงกระบอกเล็ก brown M") กับตัวเลือกสินค้า (รุ่น/สี/ไซซ์) ของเรา
// สีภาษาอังกฤษของ SOS → สีของเรา (เจ้าของงานยืนยันแล้ว 12 พ.ย. 2026): brown=น้ำตาลไหม้ grey=เทาดิน khaki=โอวัลติน
import type { AppState } from "@/lib/store/state";

export const SOS_COLOR_MAP: Record<string, string> = {
  black: "ดำ",
  navy: "กรม",
  cream: "ครีม",
  white: "ขาว",
  brown: "น้ำตาลไหม้",
  grey: "เทาดิน",
  khaki: "โอวัลติน",
};

// ต้นทุนต่อชิ้น (เจ้าของงานกำหนด): ทุกรุ่น 200 บาท ยกเว้นเสื้อสูท 400 บาท ค่าส่ง (EMS) ไม่ใช่สินค้า ไม่นับต้นทุน
export const SOS_COST_DEFAULT = 200;
export const SOS_COST_BLAZER = 400;

export function sosCostPerPiece(description: string): number {
  const d = description.toLowerCase();
  if (d.startsWith("ems")) return 0;
  if (d.includes("สูท") || d.includes("blazer")) return SOS_COST_BLAZER;
  return SOS_COST_DEFAULT;
}

export function isSosNonProduct(description: string): boolean {
  return description.toLowerCase().startsWith("ems");
}

const SIZE_ALIASES: Record<string, string> = { xxs: "XXS", xs: "XS", s: "S", m: "M", l: "L", xl: "XL", xxl: "2XL", xxxl: "3XL" };

export function normalizeSosSize(token: string): string | null {
  const t = token.toLowerCase();
  if (SIZE_ALIASES[t]) return SIZE_ALIASES[t];
  if (/^[2-9]xl$/.test(t)) return t.toUpperCase();
  return null;
}

export interface ParsedSosDescription {
  model: string; // ข้อความก่อนส่วนสี/ไซซ์ (ใช้จับคู่ชื่อรุ่น)
  colorEn: string | null;
  colorTh: string | null;
  size: string | null;
}

export function parseSosDescription(description: string): ParsedSosDescription {
  const tokens = description.replace(/\s+/g, " ").trim().split(" ");
  let colorEn: string | null = null;
  let size: string | null = null;
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (SOS_COLOR_MAP[low]) colorEn = low;
    const s = normalizeSosSize(t);
    if (s) size = s;
  }
  if (/free\s*size/i.test(description)) size = "Freesize";
  return { model: tokens.join(" "), colorEn, colorTh: colorEn ? SOS_COLOR_MAP[colorEn] : null, size };
}

// หารุ่นของเราจากชื่อ: คำอธิบายของ SOS ขึ้นต้นด้วยชื่อรุ่นของเรา (ไม่สนตัวพิมพ์เล็ก/ใหญ่ ยุบช่องว่าง) เลือกชื่อที่ยาวที่สุดที่ตรง
// สี: ถ้าคำอธิบายมีชื่อสีภาษาไทยของรุ่นนั้น (เช่น "น้ำเงินสนิม") ใช้ชื่อไทยก่อน ไม่งั้นแปลงจากสีภาษาอังกฤษตามตาราง
export function matchSosVariant(state: AppState, description: string): { variantId: string | null; reason?: string } {
  if (isSosNonProduct(description)) return { variantId: null, reason: "ไม่ใช่สินค้า (ค่าส่ง)" };
  const parsed = parseSosDescription(description);
  const desc = description.replace(/\s+/g, " ").trim().toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const p of Object.values(state.products)) {
    const name = p.sellingName.replace(/\s+/g, " ").trim().toLowerCase();
    if (name && desc.startsWith(name) && (!best || name.length > best.len)) best = { id: p.id, len: name.length };
  }
  if (!best) return { variantId: null, reason: "ไม่พบรุ่นในระบบ" };
  const productVariants = Object.values(state.variants).filter((x) => x.productId === best!.id);
  const thaiColors = [...new Set(productVariants.map((v) => v.color))].sort((a, b) => b.length - a.length);
  const thaiHit = thaiColors.find((c) => c && description.includes(c));
  const color = thaiHit ?? parsed.colorTh;
  if (!color || !parsed.size) return { variantId: null, reason: "อ่านสีหรือไซซ์ไม่ได้" };
  const v = productVariants.find((x) => x.color === color && x.size === parsed.size);
  return v ? { variantId: v.id } : { variantId: null, reason: `ไม่มี ${color} / ${parsed.size} ในรุ่นนี้` };
}
