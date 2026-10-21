import { describe, it, expect } from "vitest";
import { A4_SHEET_PRESETS, DEFAULT_LABEL_CALIBRATION, matchingA4Preset } from "./labelCalibration";
import { buildLabelPrintCss } from "./labelPrintCss";

describe("แบบแผ่นสติกเกอร์ A4 สำเร็จรูป", () => {
  it("แบบ 24 ดวง (3×8) วางครบ 8 แถวในหน้า A4 ได้โดยไม่ล้นไปหน้าถัดไป และ 3 คอลัมน์ไม่เกินความกว้าง", () => {
    const p = A4_SHEET_PRESETS.find((x) => x.key === "a4-24")!.values;
    expect(p.columns).toBe(3);
    expect(p.marginTopMm + 8 * p.cellHeightMm + 7 * p.rowGapMm).toBeLessThanOrEqual(297);
    expect(p.marginLeftMm + 3 * p.cellWidthMm + 2 * p.colGapMm).toBeLessThanOrEqual(210);
    expect(p.a4ExactMargins).toBe(true);
  });

  it("แบบ 50×25 มม. ตรงกับค่าเริ่มต้นเดิมของระบบทุกค่า (ผู้ใช้เดิมไม่โดนเปลี่ยน)", () => {
    const p = A4_SHEET_PRESETS.find((x) => x.key === "a4-50x25")!;
    expect(matchingA4Preset(DEFAULT_LABEL_CALIBRATION)?.key).toBe("a4-50x25");
    expect(p.values.a4ExactMargins).toBe(false);
  });

  it("matchingA4Preset: ค่าที่ปรับเองจนไม่ตรงแบบใดเลย จะไม่ถูกจัดว่าเป็นแบบสำเร็จรูป", () => {
    expect(matchingA4Preset({ ...DEFAULT_LABEL_CALIBRATION, cellWidthMm: 51 })).toBeUndefined();
    const p24 = A4_SHEET_PRESETS.find((x) => x.key === "a4-24")!.values;
    expect(matchingA4Preset({ ...DEFAULT_LABEL_CALIBRATION, ...p24 })?.key).toBe("a4-24");
    // ค่าเดียวกันแต่ไม่ได้ตัดขอบหน้าเว็บ ถือว่าเป็นคนละแบบ
    expect(matchingA4Preset({ ...DEFAULT_LABEL_CALIBRATION, ...p24, a4ExactMargins: false })).toBeUndefined();
  });

  it("CSS: เฉพาะแบบวัดขอบจากกระดาษจริงที่ตัดขอบในตัวของหน้าเว็บ แบบเดิมไม่ถูกแตะ", () => {
    const p24 = A4_SHEET_PRESETS.find((x) => x.key === "a4-24")!.values;
    const exact = buildLabelPrintCss({ ...DEFAULT_LABEL_CALIBRATION, ...p24 });
    expect(exact).toContain(".qr-print-root { padding: 0 !important;");
    expect(exact).toContain("repeat(3, 64mm)");
    const legacy = buildLabelPrintCss(DEFAULT_LABEL_CALIBRATION);
    expect(legacy).not.toContain(".qr-print-root");
  });
});
