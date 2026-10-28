import { describe, it, expect } from "vitest";
import { emptyState, type AppState } from "@/lib/store/state";
import { firstCountMs, monthlyRecount, recountBetween, recountSheetRows } from "./recountMatrix";

const mv = (id: string, createdAt: string, variantId: string, before: number, after: number, reason = "นับสต็อก — Billie Slim", warehouseToId = "w1", movementType = "adjustment") => ({
  id,
  createdAt,
  refNo: id,
  itemType: "product",
  itemId: variantId,
  variantId,
  itemName: "x",
  sku: "x",
  movementType,
  qtyChange: after - before,
  qtyBefore: before,
  qtyAfter: after,
  warehouseToId,
  reason,
  actorId: "u",
  actorName: "u",
});

function build(movements: ReturnType<typeof mv>[], stock: Record<string, number> = {}): AppState {
  return {
    ...emptyState(),
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
    warehouses: { w1: { id: "w1", name: "คลัง 1", type: "main", active: true, createdAt: "" }, w2: { id: "w2", name: "คลัง 2", type: "main", active: true, createdAt: "" } },
    products: {
      p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", createdAt: "" },
      p2: { id: "p2", sellingName: "Bruno Slim", brandId: "b1", createdAt: "" },
    },
    variants: {
      "v-black-M": { id: "v-black-M", productId: "p1", color: "ดำ", size: "M", sku: "a", active: true },
      "v-black-L": { id: "v-black-L", productId: "p1", color: "ดำ", size: "L", sku: "b", active: true },
      "v-cream-M": { id: "v-cream-M", productId: "p1", color: "ครีม", size: "M", sku: "c", active: true },
      "v-bruno": { id: "v-bruno", productId: "p2", color: "ดำ", size: "M", sku: "e", active: true },
    },
    variantStock: Object.fromEntries(Object.entries(stock).map(([k, q]) => [k, { itemId: k.split("::")[0], warehouseId: k.split("::")[1], qtyOnHand: q, qtyReserved: 0 }])),
    movements: Object.fromEntries(movements.map((m) => [m.id, m])),
  } as unknown as AppState;
}

