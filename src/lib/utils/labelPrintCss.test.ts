import { describe, it, expect } from "vitest";
import { buildLabelPrintCss, rollSizeMm } from "./labelPrintCss";
import { DEFAULT_LABEL_CALIBRATION, type LabelCalibration } from "./labelCalibration";

const a4: LabelCalibration = { ...DEFAULT_LABEL_CALIBRATION, paper: "a4-sheet" };
const roll: LabelCalibration = { ...DEFAULT_LABEL_CALIBRATION, paper: "roll" };

describe("buildLabelPrintCss — A4 sheet (existing behavior must not change)", () => {
  it("prints on A4 with the calibrated grid and no roll rules", () => {
    const css = buildLabelPrintCss(a4);
    expect(css).toContain("@page { size: A4; margin: 0; }");
    expect(css).toContain("grid-template-columns: repeat(3, 50mm)");
    expect(css).toContain("padding-top: 8mm");
    expect(css).toContain("padding-left: 8mm");
    expect(css).toContain("gap: 3mm 4mm");
    expect(css).not.toContain("break-after: page");
    expect(css).not.toContain("qr-label-name");
  });

  it("is the default paper, so users with saved settings from before the roll mode keep A4", () => {
    expect(DEFAULT_LABEL_CALIBRATION.paper).toBe("a4-sheet");
    const legacySaved = { columns: 4, cellWidthMm: 45 } as Partial<LabelCalibration>;
    expect({ ...DEFAULT_LABEL_CALIBRATION, ...legacySaved }.paper).toBe("a4-sheet");
  });
});

describe("buildLabelPrintCss — 50x30 mm label roll", () => {
  it("makes one 50x30 mm page per label with no page margin", () => {
    const css = buildLabelPrintCss(roll);
    expect(css).toContain("@page { size: 50mm 30mm; margin: 0; }");
    expect(css).toContain("break-after: page");
    expect(css).toContain(".qr-label-card:last-child { break-after: auto");
    expect(css).not.toContain("size: A4");
  });

  it("keeps the card a hair shorter than the page so the printer does not eject a blank label", () => {
    expect(buildLabelPrintCss(roll)).toContain("height: 29.6mm");
  });

  it("sizes the QR to fit inside the label height", () => {
    // 30mm tall, 1.5mm padding each side -> at most 27mm; 48% of 50mm width = 24mm
    expect(buildLabelPrintCss(roll)).toContain("width: 24mm !important");
  });

  it("applies the user's offsets for printers that print slightly off-center", () => {
    const css = buildLabelPrintCss({ ...roll, rollOffsetXMm: -1.5, rollOffsetYMm: 2 });
    expect(css).toContain("left: -1.5mm");
    expect(css).toContain("top: 2mm");
  });

  it("follows a different roll size and ignores nonsense sizes", () => {
    expect(buildLabelPrintCss({ ...roll, rollWidthMm: 40, rollHeightMm: 30 })).toContain("size: 40mm 30mm");
    expect(rollSizeMm({ rollWidthMm: 0, rollHeightMm: -5 })).toEqual({ w: 20, h: 15 });
    expect(rollSizeMm({ rollWidthMm: Number.NaN, rollHeightMm: 9999 })).toEqual({ w: 20, h: 200 });
  });
});
