import { describe, it, expect } from "vitest";
import { emptyState } from "./state";
import { SLOW_STOCK_RULES, groupSlowMovers, slowMovers, slowMoversByBrand } from "./selectors";
import type { StockMovement } from "@/lib/types";

const NOW = new Date("2026-11-20T00:00:00.000Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

let seq = 0;
function mv(variantId: string, movementType: string, qtyChange: number, createdAt: string): StockMovement {
  seq += 1;
  return { id: `m${seq}`, createdAt, refNo: `R${seq}`, itemType: "product", itemId: variantId, variantId, itemName: "x", sku: "x", movementType, qtyChange, qtyBefore: 0, qtyAfter: 0, actorId: "u", actorName: "u" } as StockMovement;
}

function build(opts: {
  variants: { id: string; productId: string; color?: string; size?: string; qty: number; sourceVariantId?: string; active?: boolean }[];
  movements?: StockMovement[];
}) {
  const s = emptyState() as never as Record<string, Record<string, unknown>>;
  s.brands = { a: { id: "a", name: "ISSA Apparel", code: "IS", active: true, createdAt: "1" }, b: { id: "b", name: "ISSA Activewear", code: "IA", active: true, createdAt: "2" }, c: { id: "c", name: "Fasonaf", code: "FS", active: true, createdAt: "3" } };
  s.warehouses = { w1: { id: "w1", name: "คลัง", type: "main", active: true, createdAt: "1" } };
  s.products = {
    p1: { id: "p1", sellingName: "Billie Slim", brandId: "a", createdAt: "2026-01-01T00:00:00.000Z" },
    p2: { id: "p2", sellingName: "Flow Wide", brandId: "b", createdAt: "2026-01-01T00:00:00.000Z" },
    p3: { id: "p3", sellingName: "Nobrand", createdAt: "2026-01-01T00:00:00.000Z" },
  };
  s.variants = Object.fromEntries(opts.variants.map((v) => [v.id, { id: v.id, productId: v.productId, color: v.color ?? "ดำ", size: v.size ?? "M", sku: v.id, active: v.active ?? true, sourceVariantId: v.sourceVariantId }]));
  s.variantStock = Object.fromEntries(opts.variants.map((v) => [`${v.id}::w1`, { itemId: v.id, warehouseId: "w1", qtyOnHand: v.qty, qtyReserved: 0 }]));
  s.movements = Object.fromEntries((opts.movements ?? []).map((m) => [m.id, m]));
  return s as never;
}

const ids = (state: ReturnType<typeof build>, now = NOW) => slowMovers(state, now).map((x) => x.variantId).sort();

describe("slowMovers: สินค้าค้างสต็อก", () => {
  it("ค้าง = มีของพอ + ขายไม่เกิน 1 ชิ้นใน 30 วัน + รับเข้ามาเกิน 15 วัน", () => {
    const state = build({
      variants: [
        { id: "slow", productId: "p1", qty: 10 },
        { id: "fast", productId: "p1", qty: 10 },
        { id: "one", productId: "p1", qty: 10 },
        { id: "few", productId: "p1", qty: 4 },
      ],
      movements: [
        mv("slow", "stock_in", 10, daysAgo(40)),
        mv("fast", "stock_in", 10, daysAgo(40)),
        mv("fast", "sale", -3, daysAgo(5)),
        mv("one", "stock_in", 10, daysAgo(40)),
        mv("one", "sale", -1, daysAgo(5)),
        mv("few", "stock_in", 4, daysAgo(40)),
      ],
    });
    expect(ids(state)).toEqual(["one", "slow"]); // fast ขาย 3 ไม่ค้าง / few มีไม่ถึง 5 ชิ้น
  });

  it("ผ่อนผัน 15 วันหลังรับเข้า: เพิ่งรับมาไม่ถือว่าค้าง และเติมสต็อกใหม่แล้วนับ 15 วันใหม่", () => {
    const state = build({
      variants: [
        { id: "new", productId: "p1", qty: 10 },
        { id: "edge", productId: "p1", qty: 10 },
        { id: "restocked", productId: "p1", qty: 10 },
      ],
      movements: [mv("new", "stock_in", 10, daysAgo(14)), mv("edge", "stock_in", 10, daysAgo(15)), mv("restocked", "stock_in", 5, daysAgo(60)), mv("restocked", "stock_in", 5, daysAgo(3))],
    });
    expect(ids(state)).toEqual(["edge"]); // ครบ 15 วันพอดีนับเป็นค้าง / รับล่าสุด 3 วันก่อนยังผ่อนผัน
  });

  it("ยอดขายที่เกิน 30 วันไม่นับ / การย้ายระหว่างคลังและการคืนสต็อกจากยกเลิกออเดอร์ไม่ทำให้เริ่มนับ 15 วันใหม่", () => {
    const state = build({
      variants: [{ id: "a", productId: "p1", qty: 10 }],
      movements: [mv("a", "stock_in", 10, daysAgo(60)), mv("a", "sale", -8, daysAgo(45)), mv("a", "transfer_in", 3, daysAgo(2)), mv("a", "cancel_restock", 1, daysAgo(1))],
    });
    expect(ids(state)).toEqual(["a"]);
  });

  it("ของคืน (ตีกลับ/คืน/ตำหนิ/เปลี่ยน) นับเป็นการรับเข้าที่ผ่อนผันด้วย", () => {
    const state = build({
      variants: [{ id: "a", productId: "p1", qty: 10 }],
      movements: [mv("a", "stock_in", 10, daysAgo(60)), mv("a", "return_customer", 2, daysAgo(4))],
    });
    expect(ids(state)).toEqual([]);
  });

  it("ไม่มีประวัติรับเข้าเลย (ตั้งยอดตอนนับสต็อก): ใช้วันที่ปรับยอดเพิ่มครั้งล่าสุดแทน", () => {
    const state = build({
      variants: [{ id: "counted", productId: "p1", qty: 10 }, { id: "countedNew", productId: "p1", qty: 10 }],
      movements: [mv("counted", "adjustment", 10, daysAgo(30)), mv("countedNew", "adjustment", 10, daysAgo(5))],
    });
    expect(ids(state)).toEqual(["counted"]);
  });

  it("ตัวเลือกที่เย็บตามออเดอร์ (เชื่อมต้นทาง) ไม่ถูกนับว่าค้าง และยอดขายของมันนับเป็นความต้องการของตัวเปล่าต้นทาง", () => {
    const state = build({
      variants: [
        { id: "blank", productId: "p1", qty: 50 },
        { id: "sewn", productId: "p2", qty: 0, sourceVariantId: "blank" },
        { id: "blankIdle", productId: "p1", qty: 50 },
      ],
      movements: [mv("blank", "stock_in", 50, daysAgo(60)), mv("blankIdle", "stock_in", 50, daysAgo(60)), mv("sewn", "sale", -6, daysAgo(3))],
    });
    // ตัวเปล่าที่มีคนสั่งเย็บ 6 ชิ้นไม่ค้าง ส่วนอีกตัวที่ไม่มีใครซื้อยังค้าง
    expect(ids(state)).toEqual(["blankIdle"]);
  });

  it("ตัวเลือกที่ปิดใช้งานไม่นับ", () => {
    const state = build({ variants: [{ id: "off", productId: "p1", qty: 10, active: false }], movements: [mv("off", "stock_in", 10, daysAgo(60))] });
    expect(ids(state)).toEqual([]);
  });

  it("กฎเริ่มต้นเป็น 30 วัน / ผ่อนผัน 15 วัน / มีของ 5 ชิ้น / ขายไม่เกิน 1", () => {
    expect(SLOW_STOCK_RULES).toEqual({ windowDays: 30, graceDays: 15, minStock: 5, maxSold: 1 });
  });
});

describe("แยกตามแบรนด์และจัดกลุ่ม", () => {
  const state = build({
    variants: [
      { id: "v1", productId: "p1", color: "ดำ", size: "M", qty: 10 },
      { id: "v2", productId: "p1", color: "ครีม", size: "M", qty: 20 },
      { id: "v3", productId: "p2", color: "ดำ", size: "XL", qty: 7 },
      { id: "v4", productId: "p3", color: "ดำ", size: "S", qty: 6 },
    ],
    movements: ["v1", "v2", "v3", "v4"].map((v) => mv(v, "stock_in", 10, daysAgo(40))),
  });
  const list = slowMovers(state, NOW);

  it("การ์ดแบรนด์: ครบทุกแบรนด์ที่ใช้งาน (แม้ไม่มีของค้าง) เรียงตามที่สร้าง และ 'ไม่ระบุแบรนด์' ขึ้นเมื่อมีของค้าง", () => {
    const brands = slowMoversByBrand(state, list);
    expect(brands.map((b) => [b.name, b.variants, b.pieces])).toEqual([
      ["ISSA Apparel", 2, 30],
      ["ISSA Activewear", 1, 7],
      ["Fasonaf", 0, 0],
      ["ไม่ระบุแบรนด์", 1, 6],
    ]);
    // ผลรวมทุกแบรนด์เท่ากับรายการค้างทั้งหมด
    expect(brands.reduce((s, b) => s + b.pieces, 0)).toBe(list.reduce((s, x) => s + x.qty, 0));
  });

  it("จัดกลุ่มตามรุ่น / สี / ไซซ์ เรียงจากค้างมากไปน้อย", () => {
    expect(groupSlowMovers(state, list, "product").map((g) => [g.label, g.pieces])).toEqual([["Billie Slim", 30], ["Flow Wide", 7], ["Nobrand", 6]]);
    expect(groupSlowMovers(state, list, "color").map((g) => [g.label, g.variants, g.pieces])).toEqual([["ครีม", 1, 20], ["ดำ", 3, 23]].sort((a, b) => (b[2] as number) - (a[2] as number)));
    expect(groupSlowMovers(state, list, "size").map((g) => [g.label, g.pieces])).toEqual([["M", 30], ["XL", 7], ["S", 6]]);
  });
});
