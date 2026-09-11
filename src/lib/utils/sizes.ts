// ลำดับไซซ์เสื้อผ้ามาตรฐาน ใช้เรียงลำดับให้อ่านง่ายทุกที่ที่แสดงรายการไซซ์ (ไม่ใช่เรียงตามตัวอักษร
// เพราะ "10XL" ต้องมาหลัง "9XL" และ "S" ต้องมาก่อน "XL" ตามขนาดจริง ไม่ใช่ตามตัวอักษร)
export const SIZE_PRESETS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL", "9XL"];

export function compareSizes(a: string, b: string): number {
  const ia = SIZE_PRESETS.indexOf(a.toUpperCase());
  const ib = SIZE_PRESETS.indexOf(b.toUpperCase());
  const ra = ia === -1 ? SIZE_PRESETS.length : ia;
  const rb = ib === -1 ? SIZE_PRESETS.length : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}
