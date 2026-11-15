import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { planCell, productionPlan } from "./productionPlan";

const DATE = "2026-11-10T00:00:00.000Z";

function seed() {
  const ids = { wh: "", p: "", blkM: "", blkL: "", whtM: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    ids.p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1000, category: "กางเกง", status: "active", images: [], brandId: brand });
    ids.blkM = engine.addVariant(d, ids.p, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    ids.blkL = engine.addVariant(d, ids.p, { color: "ดำ", size: "L", purchasePrice: 400, sellingPrice: 1000 });
    ids.whtM = engine.addVariant(d, ids.p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
  });
  return { state, ...ids };
}

describe("วางแผนผลิต", () => {
  it("planCell: ควรผลิต = ขายเผื่อสำรอง - (คลัง+รอเย็บ), อยู่ได้กี่วัน, ระดับแดง", () => {
    expect(planCell(100, 20, 10, 0.1)).toMatchObject({ have: 30, need: 80, level: "low" }); // 110-30
    expect(planCell(100, 0, 0, 0.1)).toMatchObject({ need: 110, level: "out", coverDays: 0 });
    expect(planCell(100, 150, 0, 0)).toMatchObject({ need: 0, level: undefined }); // 45 วัน ยังพอ
    expect(planCell(0, 5, 0, 0.15)).toMatchObject({ need: 0, coverDays: null, level: undefined });
  });

  it("รวมคลังกับที่รอเย็บที่ BC แต่เก็บแยกในช่องเดียวกัน", () => {
    const { state, wh, p, blkM, blkL } = seed();
    const next = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: blkM, qty: 30 }] });
      engine.recordFactoryWip(d, { kind: "opening", date: DATE, actorId: "u1", actorName: "คุณ", lines: [{ variantId: blkM, qty: 40 }, { variantId: blkL, qty: 15 }] });
    });
    const plan = productionPlan(next, [
      { productId: p, color: "ดำ", size: "M", qty: 100 },
      { productId: p, color: "ดำ", size: "L", qty: 50 },
      { productId: p, color: "ขาว", size: "M", qty: 20 },
    ], { buffer: 0 });
    expect(plan).toHaveLength(1);
    const black = plan[0].colors.find((c) => c.color === "ดำ")!;
    expect(black.cells.M).toMatchObject({ stock: 30, wip: 40, have: 70, need: 30 });
    expect(black.cells.L).toMatchObject({ stock: 0, wip: 15, have: 15, need: 35, level: "low" });
    const white = plan[0].colors.find((c) => c.color === "ขาว")!;
    expect(white.cells.M).toMatchObject({ have: 0, need: 20, level: "out" });
    expect(plan[0].totals).toMatchObject({ stock: 30, wip: 55, have: 85, need: 85 });
  });

  it("ตัวกรองแบรนด์/ค้นหารุ่น และรุ่นที่ไม่มียอดขายอ้างอิงไม่ขึ้น", () => {
    const { state, p } = seed();
    const base = [{ productId: p, color: "ดำ", size: "M", qty: 10 }];
    expect(productionPlan(state, base, { search: "wide" })).toHaveLength(0);
    expect(productionPlan(state, base, { search: "slim" })).toHaveLength(1);
    expect(productionPlan(state, [])).toHaveLength(0);
  });

  it("ส่วนต่าง = (คลัง+รอเย็บ) - ยอดขาย ติดลบ = ขาด และดูล่วงหน้าหลายเดือนคูณยอดขาย", () => {
    expect(planCell(100, 60, 10, 0)).toMatchObject({ diff: -30, need: 30, level: "low" });
    expect(planCell(100, 150, 0, 0)).toMatchObject({ diff: 50, need: 0 });
    const { state, wh, p, blkM } = seed();
    const next = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: blkM, qty: 100 }] });
    });
    const base = [{ productId: p, color: "ดำ", size: "M", qty: 80 }];
    const one = productionPlan(next, base, { months: 1 })[0].colors[0].cells.M;
    const two = productionPlan(next, base, { months: 2 })[0].colors[0].cells.M;
    expect(one).toMatchObject({ demand: 80, diff: 20, need: 0 });
    expect(two).toMatchObject({ demand: 160, diff: -60, need: 60, level: "low" });
    const m2 = productionPlan(next, base, { months: 2 })[0];
    expect(m2.sizeDiff.M).toBe(-60);
    expect(m2.totals).toMatchObject({ demand: 160, diff: -60 });
  });
});
