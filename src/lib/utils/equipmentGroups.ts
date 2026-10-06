import type { Equipment } from "@/lib/types";
import { compareSizes } from "@/lib/utils/sizes";

// อุปกรณ์ที่ "มีไซซ์" และชื่อเดียวกันถือเป็นกลุ่มเดียวกัน (เหมือนสินค้าที่มีหลายตัวเลือก) แต่ละไซซ์ยังเป็นรายการสต็อกของตัวเอง
// ส่วนอุปกรณ์ไม่มีไซซ์เป็นกลุ่มของตัวเองเสมอ (ไม่รวมกับรายการชื่อซ้ำ)
export interface EquipmentGroup {
  key: string;
  name: string;
  items: Equipment[]; // เรียงตามไซซ์
  primary: Equipment; // รายการแรกของกลุ่ม ใช้เป็นปลายทางเมื่อกดเข้าไปดู
}

export function equipmentGroupKey(e: Equipment): string {
  return e.size?.trim() ? `size:${e.name.trim().toLowerCase()}` : `id:${e.id}`;
}

export function groupEquipment(list: Equipment[]): EquipmentGroup[] {
  const map = new Map<string, Equipment[]>();
  for (const e of list) {
    const key = equipmentGroupKey(e);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => compareSizes(a.size ?? "", b.size ?? ""));
    return { key, name: sorted[0].name, items: sorted, primary: sorted[0] };
  });
}

// รายการทั้งกลุ่มของอุปกรณ์ชิ้นนี้ (รวมตัวมันเอง)
export function equipmentSiblings(all: Equipment[], e: Equipment): Equipment[] {
  const key = equipmentGroupKey(e);
  return groupEquipment(all.filter((x) => equipmentGroupKey(x) === key))[0]?.items ?? [e];
}
