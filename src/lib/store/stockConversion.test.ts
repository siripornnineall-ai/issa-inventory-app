import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import * as engine from "./engine";
import { dashboardStats, lowStockVariants, totalProductQtyNow } from "./selectors";

const FROM = "2000-01-01T00:00:00.000Z";
const TO = "2100-01-01T00:00:00.000Z";
const DATE = new Date().toISOString();

// ตัวเปล่า Billie Wide (ดำ M ดำ L) มีของ 5/3 ชิ้น, Bobbie Mid ตัวเลือกคู่กัน (ดำ M ดำ L ครีม M ที่ไม่มีคู่)
function seed() {
  const ids = { wh: "", bw: "", bm: "", wM: "", wL: "", mM: "", mL: "", mCream: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    ids.bw = engine.createProduct(d, { sellingName: "Billie Wide", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    ids.bm = engine.createProduct(d, { sellingName: "Bobbie Mid", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    ids.wM = engine.addVariant(d, ids.bw, { color: "ดำ", size: "M", purchasePrice: 200, sellingPrice: 1090 });
    ids.wL = engine.addVariant(d, ids.bw, { color: "ดำ", size: "L", purchasePrice: 200, sellingPrice: 1090 });
    ids.mM = engine.addVariant(d, ids.bm, { color: "ดำ", size: "M", purchasePrice: 230, sellingPrice: 1090 });
    ids.mL = engine.addVariant(d, ids.bm, { color: "ดำ", size: "L", purchasePrice: 230, sellingPrice: 1090 });
    ids.mCream = engine.addVariant(d, ids.bm, { color: "ครีม", size: "M", purchasePrice: 230, sellingPrice: 1090 });
    engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.wM, qty: 5 }, { itemId: ids.wL, qty: 3 }] });
    engine.linkProductSource(d, ids.bm, ids.bw);
  });
  return { state, ...ids };
}

const qty = (s: ReturnType<typeof seed>["state"], v: string, w: string) => s.variantStock[`${v}::${w}`]?.qtyOnHand ?? 0;
const sell = (d: Parameters<typeof engine.stockOut>[0], wh: string, lines: { itemId: string; qty: number }[], reasonType: "sale" | "internal_use" = "sale") =>
  engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: wh, reasonType, actorId: "u1", actorName: "ขาย", channel: reasonType === "sale" ? "shopee" : undefined, lines });

describe("linkProductSource: ตั้งให้เย็บตามออเดอร์จากรุ่นอื่น", () => {
  it("จับคู่ตามสี+ไซซ์ ตัวที่ไม่มีคู่ไม่ถูกเชื่อมและถูกแจ้ง", () => {
    const { state, mM, mL, mCream, wM, wL } = seed();
    expect(state.variants[mM].sourceVariantId).toBe(wM);
    expect(state.variants[mL].sourceVariantId).toBe(wL);
    expect(state.variants[mCream].sourceVariantId).toBeUndefined();
  });

  it("คืนจำนวนที่เชื่อมและรายการที่หาคู่ไม่เจอ", () => {
    const { state, bm, bw } = seed();
    const res = { linked: 0, unmatched: [] as string[] };
    produce(state, (d) => {
      Object.assign(res, engine.linkProductSource(d, bm, bw));
    });
    expect(res).toEqual({ linked: 2, unmatched: ["ครีม / M"] });
  });

  it("กันวงกลม/ทอด: เชื่อมรุ่นเดิมกลับด้าน เชื่อมกับรุ่นที่ตัดจากรุ่นอื่นอยู่ หรือเชื่อมกับตัวเองไม่ได้", () => {
    const { state, bm, bw } = seed();
    expect(() => produce(state, (d) => { engine.linkProductSource(d, bw, bm); })).toThrow(engine.BusinessRuleError);
    expect(() => produce(state, (d) => { engine.linkProductSource(d, bm, bm); })).toThrow(engine.BusinessRuleError);
    const chained = produce(state, (d) => {
      const third = engine.createProduct(d, { sellingName: "Third", sellingPrice: 1, category: "x", status: "active", images: [] });
      engine.addVariant(d, third, { color: "ดำ", size: "M", purchasePrice: 1, sellingPrice: 1 });
      expect(() => engine.linkProductSource(d, third, bm)).toThrow(engine.BusinessRuleError);
    });
    expect(chained).toBeTruthy();
  });

  it("เลิกเชื่อม และลบตัวเลือกต้นทางแล้วลิงก์ของปลายทางถูกล้าง", () => {
    const { state, bm, wL, mL, mM } = seed();
    const unlinked = produce(state, (d) => {
      expect(engine.unlinkProductSource(d, bm)).toBe(2);
    });
    expect(Object.values(unlinked.variants).some((v) => v.sourceVariantId)).toBe(false);

    // ตัวเปล่า L มีสต็อก 3 ลบไม่ได้
    expect(() => produce(state, (d) => engine.removeVariant(d, wL))).toThrow(engine.BusinessRuleError);
    // ปรับสต็อกต้นทางเป็น 0 แล้วลบได้ ลิงก์ของปลายทางต้องหาย
    const afterRemove = produce(state, (d) => {
      engine.adjustStock(d, { itemType: "product", itemId: wL, warehouseId: Object.keys(d.warehouses)[0], newQty: 0, reason: "ทดสอบ", actorId: "u1", actorName: "x" });
      engine.removeVariant(d, wL);
    });
    expect(afterRemove.variants[mL].sourceVariantId).toBeUndefined();
    expect(afterRemove.variants[mM].sourceVariantId).toBeTruthy();
  });
});

