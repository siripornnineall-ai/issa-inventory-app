import { describe, it, expect } from "vitest";
import { isVerificationOnly, movementDirection, movementTypesForTab, summarizeMovements } from "./movementTabs";
import { MOVEMENT_TYPE_LABEL_TH, type MovementType } from "@/lib/types";

const m = (movementType: MovementType, qtyChange: number) => ({ movementType, qtyChange });

describe("movementDirection", () => {
  it("รับเข้า โอนเข้า คืนสต็อก = เข้า / ขาย เบิก โอนออก เสียหาย ฯลฯ = ออก / ปรับยอด = ปรับยอด ไม่ปนกับเข้าออก", () => {
    expect(movementDirection(m("stock_in", 5))).toBe("in");
    expect(movementDirection(m("transfer_in", 2))).toBe("in");
    expect(movementDirection(m("cancel_restock", 1))).toBe("in");
    expect(movementDirection(m("sale", -1))).toBe("out");
    expect(movementDirection(m("internal_use", -2))).toBe("out");
    expect(movementDirection(m("transfer_out", -2))).toBe("out");
    expect(movementDirection(m("adjustment", -2))).toBe("adjust");
    expect(movementDirection(m("adjustment", 0))).toBe("adjust");
  });
  it("ทั้ง 4 ประเภทสินค้าคืนเป็นแท็บ 'สินค้าคืน' ของตัวเอง ไม่ปนกับสินค้าเข้า", () => {
    for (const t of ["return_rts", "return_customer", "return_defective", "return_exchange"] as const) {
      expect(movementDirection(m(t, 1))).toBe("return");
      expect(movementTypesForTab("in")).not.toContain(t);
      expect(movementTypesForTab("return")).toContain(t);
    }
  });
  it("แปลงรุ่น (ตัดตัวเปล่า/ได้ของที่เย็บ) เป็นแท็บของตัวเอง ไม่นับเป็นเข้า/ออก และนับจำนวนที่ได้ครั้งเดียว", () => {
    expect(movementDirection(m("convert_out", -2))).toBe("convert");
    expect(movementDirection(m("convert_in", 2))).toBe("convert");
    expect(movementTypesForTab("convert")).toEqual(["convert_out", "convert_in"]);
    expect(movementTypesForTab("out")).not.toContain("convert_out");
    const t = summarizeMovements([m("sale", -2), m("convert_out", -2), m("convert_in", 2)]);
    expect(t).toMatchObject({ outQty: 2, outCount: 1, convertQty: 2, convertCount: 1, inQty: 0 });
  });
  it("summarizeMovements นับสินค้าคืนแยก ไม่รวมกับยอดเข้า", () => {
    const t = summarizeMovements([m("stock_in", 5), m("return_customer", 2), m("return_defective", 1)]);
    expect(t).toMatchObject({ inQty: 5, inCount: 1, returnQty: 3, returnCount: 2 });
  });
  it("ประเภทอื่น ๆ ดูจากเครื่องหมายของจำนวน", () => {
    expect(movementDirection(m("other", 3))).toBe("in");
    expect(movementDirection(m("other", -3))).toBe("out");
    expect(movementDirection(m("other", 0))).toBe("adjust");
  });
  it("ทุกประเภทที่ระบบมี ถูกจัดเข้าแท็บใดแท็บหนึ่งเสมอ (ไม่หลุดจากทุกแท็บ)", () => {
    for (const type of Object.keys(MOVEMENT_TYPE_LABEL_TH) as MovementType[]) {
      const d = movementDirection(m(type, -1));
      const types = movementTypesForTab(d);
      if (type !== "other") expect(types).toContain(type);
    }
  });
});

describe("summarizeMovements", () => {
  it("รวมเข้า ออก ปรับขึ้น ปรับลง และนับรายการยืนยันยอด (0 ชิ้น) แยกต่างหาก", () => {
    const t = summarizeMovements([m("stock_in", 5), m("stock_in", 3), m("sale", -2), m("transfer_out", -1), m("adjustment", 4), m("adjustment", -2), m("adjustment", 0), m("adjustment", 0)]);
    expect(t).toMatchObject({ inQty: 8, inCount: 2, outQty: 3, outCount: 2, adjustUp: 4, adjustDown: 2, adjustCount: 2, verifiedCount: 2 });
  });
  it("isVerificationOnly: เฉพาะปรับยอดที่เปลี่ยน 0 ชิ้น", () => {
    expect(isVerificationOnly(m("adjustment", 0))).toBe(true);
    expect(isVerificationOnly(m("adjustment", 1))).toBe(false);
    expect(isVerificationOnly(m("sale", 0))).toBe(false);
  });
});
