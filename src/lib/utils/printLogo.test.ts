import { describe, it, expect } from "vitest";
import { binarizeLogo, otsuThreshold } from "./printLogo";

// โลโก้จำลองขนาด 10x10: พื้น + ตัวอักษรตรงกลาง (ช่วงกลาง 4x4 พิกเซล)
function logo(bg: [number, number, number], mark: [number, number, number], alpha = 255) {
  const w = 10;
  const data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const isMark = x >= 3 && x < 7 && y >= 3 && y < 7;
      const c = isMark ? mark : bg;
      const o = (y * w + x) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = alpha;
    }
  }
  return { data, width: w, height: w };
}
const px = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) => img.data[(y * img.width + x) * 4];

describe("แปลงโลโก้เป็นขาวดำสำหรับเครื่องพิมพ์ฉลาก", () => {
  it("makes the light-blue ISSA Activewear style logo a black square with a white mark, instead of all white", () => {
    const out = binarizeLogo(logo([91, 172, 198], [220, 230, 242]));
    expect(px(out, 0, 0)).toBe(0); // พื้นฟ้าอ่อน -> ดำ
    expect(px(out, 5, 5)).toBe(255); // ตัวอักษรเกือบขาว -> ขาว
  });

  it("keeps a dark logo with a light mark the same way", () => {
    const out = binarizeLogo(logo([11, 56, 65], [225, 225, 232]));
    expect(px(out, 0, 0)).toBe(0);
    expect(px(out, 5, 5)).toBe(255);
  });

  it("keeps the usual dark mark on a white background (dark stays black, light stays white)", () => {
    const out = binarizeLogo(logo([255, 255, 255], [20, 20, 20]));
    expect(px(out, 0, 0)).toBe(255);
    expect(px(out, 5, 5)).toBe(0);
  });

  it("treats transparent pixels as white paper", () => {
    const out = binarizeLogo(logo([0, 0, 0], [0, 0, 0], 0));
    expect(px(out, 0, 0)).toBe(255);
  });

  it("outputs only pure black and white, fully opaque", () => {
    const out = binarizeLogo(logo([91, 172, 198], [220, 230, 242]));
    for (let i = 0; i < out.width * out.width; i++) {
      expect([0, 255]).toContain(out.data[i * 4]);
      expect(out.data[i * 4 + 3]).toBe(255);
    }
  });

  it("finds a threshold between two brightness groups and does not crash on a flat image", () => {
    const luma = new Uint8Array([40, 40, 40, 200, 200, 200]);
    const t = otsuThreshold(luma);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
    expect(() => otsuThreshold(new Uint8Array(100).fill(128))).not.toThrow();
  });
});