describe("ขายสินค้าที่เย็บตามออเดอร์", () => {
  it("ไม่มีของที่เย็บแล้ว: ตัดตัวเปล่าต้นทางมาให้ แล้วขาย สต็อกรวมลด 1 ชิ้น ไม่นับซ้ำ", () => {
    const { state, wh, wM, mM } = seed();
    const before = totalProductQtyNow(state);
    const next = produce(state, (d) => { sell(d, wh, [{ itemId: mM, qty: 1 }]); });
    expect(qty(next, wM, wh)).toBe(4); // ตัวเปล่า 5 -> 4
    expect(qty(next, mM, wh)).toBe(0); // เย็บแล้วขายออกทันที เหลือ 0
    expect(totalProductQtyNow(next)).toBe(before - 1);

    const movs = Object.values(next.movements).filter((m) => m.refNo.startsWith("SOUT-"));
    const byType = (t: string) => movs.filter((m) => m.movementType === t);
    expect(byType("convert_out")).toHaveLength(1);
    expect(byType("convert_in")).toHaveLength(1);
    expect(byType("sale")).toHaveLength(1);
    expect(byType("convert_out")[0]).toMatchObject({ itemId: wM, qtyChange: -1, qtyBefore: 5, qtyAfter: 4 });
    expect(byType("convert_in")[0]).toMatchObject({ itemId: mM, qtyChange: 1, qtyBefore: 0, qtyAfter: 1 });
    expect(byType("sale")[0]).toMatchObject({ itemId: mM, qtyChange: -1, qtyBefore: 1, qtyAfter: 0 });
    expect(new Set(movs.map((m) => m.refNo)).size).toBe(1); // ทั้งสามรายการอยู่ใต้เลขที่ใบขายเดียว
  });

  it("ออเดอร์ที่สร้างเป็นของ Bobbie Mid (ไม่ใช่ Billie Wide) และยอดสต็อกเข้า/ออกบนแดชบอร์ดนับเฉพาะการขายจริง", () => {
    const { state, wh, mM, bm } = seed();
    let orderProductId = "";
    const next = produce(state, (d) => {
      const { order } = sell(d, wh, [{ itemId: mM, qty: 2 }]);
      orderProductId = order!.lines[0].productId;
    });
    expect(orderProductId).toBe(bm);
    const stats = dashboardStats(next, FROM, TO);
    expect(stats.stockOut.qty).toBe(2); // ขาย 2 ชิ้น ไม่รวม convert_out
    expect(stats.stockIn.qty).toBe(8); // ของเข้าจริงตอนตั้งต้นเท่านั้น ไม่รวม convert_in
  });

  it("มีของที่เย็บแล้วบางส่วน: ตัดตัวเปล่ามาเฉพาะส่วนที่ขาด", () => {
    const { state, wh, wM, mM } = seed();
    const withOwn = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "x", lines: [{ itemId: mM, qty: 2 }] });
    });
    const next = produce(withOwn, (d) => { sell(d, wh, [{ itemId: mM, qty: 3 }]); });
    expect(qty(next, wM, wh)).toBe(4); // ตัดตัวเปล่าแค่ 1 (3 - 2)
    expect(qty(next, mM, wh)).toBe(0);
    const conv = Object.values(next.movements).filter((m) => m.movementType === "convert_out");
    expect(conv).toHaveLength(1);
    expect(conv[0].qtyChange).toBe(-1);
  });

  it("มีของที่เย็บแล้วพอ: ไม่แตะตัวเปล่าเลย", () => {
    const { state, wh, wM, mM } = seed();
    const withOwn = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "x", lines: [{ itemId: mM, qty: 4 }] });
    });
    const next = produce(withOwn, (d) => { sell(d, wh, [{ itemId: mM, qty: 3 }]); });
    expect(qty(next, wM, wh)).toBe(5);
    expect(Object.values(next.movements).some((m) => m.movementType === "convert_out")).toBe(false);
  });

  it("ตัวเปล่าไม่พอ: ปฏิเสธทั้งใบ ไม่เปลี่ยนสต็อกและไม่มีรายการแปลงค้าง", () => {
    const { state, wh, wL, mL } = seed();
    let message = "";
    try {
      produce(state, (d) => { sell(d, wh, [{ itemId: mL, qty: 4 }]); }); // ตัวเปล่า L มี 3
    } catch (e) {
      message = e instanceof Error ? e.message : "";
    }
    expect(message).toContain("สต็อกไม่เพียงพอ");
    expect(message).toContain("ตัวเปล่า");
    expect(qty(state, wL, wh)).toBe(3);
    expect(Object.values(state.movements).some((m) => m.movementType === "convert_out")).toBe(false);
  });

  it("เหตุผลที่ไม่ใช่ขาย (เช่นใช้ภายใน) ไม่ตัดตัวเปล่าให้ ยังต้องมีสต็อกของตัวเองเหมือนเดิม", () => {
    const { state, wh, mM } = seed();
    expect(() => produce(state, (d) => { sell(d, wh, [{ itemId: mM, qty: 1 }], "internal_use"); })).toThrow(engine.BusinessRuleError);
  });

  it("ตัวเลือกที่ไม่ได้เชื่อม (ครีม M) ทำงานเหมือนเดิม ไม่มีของก็ขายไม่ได้", () => {
    const { state, wh, mCream } = seed();
    expect(() => produce(state, (d) => { sell(d, wh, [{ itemId: mCream, qty: 1 }]); })).toThrow(engine.BusinessRuleError);
  });

  it("ขายตัวเปล่าตัวเอง (Billie Wide) กับ Bobbie ในใบเดียวกันจนตัวเปล่าไม่พอ: ปฏิเสธ ไม่ติดลบ", () => {
    const { state, wh, wL, mL } = seed();
    // ตัวเปล่า L มี 3: ขาย Billie 2 + Bobbie 2 = ต้องใช้ 4
    expect(() => produce(state, (d) => { sell(d, wh, [{ itemId: wL, qty: 2 }, { itemId: mL, qty: 2 }]); })).toThrow(engine.BusinessRuleError);
    expect(qty(state, wL, wh)).toBe(3);
  });

  it("ยกเลิกออเดอร์ที่ขายไปแล้ว: ของคืนเข้าสต็อกของ Bobbie Mid (เพราะเย็บไปแล้ว) ไม่ใช่ตัวเปล่า", () => {
    const { state, wh, wM, mM } = seed();
    const sold = produce(state, (d) => { sell(d, wh, [{ itemId: mM, qty: 1 }]); });
    const orderId = Object.keys(sold.orders)[0];
    const cancelled = produce(sold, (d) => { engine.cancelOrder(d, orderId, "ลูกค้ายกเลิก", "u1", "x"); });
    expect(qty(cancelled, mM, wh)).toBe(1);
    expect(qty(cancelled, wM, wh)).toBe(4);
  });
});

describe("แจ้งเตือนสินค้าใกล้หมด", () => {
  it("ตัวเลือกที่เย็บตามออเดอร์ไม่ถูกแจ้งใกล้หมด (ไม่ถือสต็อกเอง) ส่วนที่ไม่ได้เชื่อมยังแจ้งตามปกติ", () => {
    const { state, mM, mL, mCream } = seed();
    const ids = lowStockVariants(state).map((x) => x.variant.id);
    expect(ids).not.toContain(mM);
    expect(ids).not.toContain(mL);
    expect(ids).toContain(mCream);
  });
});
