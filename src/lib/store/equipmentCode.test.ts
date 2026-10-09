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

  it("หลายรายการใช้รูปชุดเดียวกัน (เช่นหลายไซซ์) ต้องได้ id รูปไม่ซ้ำกัน ไม่งั้นบันทึกลงฐานข้อมูลไม่ได้", () => {
    const shared = [{ id: "img-1", url: "https://x/a.jpg", isMain: true, sortOrder: 0, kind: "selling" }];
    produce(emptyState() as AppState, (draft) => {
      const a = createEquipment(draft as never, { ...(base as object), images: shared } as never);
      const b = createEquipment(draft as never, { ...(base as object), images: shared } as never);
      const ids = [...draft.equipment[a].images, ...draft.equipment[b].images].map((i) => i.id);
      expect(new Set(ids).size).toBe(2);
      expect(draft.equipment[a].images[0].url).toBe("https://x/a.jpg");
    });
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
