import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIAL_RATES, materialNeeds, parseRates } from "./materialPlan";

describe("materialNeeds", () => {
  it("คูณจำนวนที่ต้องผลิตกับอัตราต่อตัว และรวมทั้งหมด", () => {
    const r = materialNeeds(
      [
        { id: "a", name: "A", need: 100 },
        { id: "b", name: "B", need: 0 },
        { id: "c", name: "C", need: 50 },
      ],
      DEFAULT_MATERIAL_RATES
    );
    expect(r.rows.map((x) => x.id)).toEqual(["a", "c"]); // ข้ามรุ่นที่ไม่ต้องผลิต
    expect(r.pieces).toBe(150);
    expect(r.totals.main).toBeCloseTo(217.5);
    expect(r.totals.pocket).toBeCloseTo(28.5);
    expect(r.rows[0].amounts.main).toBeCloseTo(145);
  });
});

describe("parseRates", () => {
  it("ใช้ค่าตั้งต้นเมื่อไม่มี/พัง และใช้ค่าที่แก้เมื่อถูกต้อง", () => {
    expect(parseRates(null)).toEqual(DEFAULT_MATERIAL_RATES);
    expect(parseRates("{bad")).toEqual(DEFAULT_MATERIAL_RATES);
    const r = parseRates(JSON.stringify({ main: 1.5, pocket: "x" }));
    expect(r[0].perPiece).toBe(1.5);
    expect(r[1].perPiece).toBe(0.19);
  });
});

import { materialByColor, parsePocketMap } from "./materialPlan";

describe("materialByColor", () => {
  it("รวมตามสีข้ามรุ่น แยกผ้ากระเป๋าดำ/ขาว และสีที่ไม่รู้จักเป็นไม่ระบุ", () => {
    const models = [
      { colors: [{ color: "ดำ", need: 100 }, { color: "ขาว", need: 50 }, { color: "ชมพู", need: 10 }] },
      { colors: [{ color: "ดำ", need: 100 }, { color: "ครีม", need: 20 }, { color: "กรม", need: 0 }] },
    ];
    const r = materialByColor(models, { main: 1.45, pocket: 0.19 }, parsePocketMap(null));
    const black = r.rows.find((x) => x.color === "ดำ")!;
    expect(black.pieces).toBe(200);
    expect(black.main).toBeCloseTo(290);
    expect(black.pocketColor).toBe("ดำ");
    expect(r.rows.find((x) => x.color === "กรม")).toBeUndefined(); // ไม่ต้องผลิต ไม่โชว์
    expect(r.pocketTotals.ดำ).toBeCloseTo(38);
    expect(r.pocketTotals.ขาว).toBeCloseTo((50 + 20) * 0.19);
    expect(r.pocketTotals.ไม่ระบุ).toBeCloseTo(1.9);
  });
  it("ผู้ใช้เลือกสีผ้ากระเป๋าให้สีใหม่ได้", () => {
    const m = parsePocketMap(JSON.stringify({ ชมพู: "ขาว" }));
    expect(m["ชมพู"]).toBe("ขาว");
    expect(m["ดำ"]).toBe("ดำ");
  });
});
