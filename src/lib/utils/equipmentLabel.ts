// ชื่ออุปกรณ์พร้อมไซซ์ (ถ้ามี) สำหรับแสดงผล เช่น "เลเบิ้ล Issa (M)"
export function equipmentLabel(e: { name: string; size?: string } | undefined | null): string {
  if (!e) return "";
  const size = e.size?.trim();
  return size ? `${e.name} (${size})` : e.name;
}
