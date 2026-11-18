"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { equipmentGroupKey } from "@/lib/utils/equipmentGroups";

// สถานะของตารางกรอกจำนวนอุปกรณ์ (หน้ารับเข้า / เบิกออก / โอนย้าย ใช้ร่วมกัน)
// groupKeys = กลุ่มอุปกรณ์ที่เลือกไว้ (ชื่อเดียวกันที่มีไซซ์รวมกลุ่ม) / qtys = จำนวนรายอุปกรณ์ (equipmentId -> จำนวน) ช่องว่าง = ไม่มีใน qtys
export function useEquipmentGrid() {
  const equipment = useStore((s) => s.equipment);
  const [groupKeys, setGroupKeys] = useState<string[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});

  // รายการที่จะบันทึก = ช่องที่กรอกจำนวนมากกว่า 0
  const entries = useMemo(
    () =>
      Object.entries(qtys)
        .filter(([, qty]) => qty > 0)
        .map(([equipmentId, qty]) => ({ equipmentId, qty })),
    [qtys]
  );

  // เพิ่มกลุ่มของอุปกรณ์ที่เลือก: คืน key ของกลุ่มที่เพิ่มใหม่ / null ถ้าเพิ่มไว้แล้วหรือไม่พบอุปกรณ์
  function addGroup(equipmentId: string): { key: string; first: (typeof equipment)[string] } | null {
    const e = equipment[equipmentId];
    if (!e) return null;
    const key = equipmentGroupKey(e);
    if (groupKeys.includes(key)) return null;
    setGroupKeys((prev) => [...prev, key]);
    return { key, first: e };
  }

  function removeGroup(key: string) {
    const ids = new Set(Object.values(equipment).filter((e) => equipmentGroupKey(e) === key).map((e) => e.id));
    setGroupKeys((prev) => prev.filter((k) => k !== key));
    setQtys((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !ids.has(id))));
  }

  function setQty(equipmentId: string, qty: number | undefined) {
    setQtys((prev) => {
      const next = { ...prev };
      if (qty === undefined) delete next[equipmentId];
      else next[equipmentId] = qty;
      return next;
    });
  }

  function reset() {
    setGroupKeys([]);
    setQtys({});
  }

  return { groupKeys, qtys, entries, addGroup, removeGroup, setQty, reset };
}