describe("monthlyRecount: ผลนับสต็อกรายเดือนเทียบกับระบบ", () => {
  it("ใช้ยอดที่นับได้ (qtyAfter) เทียบกับยอดระบบก่อนนับ (qtyBefore) ต่อช่องสี/ไซซ์ และบอกส่วนต่าง", () => {
    const state = build(
      [mv("m1", "2026-10-30T10:00:00", "v-black-M", 12, 10), mv("m2", "2026-10-30T10:01:00", "v-black-L", 5, 5), mv("m3", "2026-10-30T10:02:00", "v-cream-M", 3, 4)],
      { "v-black-M::w1": 10, "v-black-L::w1": 5, "v-cream-M::w1": 4 },
    );
    const [p] = monthlyRecount(state, 2026, 9);
    expect(p.name).toBe("Billie Slim");
    expect(p.counted).toBe(19);
    expect(p.system).toBe(20);
    expect(p.diff).toBe(-1);
    expect(p.diffCells).toBe(2); // ดำ M ขาด 2, ครีม M เกิน 1
    expect(p.countedCells).toBe(3);
    const black = p.rows.find((r) => r.color === "ดำ")!;
    expect(black.cells.M).toEqual({ counted: 10, system: 12, diff: -2 });
    expect(black.cells.L).toEqual({ counted: 5, system: 5, diff: 0 }); // นับแล้วตรง ก็ถือว่านับแล้ว
  });

  it("ไม่นับรายการปรับยอดที่ไม่ใช่การนับสต็อก และไม่ใช่ชนิดปรับยอด", () => {
    const state = build([
      mv("m1", "2026-10-10T10:00:00", "v-black-M", 12, 10, "แก้ยอดให้ตรงกับของจริง"),
      mv("m2", "2026-10-10T10:00:00", "v-black-L", 0, 5, "นับสต็อก — x", "w1", "stock_in"),
    ]);
    expect(monthlyRecount(state, 2026, 9)).toEqual([]);
  });

  it("เลือกเดือน: นับต่างเดือนไม่ปนกัน และขอบเขตเดือนเป็นเวลาท้องถิ่น", () => {
    const state = build([mv("m1", "2026-09-30T23:59:59", "v-black-M", 1, 2), mv("m2", "2026-10-01T00:00:00", "v-black-M", 2, 3)]);
    expect(monthlyRecount(state, 2026, 8)[0].counted).toBe(2);
    expect(monthlyRecount(state, 2026, 9)[0].counted).toBe(3);
  });

  it("นับตัวเลือกเดิมหลายครั้งในเดือนเดียว ใช้ครั้งล่าสุด", () => {
    const state = build([mv("m1", "2026-10-05T10:00:00", "v-black-M", 12, 10), mv("m2", "2026-10-28T10:00:00", "v-black-M", 11, 11)]);
    expect(monthlyRecount(state, 2026, 9)[0].rows[0].cells.M).toEqual({ counted: 11, system: 11, diff: 0 });
  });

  it("หลายคลัง: รวมผลนับล่าสุดของแต่ละคลัง และกรองเฉพาะคลังได้", () => {
    const state = build([mv("m1", "2026-10-05T10:00:00", "v-black-M", 4, 3, "นับสต็อก — x", "w1"), mv("m2", "2026-10-06T10:00:00", "v-black-M", 6, 8, "นับสต็อก — x", "w2")], {
      "v-black-M::w1": 3,
      "v-black-M::w2": 8,
    });
    const all = monthlyRecount(state, 2026, 9)[0].rows[0];
    expect(all.cells.M).toEqual({ counted: 11, system: 10, diff: 1 });
    expect(all.now).toBe(11);
    const w2 = monthlyRecount(state, 2026, 9, { warehouseId: "w2" })[0].rows[0];
    expect(w2.cells.M).toEqual({ counted: 8, system: 6, diff: 2 });
    expect(w2.now).toBe(8);
  });

  it("แสดงสต็อกปัจจุบัน (ตอนนี้) ของทุกช่อง รวมช่องที่ไม่ได้นับ และช่องที่ไม่ได้นับเป็น null", () => {
    const state = build([mv("m1", "2026-10-05T10:00:00", "v-black-M", 12, 10)], { "v-black-M::w1": 7, "v-black-L::w1": 9, "v-cream-M::w1": 2 });
    const [p] = monthlyRecount(state, 2026, 9);
    const black = p.rows.find((r) => r.color === "ดำ")!;
    expect(black.cells.L).toBeNull();
    expect(black.now).toBe(16); // M 7 + L 9 (ยอดหลังนับขยับไปตามการขาย)
    expect(p.countedCells).toBe(1);
    expect(p.totalCells).toBe(3);
    expect(p.rows.map((r) => r.color)).toEqual(["ดำ", "ครีม"]); // สีที่นับแล้วขึ้นก่อน
  });

  it("รุ่นที่ไม่ตรงกับระบบมากสุดขึ้นก่อน และรุ่นที่ไม่ได้นับไม่แสดง", () => {
    const state = build([mv("m1", "2026-10-05T10:00:00", "v-bruno", 5, 4), mv("m2", "2026-10-05T10:00:00", "v-black-M", 3, 3, "นับสต็อก — x"), mv("m3", "2026-10-05T10:00:00", "v-black-L", 2, 1, "นับสต็อก — x")]);
    expect(monthlyRecount(state, 2026, 9).map((p) => p.name)).toEqual(["Billie Slim", "Bruno Slim"]);
    expect(monthlyRecount(state, 2026, 8)).toEqual([]);
  });

  it("แถว Excel: หัวไซซ์ / สี / รวม", () => {
    const state = build([mv("m1", "2026-10-05T10:00:00", "v-black-M", 12, 10)], { "v-black-M::w1": 7 });
    const rows = recountSheetRows("นับสต็อก", monthlyRecount(state, 2026, 9));
    expect(rows[0]).toEqual(["นับสต็อก"]);
    expect(rows).toContainEqual(["สี", "M (นับได้)", "L (นับได้)", "นับได้", "ระบบก่อนนับ", "ผลต่าง", "ตอนนี้"]);
    expect(rows).toContainEqual(["ดำ", 10, "", 10, 12, -2, 7]);
  });
  it("sinceMs: ไม่นับการนับก่อนเวลาที่กำหนด (ซ่อนช่วงตั้งต้นระบบ) และ firstCountMs ข้ามด้วย", () => {
    const state = build([mv("m1", "2026-10-12T10:00:00", "v-black-M", 12, 10), mv("m2", "2026-10-29T10:00:00", "v-black-L", 5, 6)]);
    const since = new Date("2026-10-28T00:00:00").getTime();
    const [p] = monthlyRecount(state, 2026, 9, { sinceMs: since });
    expect(p.countedCells).toBe(1);
    expect(p.rows.find((r) => r.color === "ดำ")!.cells.M).toBeNull();
    expect(p.rows.find((r) => r.color === "ดำ")!.cells.L).toEqual({ counted: 6, system: 5, diff: 1 });
    expect(monthlyRecount(state, 2026, 9)[0].countedCells).toBe(2);
    expect(firstCountMs(state)).toBe(new Date("2026-10-12T10:00:00").getTime());
    expect(firstCountMs(state, since)).toBe(new Date("2026-10-29T10:00:00").getTime());
    expect(firstCountMs(state, new Date("2026-11-01T00:00:00").getTime())).toBeNull();
  });

  it("recountBetween: ช่วงวันที่ใดก็ได้ [from, to)", () => {
    const state = build([mv("m1", "2026-10-12T10:00:00", "v-black-M", 12, 10), mv("m2", "2026-10-20T10:00:00", "v-black-L", 5, 6)]);
    const r = recountBetween(state, { from: new Date("2026-10-15T00:00:00").getTime(), to: new Date("2026-10-21T00:00:00").getTime() });
    expect(r[0].countedCells).toBe(1);
    expect(r[0].rows.find((x) => x.color === "ดำ")!.cells.L).toEqual({ counted: 6, system: 5, diff: 1 });
  });});
