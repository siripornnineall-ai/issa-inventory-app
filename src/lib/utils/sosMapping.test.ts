import { describe, it, expect } from "vitest";
import { emptyState } from "@/lib/store/state";
import { matchSosVariant, normalizeSosSize, parseSosDescription, sosCostPerPiece } from "./sosMapping";

function state() {
  return {
    ...emptyState(),
    products: { p1: { id: "p1", sellingName: "Billie Slim", status: "active", images: [] }, p2: { id: "p2", sellingName: "Justin Wide", status: "active", images: [] } },
    variants: {
      v1: { id: "v1", productId: "p1", color: "น้ำตาลไหม้", size: "M", sku: "A", active: true },
      v2: { id: "v2", productId: "p1", color: "เทาดิน", size: "2XL", sku: "B", active: true },
      v3: { id: "v3", productId: "p1", color: "โอวัลติน", size: "L", sku: "C", active: true },
      v4: { id: "v4", productId: "p2", color: "ฟ้าเข้ม", size: "M", sku: "D", active: true },
    },
  } as never;
}

describe("จับคู่รายการของ SOS กับสินค้าเรา", () => {
  it("สี: brown = น้ำตาลไหม้, grey = เทาดิน, khaki = โอวัลติน (เจ้าของงานยืนยัน)", () => {
    expect(parseSosDescription("Billie Slim ทรงกระบอกเล็ก brown M").colorTh).toBe("น้ำตาลไหม้");
    expect(parseSosDescription("Billie Slim ทรงกระบอกเล็ก grey XXL").colorTh).toBe("เทาดิน");
    expect(parseSosDescription("Billie Slim ทรงกระบอกเล็ก khaki L").colorTh).toBe("โอวัลติน");
    expect(parseSosDescription("Wendy Mid ทรงกระบอกกลาง black XL")).toMatchObject({ colorTh: "ดำ", size: "XL" });
    expect(parseSosDescription("Wendy Mid ทรงกระบอกกลาง navy S").colorTh).toBe("กรม");
  });

  it("ไซซ์: XXL = 2XL, XXXL = 3XL, ไซซ์ก่อนสีและมีคำว่า อื่นๆ ก็อ่านได้", () => {
    expect(normalizeSosSize("XXL")).toBe("2XL");
    expect(normalizeSosSize("xxxl")).toBe("3XL");
    expect(normalizeSosSize("4XL")).toBe("4XL");
    expect(normalizeSosSize("ยาว")).toBeNull();
    expect(parseSosDescription("Billie Slim ทรงกระบอกเล็ก 4XL black อื่นๆ")).toMatchObject({ colorTh: "ดำ", size: "4XL" });
    expect(parseSosDescription("เสื้อ Free size").size).toBe("Freesize");
  });

  it("จับคู่เป็นตัวเลือกสินค้าเราได้เมื่อรุ่น สี ไซซ์ตรง", () => {
    const s = state();
    expect(matchSosVariant(s, "Billie Slim ทรงกระบอกเล็ก brown M").variantId).toBe("v1");
    expect(matchSosVariant(s, "Billie Slim ทรงกระบอกเล็ก grey XXL").variantId).toBe("v2");
    expect(matchSosVariant(s, "Billie  Slim ทรงกระบอกเล็ก khaki L").variantId).toBe("v3"); // ช่องว่างซ้อน
  });

  it("ใช้ชื่อสีไทยในคำอธิบายของ SOS ก่อน (เช่น Justin Wide ฟ้าเข้ม blue M)", () => {
    expect(matchSosVariant(state(), "Justin Wide ฟ้าเข้ม blue M").variantId).toBe("v4");
  });

  it("จับคู่ไม่ได้ = บอกเหตุผล (ไม่มีรุ่น / ไม่มีสีไซซ์ / ค่าส่ง)", () => {
    const s = state();
    expect(matchSosVariant(s, "Snow Mid กระบอกกลาง grey L")).toMatchObject({ variantId: null, reason: "ไม่พบรุ่นในระบบ" });
    expect(matchSosVariant(s, "Billie Slim ทรงกระบอกเล็ก white M").reason).toContain("ไม่มี ขาว / M");
    expect(matchSosVariant(s, "EMS Issa อื่นๆ").reason).toContain("ค่าส่ง");
  });

  it("ต้นทุนต่อชิ้น: 200 ทุกรุ่น เสื้อสูท 400 ค่าส่ง (EMS) 0", () => {
    expect(sosCostPerPiece("Billie Slim ทรงกระบอกเล็ก brown M")).toBe(200);
    expect(sosCostPerPiece("สูท Classy Blazer black M")).toBe(400);
    expect(sosCostPerPiece("Carter Blazer navy L")).toBe(400);
    expect(sosCostPerPiece("EMS Issa อื่นๆ")).toBe(0);
  });
});
