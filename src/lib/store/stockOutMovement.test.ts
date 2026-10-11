import { describe, it, expect } from "vitest";
import { isStockOutMovement } from "./selectors";

describe("isStockOutMovement", () => {
  it("การปรับยอดลงจากการนับสต็อก ไม่ใช่สต็อกออก (เคส Slender เขียวมิ้นท์ 3XL นับ 3 แล้วนับใหม่เป็น 1)", () => {
    expect(isStockOutMovement({ qtyChange: -2, movementType: "adjustment" })).toBe(false);
  });
  it("เบิก/ขาย/ใช้ภายใน/เสียหาย/สูญหาย เป็นสต็อกออก", () => {
    for (const t of ["sale", "internal_use", "damaged", "lost", "photoshoot", "transfer_out", "return_to_source", "send_to_store"]) {
      expect(isStockOutMovement({ qtyChange: -1, movementType: t })).toBe(true);
    }
  });
  it("รายการเพิ่ม และการคืนสต็อกจากยกเลิกออเดอร์ ไม่ใช่สต็อกออก", () => {
    expect(isStockOutMovement({ qtyChange: 3, movementType: "stock_in" })).toBe(false);
    expect(isStockOutMovement({ qtyChange: -3, movementType: "cancel_restock" })).toBe(false);
  });
});
