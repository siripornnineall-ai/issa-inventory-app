import { describe, it, expect } from "vitest";
import { applyPriceAdjustment, sizesInRows } from "./priceAdjust";

const r = (color: string, size: string, sellingPrice: number, purchasePrice = 200) => ({ color, size, sellingPrice, purchasePrice });

describe("sizesInRows", () => {
  it("ไซซ์ไม่ซ้ำ เรียงตามขนาดจริง (S ก่อน XL, 2XL หลัง XL)", () => {
    expect(sizesInRows([r("ดำ", "2XL", 1), r("ดำ", "S", 1), r("ครีม", "S", 1), r("ดำ", "XL", 1), r("ดำ", "M", 1)])).toEqual(["S", "M", "XL", "2XL"]);
  });
});

describe("applyPriceAdjustment", () => {
  const rows = [r("ดำ", "S", 1090), r("ดำ", "XL", 1090), r("ดำ", "2XL", 1190), r("ครีม", "XL", 1090), r("ครีม", "2XL", 1190)];

  it("เพิ่มราคาขายเฉพาะไซซ์ที่เลือก ทุกสี ไซซ์อื่นไม่แตะ", () => {
    const res = applyPriceAdjustment(rows, { field: "sellingPrice", delta: 100, sizes: ["XL", "2XL"] });
    expect(res.changed).toBe(4);
    expect(res.rows.map((x) => x.sellingPrice)).toEqual([1090, 1190, 1290, 1190, 1290]);
    expect(res.rows[0]).toBe(rows[0]); // แถวที่ไม่เกี่ยวข้องเป็นออบเจ็กต์เดิม
    expect(rows[1].sellingPrice).toBe(1090); // ไม่แก้ของเดิม (immutable)
  });

  it("ปรับราคาซื้อได้ โดยไม่แตะราคาขาย", () => {
    const res = applyPriceAdjustment(rows, { field: "purchasePrice", delta: 50, sizes: ["S"] });
    expect(res.rows[0]).toMatchObject({ purchasePrice: 250, sellingPrice: 1090 });
  });

  it("ลดราคา (delta ติดลบ) ได้", () => {
    const res = applyPriceAdjustment(rows, { field: "sellingPrice", delta: -90, sizes: ["S"] });
    expect(res.rows[0].sellingPrice).toBe(1000);
  });

  it("ลดจนราคาติดลบ: ไม่ปรับอะไรเลย และบอกว่าไซซ์ไหนติดลบ", () => {
    const res = applyPriceAdjustment(rows, { field: "purchasePrice", delta: -300, sizes: ["S", "XL"] });
    expect(res.changed).toBe(0);
    expect(res.rows).toBe(rows);
    expect(res.negative.map((n) => n.size)).toEqual(["S", "XL", "XL"]);
  });

  it("ลดจนเหลือ 0 พอดีได้ (ไม่ติดลบ)", () => {
    const res = applyPriceAdjustment([r("ดำ", "S", 100)], { field: "sellingPrice", delta: -100, sizes: ["S"] });
    expect(res.changed).toBe(1);
    expect(res.rows[0].sellingPrice).toBe(0);
  });

  it("ทศนิยมไม่เพี้ยน (0.1 + 0.2) และ delta = 0 หรือไม่เลือกไซซ์ ไม่เปลี่ยนอะไร", () => {
    expect(applyPriceAdjustment([r("ดำ", "S", 0.1)], { field: "sellingPrice", delta: 0.2, sizes: ["S"] }).rows[0].sellingPrice).toBe(0.3);
    expect(applyPriceAdjustment(rows, { field: "sellingPrice", delta: 0, sizes: ["S"] }).changed).toBe(0);
    expect(applyPriceAdjustment(rows, { field: "sellingPrice", delta: 100, sizes: [] }).changed).toBe(0);
  });
});
