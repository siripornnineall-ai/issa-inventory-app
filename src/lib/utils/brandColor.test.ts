import { describe, it, expect } from "vitest";
import { brandBarStyle, brandColor, brandTint, darken, isHexColor, NEUTRAL_BRAND_COLOR, readableOn } from "./brandColor";

describe("สีประจำแบรนด์", () => {
  it("รับเฉพาะรหัสสี #RRGGBB", () => {
    expect(isHexColor("#5DADC6")).toBe(true);
    expect(isHexColor("#5dadc6")).toBe(true);
    expect(isHexColor("5DADC6")).toBe(false);
    expect(isHexColor("#abc")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });

  it("แบรนด์ที่ไม่มีสีหรือสีผิดรูปแบบ → ใช้สีกลาง", () => {
    expect(brandColor({ color: "#0A3941" })).toBe("#0A3941");
    expect(brandColor({})).toBe(NEUTRAL_BRAND_COLOR);
    expect(brandColor({ color: "javascript:alert(1)" })).toBe(NEUTRAL_BRAND_COLOR);
    expect(brandColor(null)).toBe(NEUTRAL_BRAND_COLOR);
  });

  it("ตัวอักษรบนแถบ: พื้นอ่อน (ฟ้าน้ำทะเล) ใช้ตัวอักษรเข้ม พื้นเข้ม (ดำ/เขียวเข้ม) ใช้ตัวอักษรขาว", () => {
    expect(readableOn("#5DADC6")).toBe("#0c1e20");
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("#0A3941")).toBe("#ffffff");
  });

  it("แถบรวมเข้มกว่าแถบหัวตาราง และตัวอักษรบนแถบรวมของฟ้าน้ำทะเลเปลี่ยนเป็นขาวเมื่อพื้นเข้มพอ", () => {
    expect(darken("#5DADC6", 0.35)).toBe("#3c7081");
    expect(darken("#000000", 0.35)).toBe("#000000");
    const style = brandBarStyle({ color: "#5DADC6" }) as Record<string, string>;
    expect(style["--bar"]).toBe("#5DADC6");
    expect(style["--bar-strong"]).toBe("#3c7081");
    expect(style["--bar-strong-fg"]).toBe("#ffffff");
  });

  it("แบรนด์ไม่มีสี → ไม่ตั้งตัวแปร ตารางใช้สีเขียวเดิม", () => {
    expect(brandBarStyle({})).toBeUndefined();
    expect(brandBarStyle(null)).toBeUndefined();
  });

  it("พื้นจางผสมกับสีขาว", () => {
    expect(brandTint("#5DADC6", 14)).toBe("color-mix(in srgb, #5DADC6 14%, white)");
  });
});
