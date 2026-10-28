import { describe, it, expect } from "vitest";
import { emptyState, type AppState } from "@/lib/store/state";
import { changePct, monthRange, monthlySales, salesSheetRows, shiftMonth } from "./salesMatrix";

const line = (variantId: string, qty: number) => ({ id: variantId + qty, productId: "p1", variantId, qty, unitPrice: 100, discount: 0 });
const order = (id: string, date: string, lines: ReturnType<typeof line>[], status = "completed") => ({ id, orderNo: id, date, channel: "online", warehouseId: "w1", lines, status, restocked: false, createdAt: date });
const mv = (id: string, createdAt: string, variantId: string, movementType: string, qtyChange: number) => ({
  id,
  createdAt,
  refNo: id,
  itemType: "product",
  itemId: variantId,
  variantId,
  itemName: "x",
  sku: "x",
  movementType,
  qtyChange,
  qtyBefore: 0,
  qtyAfter: qtyChange,
  actorId: "u",
  actorName: "u",
});

function build(orders: ReturnType<typeof order>[], movements: ReturnType<typeof mv>[] = []): AppState {
  return {
    ...emptyState(),
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
    products: {
      p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", createdAt: "" },
      p2: { id: "p2", sellingName: "Bruno Slim", brandId: "b1", createdAt: "" },
    },
    variants: {
      "v-black-M": { id: "v-black-M", productId: "p1", color: "ดำ", size: "M", sku: "a", active: true },
      "v-black-L": { id: "v-black-L", productId: "p1", color: "ดำ", size: "L", sku: "b", active: true },
      "v-cream-M": { id: "v-cream-M", productId: "p1", color: "ครีม", size: "M", sku: "c", active: true },
      "v-cream-L": { id: "v-cream-L", productId: "p1", color: "ครีม", size: "L", sku: "d", active: true },
      "v-bruno": { id: "v-bruno", productId: "p2", color: "ดำ", size: "M", sku: "e", active: true },
    },
    orders: Object.fromEntries(orders.map((o) => [o.id, o])),
    movements: Object.fromEntries(movements.map((m) => [m.id, m])),
  } as unknown as AppState;
}

describe("monthRange / shiftMonth", () => {
  it("เดือนตามปฏิทิน: วันที่ 1 ถึงก่อนวันที่ 1 ของเดือนถัดไป และข้ามปีได้", () => {
    const r = monthRange(2026, 9);
    expect(new Date(r.from).getDate()).toBe(1);
    expect(new Date(r.to).getMonth()).toBe(10);
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month0: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
  });
});

