import { describe, it, expect } from "vitest";
import { emptyState, stockKey } from "./state";
import { dashboardStats, dashboardStatsByBrand } from "./selectors";

const FROM = "2026-10-01T00:00:00.000Z";
const TO = "2026-10-31T23:59:59.000Z";
const when = "2026-10-10T05:00:00.000Z";

function mv(id: string, variantId: string, movementType: string, qtyChange: number, relatedDocNo: string) {
  return { id, itemType: "product", itemId: variantId, variantId, movementType, qtyChange, relatedDocNo, createdAt: when, itemName: id, actorName: "x" };
}

function seed() {
  const s = emptyState();
  const brand = (id: string, name: string, createdAt: string, active = true) => ({ id, name, code: id, active, createdAt });
  s.brands = {
    a: brand("a", "ISSA Apparel", "2026-01-01"),
    b: brand("b", "ISSA Activewear", "2026-01-02"),
    c: brand("c", "Fasonaf", "2026-01-03"),
    d: brand("d", "แบรนด์เก่า", "2026-01-04", false),
  } as never;
  s.warehouses = { w1: { id: "w1", name: "คลัง", active: true } } as never;
  s.products = {
    pa: { id: "pa", brandId: "a", sellingName: "A" },
    pb: { id: "pb", brandId: "b", sellingName: "B" },
    pc: { id: "pc", brandId: "c", sellingName: "C" },
    pn: { id: "pn", sellingName: "ไม่มีแบรนด์" },
  } as never;
  s.variants = {
    va: { id: "va", productId: "pa" },
    vb: { id: "vb", productId: "pb" },
    vc: { id: "vc", productId: "pc" },
    vn: { id: "vn", productId: "pn" },
  } as never;
  const level = (v: string, q: number) => ({ itemId: v, warehouseId: "w1", qtyOnHand: q, qtyReserved: 0 });
  s.variantStock = { [stockKey("va", "w1")]: level("va", 10), [stockKey("vb", "w1")]: level("vb", 30), [stockKey("vc", "w1")]: level("vc", 5), [stockKey("vn", "w1")]: level("vn", 2) } as never;
  const list = [
    mv("m1", "va", "stock_in", 10, "SIN-1"),
    mv("m2", "vb", "stock_in", 20, "SIN-2"),
    mv("m3", "vb", "stock_in", 10, "SIN-2"),
    mv("m4", "va", "sale", -3, "SOUT-1"),
    mv("m5", "vc", "internal_use", -1, "SOUT-2"),
    mv("m6", "vb", "adjustment", -4, "ADJ-1"), // ปรับยอดไม่นับเป็นสต็อกออก
  ];
  s.movements = Object.fromEntries(list.map((m) => [m.id, m])) as never;
  return s;
}

describe("dashboardStatsByBrand: ตัวเลขการ์ดแยกตามแบรนด์", () => {
  it("แยก จำนวนปัจจุบัน / สต็อกเข้า / สต็อกออก ตามแบรนด์ของสินค้า เรียงตามลำดับที่สร้างแบรนด์", () => {
    const r = dashboardStatsByBrand(seed(), FROM, TO);
    expect(r.map((x) => x.name)).toEqual(["ISSA Apparel", "ISSA Activewear", "Fasonaf", "ไม่ระบุแบรนด์"]);
    const [apparel, active, fasonaf, none] = r;
    expect(apparel).toMatchObject({ currentQty: 10, stockIn: { qty: 10, docs: 1 }, stockOut: { qty: 3, docs: 1 } });
    expect(active).toMatchObject({ currentQty: 30, stockIn: { qty: 30, docs: 1 }, stockOut: { qty: 0, docs: 0 } });
    expect(fasonaf).toMatchObject({ currentQty: 5, stockIn: { qty: 0, docs: 0 }, stockOut: { qty: 1, docs: 1 } });
    expect(none).toMatchObject({ currentQty: 2 });
  });

  it("ผลรวมทุกแบรนด์เท่ากับตัวเลขรวมของแดชบอร์ดเสมอ", () => {
    const s = seed();
    const total = dashboardStats(s, FROM, TO);
    const r = dashboardStatsByBrand(s, FROM, TO);
    const sum = (f: (b: (typeof r)[number]) => number) => r.reduce((acc, b) => acc + f(b), 0);
    expect(sum((b) => b.currentQty)).toBe(total.currentQty);
    expect(sum((b) => b.stockIn.qty)).toBe(total.stockIn.qty);
    expect(sum((b) => b.stockOut.qty)).toBe(total.stockOut.qty);
  });

  it("แบรนด์ที่ปิดใช้งานและไม่มีตัวเลขไม่แสดง / ไม่มีสินค้าไม่ระบุแบรนด์ก็ไม่แสดงแถวนั้น", () => {
    const s = seed();
    s.products = { ...s.products } as never;
    delete (s.variants as Record<string, unknown>).vn;
    const names = dashboardStatsByBrand(s, FROM, TO).map((x) => x.name);
    expect(names).not.toContain("แบรนด์เก่า");
    expect(names).not.toContain("ไม่ระบุแบรนด์");
  });

  it("นับเฉพาะรายการในช่วงวันที่เลือก ส่วนจำนวนปัจจุบันเป็นยอดตอนนี้เสมอ", () => {
    const r = dashboardStatsByBrand(seed(), "2026-11-01T00:00:00.000Z", "2026-11-30T00:00:00.000Z");
    expect(r.find((x) => x.name === "ISSA Apparel")).toMatchObject({ currentQty: 10, stockIn: { qty: 0 }, stockOut: { qty: 0 } });
  });
});
