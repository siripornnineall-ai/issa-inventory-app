import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { sewAdvice, sortMatricesByShortage, wipMatrices } from "./factoryWipView";

const DATE = "2026-11-10T00:00:00.000Z";
const base = { date: DATE, actorId: "u1", actorName: "คุณ" };

function seed() {
  const ids = { wh: "", bm: "", bl: "", wm: "", p1: "", p2: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    const a = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [], brandId: brand });
    const b = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1090, category: "กางเกง", status: "active", images: [], brandId: brand });
    ids.p1 = a;
    ids.p2 = b;
    ids.bm = engine.addVariant(d, a, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    ids.bl = engine.addVariant(d, a, { color: "ดำ", size: "L", purchasePrice: 400, sellingPrice: 1090 });
    ids.wm = engine.addVariant(d, b, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1090 });
  });
  return { state, ...ids };
}

describe("แจ้งเตือนให้เย็บตามยอดขาย", () => {
  it("ขายดีแต่ของหมด/ใกล้หมดขึ้นแจ้ง จำนวนแนะนำสมส่วนกับยอดขาย ใช้ชิ้นที่ตัดรออยู่ก่อน ส่วนที่ไม่พอเป็นตัดเพิ่ม", () => {
    const { state, wh, bm, bl, wm } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: bm, qty: 60 }, { variantId: wm, qty: 10 }] });
      engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: bl, qty: 100 }, { itemId: wm, qty: 2 }] });
    });
    // ดำ M: ยอดขาย 100/เดือน สต็อก 0 รอเย็บ 60 → ขาด 100 เย็บ 60 ตัดเพิ่ม 40
    // ดำ L: ยอดขาย 100/เดือน สต็อก 100 → ไม่แจ้ง
    // ขาว M: ยอดขาย 20/เดือน สต็อก 2 รอเย็บ 10 → ขาด 18 เย็บ 10 ตัดเพิ่ม 8
    const rows = sewAdvice(next, new Map([[bm, 100], [bl, 100], [wm, 20]]));
    expect(rows.map((r) => r.variantId)).toEqual([bm, wm]);
    expect(rows[0]).toMatchObject({ shortage: 100, sewNow: 60, cutMore: 40, out: true });
    expect(rows[1]).toMatchObject({ shortage: 18, sewNow: 10, cutMore: 8, out: false });
  });

  it("ยอดขายต่ำมาก (< 3 ต่อเดือน) ไม่แจ้ง และสต็อกพอ (เกินครึ่งเดือน) ไม่แจ้ง", () => {
    const { state, bm, bl } = seed();
    expect(sewAdvice(state, new Map([[bm, 2], [bl, 1]]))).toEqual([]);
  });

  it("เรียงรุ่นที่ขาดเยอะก่อน", () => {
    const { state, wh, bm, wm, p1, p2 } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: bm, qty: 5 }, { variantId: wm, qty: 5 }] });
    });
    const advice = sewAdvice(next, new Map([[bm, 10], [wm, 200]]));
    const sorted = sortMatricesByShortage(wipMatrices(next), advice);
    expect(sorted.map((m) => m.productId)).toEqual([p2, p1]);
    void wh;
  });
});
