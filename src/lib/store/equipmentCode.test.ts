import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import { createEquipment, nextEquipmentCode } from "./engine";
import type { AppState } from "./state";

const base = {
  name: "ตะข้อกางเกง",
  type: "hook",
  images: [],
  purchasePricePerUnit: 240,
  unit: "ชิ้น",
  reorderPoint: 10,
  reorderQty: 50,
  status: "active",
} as never;

describe("รหัสอุปกรณ์ที่สร้างให้เอง (ไม่ต้องกรอกแล้ว)", () => {
  it("สร้างอุปกรณ์โดยไม่ใส่รหัส ได้รหัสภายใน EQ-0001, EQ-0002 ต่อกันไม่ซ้ำ", () => {
    const next = produce(emptyState() as AppState, (draft) => {
      const a = createEquipment(draft as never, base);
      const b = createEquipment(draft as never, { ...(base as object), name: "ซิป" } as never);
      expect(draft.equipment[a].code).toBe("EQ-0001");
      expect(draft.equipment[b].code).toBe("EQ-0002");
    });
    expect(Object.keys(next.equipment)).toHaveLength(2);
  });

  it("ต่อจากเลขสูงสุดที่มีอยู่ และไม่ไปชนรหัสเก่า เช่น IS-ACC-HOOK-001", () => {
    produce(emptyState() as AppState, (draft) => {
      createEquipment(draft as never, { ...(base as object), code: "IS-ACC-HOOK-001" } as never);
      expect(nextEquipmentCode(draft as never)).toBe("EQ-0001");
      const id = createEquipment(draft as never, { ...(base as object), name: "กระดุม" } as never);
      expect(draft.equipment[id].code).toBe("EQ-0001");
      expect(nextEquipmentCode(draft as never)).toBe("EQ-0002");
    });
  });
});
