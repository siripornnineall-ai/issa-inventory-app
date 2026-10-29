import { describe, it, expect } from "vitest";
import { brandColor, brandTint, isHexColor, NEUTRAL_BRAND_COLOR } from "./brandColor";

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

  it("พื้นจางผสมกับสีขาว", () => {
    expect(brandTint("#5DADC6", 14)).toBe("color-mix(in srgb, #5DADC6 14%, white)");
  });
});
