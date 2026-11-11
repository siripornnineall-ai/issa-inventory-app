// ลำดับสีที่แสดงในทุกหน้า (ตารางสต็อก ยอดขาย นับสต็อก โรงงาน BC รายการสี ฯลฯ) เรียงตามลำดับที่ตั้งไว้ ไม่เรียงตามยอดหรือตามที่สร้างก่อน
// 1) ถ้ารุ่นนั้นตั้งลำดับเองไว้ (products.color_order) ใช้ลำดับของรุ่นก่อน
// 2) สีที่เหลือเรียงตามลำดับมาตรฐานด้านล่าง (ตามชีตบัญชีสต็อกเดิม แถว B Slim ซึ่งมีสีครบที่สุด)
// 3) สีที่ไม่อยู่ในลำดับไหนเลย (สีใหม่) ไปอยู่ท้าย เรียงตามชื่อ
// เป็นการแสดงผลอย่างเดียว ไม่มีผลกับจำนวนสต็อกหรือรายการเคลื่อนไหว

export const DEFAULT_COLOR_ORDER: string[] = [
  "ดำ",
  "กรม",
  "เทาดิน",
  "น้ำตาลไหม้",
  "โอวัลติน",
  "ครีม",
  "ขาว",
  "เขียวเข้ม", // ในชีตเรียก "เขียวหยก" (ยืนยันแล้วว่าคือเขียวเข้มในระบบ)
  "เขียวหยก",
  "น้ำเงิน",
  "ม่วง",
  "เขียวขี้ม้า",
  "ฟ้า",
  "ส้มอิฐ",
  "แดงเลือดหมู",
  "น้ำตาลทอง",
  "ชมพู",
  "เขียวโอลีฟ",
  "ชานม",
];

const norm = (c: string) => c.trim();

type HasColorOrder = { colorOrder?: string[] } | null | undefined;

// ตำแหน่งของสีในลำดับ (ยิ่งน้อยยิ่งขึ้นก่อน) รุ่นที่ตั้งเองมาก่อนเสมอ แล้วตามด้วยลำดับมาตรฐาน
export function colorRank(color: string, product?: HasColorOrder): number {
  const c = norm(color);
  const own = product?.colorOrder?.findIndex((x) => norm(x) === c) ?? -1;
  if (own >= 0) return own;
  const base = DEFAULT_COLOR_ORDER.indexOf(c);
  if (base >= 0) return 10_000 + base;
  return Number.MAX_SAFE_INTEGER;
}

export function compareColors(a: string, b: string, product?: HasColorOrder): number {
  const ra = colorRank(a, product);
  const rb = colorRank(b, product);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.localeCompare(b, "th");
}

export function sortColors(colors: string[], product?: HasColorOrder): string[] {
  return [...colors].sort((a, b) => compareColors(a, b, product));
}

// สีทั้งหมดของรุ่นนี้ตามลำดับที่ใช้แสดง สำหรับหน้าแก้ลำดับ (รวมสีที่รุ่นตั้งไว้แต่ตอนนี้ไม่มีตัวเลือกแล้ว จะถูกตัดออก)
export function orderedColorsOf(variantColors: string[], product?: HasColorOrder): string[] {
  return sortColors([...new Set(variantColors.map(norm).filter(Boolean))], product);
}
