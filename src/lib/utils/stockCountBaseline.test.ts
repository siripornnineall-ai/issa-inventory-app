import { describe, it, expect } from "vitest";
import { emptyState } from "@/lib/store/state";
import { snapshotSystemQty } from "./stockCountBaseline";

describe("snapshotSystemQty", () => {
  it("ถ่ายยอดคงเหลือของทุกตัวเลือกของรุ่นนั้นในคลังที่เลือก (ไม่มีแถวสต็อกถือเป็น 0 และไม่รวมรุ่นอื่น/คลังอื่น)", () => {
    const s = emptyState();
    s.variants = {
      a: { id: "a", productId: "p1" },
      b: { id: "b", productId: "p1" },
      c: { id: "c", productId: "p2" },
    } as never;
    s.variantStock = {
      "a::w1": { itemId: "a", warehouseId: "w1", qtyOnHand: 4, qtyReserved: 0 },
      "a::w2": { itemId: "a", warehouseId: "w2", qtyOnHand: 9, qtyReserved: 0 },
      "c::w1": { itemId: "c", warehouseId: "w1", qtyOnHand: 7, qtyReserved: 0 },
    };
    expect(snapshotSystemQty(s, "p1", "w1")).toEqual({ a: 4, b: 0 });
  });
});
