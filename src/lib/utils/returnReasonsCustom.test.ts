import { describe, expect, it } from "vitest";
import { customReasonCode, isReturnReason, returnReasonLabel } from "./returnReasons";

describe("เหตุผลที่เพิ่มเอง", () => {
  it("รหัส x:ข้อความ อ่านชื่อกลับได้ และถือเป็นเหตุผลที่ใช้ได้ ส่วนข้อความว่าง/รหัสมั่วไม่ได้", () => {
    expect(customReasonCode("  ลูกค้าสั่งซ้ำ ")).toBe("x:ลูกค้าสั่งซ้ำ");
    expect(isReturnReason("x:ลูกค้าสั่งซ้ำ")).toBe(true);
    expect(isReturnReason("x:   ")).toBe(false);
    expect(isReturnReason("nope")).toBe(false);
    expect(isReturnReason("size")).toBe(true);
    expect(returnReasonLabel("x:ลูกค้าสั่งซ้ำ")).toBe("ลูกค้าสั่งซ้ำ");
    expect(returnReasonLabel("size")).toBe("ไซซ์ไม่พอดี");
    expect(returnReasonLabel(undefined)).toBe("ไม่ได้ระบุ");
  });
});