describe("monthlySales: ยอดขายสุทธิรายเดือนตามรุ่น/สี/ไซซ์", () => {
  it("นับชิ้นของออเดอร์ในเดือนนั้น แยกสีและไซซ์ เรียงสีจากขายมากไปน้อย พร้อมสัดส่วน", () => {
    const state = build([
      order("o1", "2026-10-05T10:00:00", [line("v-black-M", 3), line("v-cream-L", 7)]),
      order("o2", "2026-10-20T10:00:00", [line("v-black-L", 5)]),
    ]);
    const [p] = monthlySales(state, 2026, 9);
    expect(p.name).toBe("Billie Slim");
    expect(p.sold).toBe(15);
    expect(p.net).toBe(15);
    expect(p.colors.map((c) => c.color)).toEqual(["ดำ", "ครีม"]); // ดำ 3+5=8, ครีม 7
  });

  it("เรียงสีตามยอดรวมมากไปน้อย และ % = สัดส่วนของรุ่น", () => {
    const state = build([order("o1", "2026-10-05T10:00:00", [line("v-black-M", 3), line("v-cream-L", 7)])]);
    const [p] = monthlySales(state, 2026, 9);
    expect(p.colors.map((c) => [c.color, c.total, c.sharePct])).toEqual([
      ["ครีม", 7, 70],
      ["ดำ", 3, 30],
    ]);
    expect(p.sizes).toEqual(["M", "L"]);
    expect(p.sizeTotals).toEqual({ M: 3, L: 7 });
  });

  it("ออเดอร์ที่ยกเลิกไม่นับ (หายไปจากเดือนที่ขาย)", () => {
    const state = build([order("o1", "2026-10-05T10:00:00", [line("v-black-M", 4)]), order("o2", "2026-10-06T10:00:00", [line("v-black-M", 6)], "cancelled")]);
    const [p] = monthlySales(state, 2026, 9);
    expect(p.sold).toBe(4);
  });

  it("ยกเลิกทีหลังข้ามเดือน ก็ไม่ไปติดลบเดือนที่ยกเลิก (นับตามวันที่ขาย)", () => {
    const state = build([order("o1", "2026-09-28T10:00:00", [line("v-black-M", 6)], "cancelled")]);
    expect(monthlySales(state, 2026, 8)).toEqual([]);
    expect(monthlySales(state, 2026, 9)).toEqual([]);
  });

  it("ของคืน (ตีกลับ/คืน/เปลี่ยน) หักในเดือนที่รับคืนเข้าคลัง ไม่ใช่เดือนที่ขาย", () => {
    const state = build(
      [order("o1", "2026-09-20T10:00:00", [line("v-black-M", 10)]), order("o2", "2026-10-02T10:00:00", [line("v-black-M", 5)])],
      [mv("m1", "2026-10-08T10:00:00", "v-black-M", "return_rts", 2), mv("m2", "2026-10-09T10:00:00", "v-black-M", "return_customer", 1), mv("m3", "2026-10-10T10:00:00", "v-black-M", "return_exchange", 1)],
    );
    const sep = monthlySales(state, 2026, 8)[0];
    expect(sep.net).toBe(10); // กันยายนไม่ถูกหัก
    const oct = monthlySales(state, 2026, 9)[0];
    expect(oct.sold).toBe(5);
    expect(oct.returned).toBe(4);
    expect(oct.net).toBe(1);
    expect(oct.prevNet).toBe(10);
  });

  it("สินค้าตำหนิที่คืนเข้ามาไม่หักยอดขาย", () => {
    const state = build([order("o1", "2026-10-02T10:00:00", [line("v-black-M", 5)])], [mv("m1", "2026-10-08T10:00:00", "v-black-M", "return_defective", 3)]);
    const [p] = monthlySales(state, 2026, 9);
    expect(p.returned).toBe(0);
    expect(p.net).toBe(5);
  });

  it("ขอบเขตเดือน: วันที่ 1 เวลา 00:00 นับเดือนใหม่ และวันสุดท้ายเวลา 23:59 ยังนับเดือนเดิม", () => {
    const state = build([order("o1", "2026-10-01T00:00:00", [line("v-black-M", 2)]), order("o2", "2026-09-30T23:59:59", [line("v-black-M", 9)])]);
    expect(monthlySales(state, 2026, 9)[0].net).toBe(2);
    expect(monthlySales(state, 2026, 8)[0].net).toBe(9);
  });

  it("ไม่แสดงรุ่นที่ไม่มียอดในเดือนนั้น และเรียงรุ่นจากขายมากไปน้อย", () => {
    const state = build([order("o1", "2026-10-05T10:00:00", [line("v-black-M", 2), line("v-bruno", 9)])]);
    expect(monthlySales(state, 2026, 9).map((p) => p.name)).toEqual(["Bruno Slim", "Billie Slim"]);
    expect(monthlySales(state, 2026, 7)).toEqual([]);
  });

  it("สีที่ไม่มียอดซ่อนไว้ แต่แสดงได้ด้วย includeEmptyColors", () => {
    const state = build([order("o1", "2026-10-05T10:00:00", [line("v-black-M", 2)])]);
    expect(monthlySales(state, 2026, 9)[0].colors.map((c) => c.color)).toEqual(["ดำ"]);
    const withEmpty = monthlySales(state, 2026, 9, { includeEmptyColors: true })[0];
    expect(withEmpty.colors.map((c) => c.color)).toEqual(["ดำ", "ครีม"]);
    expect(withEmpty.colors[1].total).toBe(0);
  });

  it("ยอดสุทธิรุ่นไม่เป็นบวก (คืนมากกว่าขาย) แสดงติดลบได้ และไม่คิด %", () => {
    const state = build([order("o1", "2026-10-02T10:00:00", [line("v-black-M", 1)])], [mv("m1", "2026-10-08T10:00:00", "v-black-M", "return_rts", 3)]);
    const [p] = monthlySales(state, 2026, 9);
    expect(p.net).toBe(-2);
    expect(p.colors[0].total).toBe(-2);
    expect(p.colors[0].sharePct).toBeNull();
  });
});

describe("changePct / salesSheetRows", () => {
  it("เทียบเดือนก่อนเป็น % และเป็น null เมื่อเดือนก่อนไม่มียอด", () => {
    expect(changePct(15, 10)).toBe(50);
    expect(changePct(5, 10)).toBe(-50);
    expect(changePct(5, 0)).toBeNull();
  });

  it("แถว Excel หน้าตาเหมือนชีต: ชื่อรุ่น / หัวไซซ์ / สี / รวมต่อไซซ์", () => {
    const state = build([order("o1", "2026-10-05T10:00:00", [line("v-black-M", 3), line("v-cream-L", 7)])]);
    const rows = salesSheetRows("ยอดขาย", monthlySales(state, 2026, 9));
    expect(rows[0]).toEqual(["ยอดขาย"]);
    expect(rows).toContainEqual(["Billie Slim"]);
    expect(rows).toContainEqual(["สี", "M", "L", "รวมต่อสี", "%"]);
    expect(rows).toContainEqual(["ครีม", 0, 7, 7, "70%"]);
    expect(rows).toContainEqual(["รวมต่อไซซ์", 3, 7, 10, "100%"]);
  });
});
