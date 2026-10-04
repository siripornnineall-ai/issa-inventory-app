// ช่องตัวเลข (type="number") ที่มีค่าเริ่มต้น 0: พิมพ์ 1 8 0 ต่อจาก 0 แล้วขึ้น "0180" ไม่ใช่ "180"
// สาเหตุ: React ไม่อัปเดตข้อความในช่องเมื่อค่าตัวเลขเท่าเดิม (180 กับ "0180" ถือว่าเท่ากัน) เลข 0 นำหน้าจึงค้างอยู่
// แก้โดยตัดเลข 0 นำหน้าออกเองทุกครั้งที่พิมพ์ ก่อนส่งค่าไปให้หน้าที่ใช้ — ไม่แตะทศนิยมอย่าง 0.5 หรือ 0.05

export function normalizeLeadingZeros(value: string): string {
  // ตัดเลข 0 ที่ตามด้วยตัวเลขอีกตัว: 0180 -> 180, 007 -> 7, -05 -> -5, 00.5 -> 0.5 (0.5 และ 0 เดี่ยว ๆ คงเดิม)
  return value.replace(/^(-?)0+(?=[0-9])/, "$1");
}

export function stripLeadingZeros(el: HTMLInputElement): void {
  const next = normalizeLeadingZeros(el.value);
  if (next !== el.value) el.value = next;
}
