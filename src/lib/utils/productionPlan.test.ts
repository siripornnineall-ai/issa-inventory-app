import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { addMonthsClamped, formatPlanDate, planCell, productionPlan } from "./productionPlan";

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

  it("ทรงสินค้าส่งมากับรุ่นในแผนผลิต", () => {
    const { state, p } = seed();
    const next = produce(state, (d) => {
      d.products[p].shape = "ทรงกระบอกใหญ่";
    });
    expect(productionPlan(next, [{ productId: p, color: "ดำ", size: "M", qty: 10 }])[0].shape).toBe("ทรงกระบอกใหญ่");
  });

  it("แสดงสีตามลำดับมาตรฐานถึง 'น้ำเงิน' สีหลังจากนั้นซ่อน (ยกเว้นสีที่มียอดขาย) และไม่นับของสีที่ซ่อนในยอดรวม", () => {
    const { state, wh, p } = seed();
    const next = produce(state, (d) => {
      const add = (color: string, qty: number) => {
        const v = engine.addVariant(d, p, { color, size: "M", purchasePrice: 400, sellingPrice: 1000 });
        engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: v, qty }] });
      };
      add("น้ำเงิน", 5); // อยู่ในลำดับถึงน้ำเงิน → แสดง
      add("ม่วง", 7); // หลังน้ำเงินและไม่มียอดขาย → ซ่อน
      add("ฟ้า", 6); // หลังน้ำเงินแต่มียอดขาย → แสดง
      add("สีใหม่ไม่รู้จัก", 3); // ไม่รู้ลำดับ → ไม่ซ่อน
    });
    const plan = productionPlan(next, [
      { productId: p, color: "ดำ", size: "M", qty: 10 },
      { productId: p, color: "ฟ้า", size: "M", qty: 4 },
    ]);
    const colors = plan[0].colors.map((c) => c.color);
    expect(colors).toContain("ดำ");
    expect(colors).toContain("น้ำเงิน");
    expect(colors).toContain("ฟ้า");
    expect(colors).toContain("สีใหม่ไม่รู้จัก");
    expect(colors).not.toContain("ม่วง");
    // ของสีที่ซ่อน (ม่วง 7) ไม่ถูกนับในยอดรวมสต็อกของรุ่น
    expect(plan[0].totals.stock).toBe(0 + 5 + 6 + 3); // ดำ 0 + น้ำเงิน 5 + ฟ้า 6 + สีใหม่ 3 (ไม่มีม่วง)
  });

  it("วันที่ปลายทาง: วันนี้ + n เดือน (วันเดียวกัน ถ้าไม่มีวันนั้นใช้วันสุดท้ายของเดือน) รูปแบบ dd/mm/yyyy", () => {
    const today = new Date(2026, 10, 17); // 17 พ.ย. 2026
    expect(formatPlanDate(addMonthsClamped(today, 1))).toBe("17/12/2026");
    expect(formatPlanDate(addMonthsClamped(today, 2))).toBe("17/01/2027"); // ข้ามปี
    expect(formatPlanDate(addMonthsClamped(today, 8))).toBe("17/07/2027");
    expect(formatPlanDate(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe("28/02/2026"); // ก.พ. ไม่มีวันที่ 31
    expect(formatPlanDate(addMonthsClamped(new Date(2027, 11, 31), 2))).toBe("29/02/2028"); // ปีอธิกสุรทิน
  });
});
