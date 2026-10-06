import type { AppState } from "@/lib/store/state";
import type { Equipment } from "@/lib/types";
import { groupEquipment, type EquipmentGroup } from "./equipmentGroups";

// จำนวนคงเหลือต่ออุปกรณ์ รวมทุกคลัง หรือเฉพาะคลังที่เลือก
export function qtyByEquipment(state: AppState, warehouseId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of Object.values(state.equipmentStock)) {
    if (warehouseId && s.warehouseId !== warehouseId) continue;
    map.set(s.itemId, (map.get(s.itemId) ?? 0) + s.qtyOnHand);
  }
  return map;
}

export interface EquipmentOverviewEntry {
  group: EquipmentGroup;
  sizes: { item: Equipment; qty: number }[]; // เรียงตามไซซ์ (ไม่มีไซซ์ = 1 รายการ)
  total: number;
  negativeCells: number;
  hasSizes: boolean;
}

export function buildEquipmentOverview(
  list: Equipment[],
  qty: Map<string, number>,
  opts: { type?: string; hideEmpty?: boolean } = {}
): EquipmentOverviewEntry[] {
  const entries = groupEquipment(list.filter((e) => !opts.type || e.type === opts.type)).map((group) => {
    const sizes = group.items.map((item) => ({ item, qty: qty.get(item.id) ?? 0 }));
    return {
      group,
      sizes,
      total: sizes.reduce((sum, s) => sum + s.qty, 0),
      negativeCells: sizes.filter((s) => s.qty < 0).length,
      hasSizes: group.items.some((i) => Boolean(i.size?.trim())),
    };
  });
  const filtered = opts.hideEmpty ? entries.filter((e) => e.sizes.some((s) => s.qty !== 0)) : entries;
  // เรียงจากสต็อกรวมมากไปน้อย แล้วตามชื่อ (เหมือนหน้าสต็อกภาพรวมของสินค้า)
  return filtered.sort((a, b) => b.total - a.total || a.group.name.localeCompare(b.group.name, "th"));
}
