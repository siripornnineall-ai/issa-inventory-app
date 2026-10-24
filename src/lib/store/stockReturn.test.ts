import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import * as engine from "./engine";
import { dashboardStats, returnStats } from "./selectors";
import { STOCK_RETURN_TYPES } from "@/lib/types";

const FROM = "2000-01-01T00:00:00.000Z";
const TO = "2100-01-01T00:00:00.000Z";
const DATE = new Date().toISOString();

// รุ่นเดียว 1 ตัวเลือก มีของใหม่รับเข้า 10 ชิ้น และขายออก 4 ชิ้น
function seed() {
  const ids = { warehouse: "", variant: "" };
  const state = produce(emptyState(), (draft) => {
    ids.warehouse = engine.upsertWarehouse(draft, { name: "คลังหลัก", type: "main" });
    const productId = engine.createProduct(draft, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกงขายาว", status: "active", images: [] });
    ids.variant = engine.addVariant(draft, productId, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    engine.stockIn(draft, { itemType: "product", date: DATE, warehouseId: ids.warehouse, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.variant, qty: 10 }] });
    engine.stockOut(draft, { itemType: "product", date: DATE, warehouseId: ids.warehouse, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: ids.variant, qty: 4 }] });
  });
  return { state, ...ids };
}

const qtyOf = (s: ReturnType<typeof seed>["state"], v: string, w: string) => s.variantStock[`${v}::${w}`]?.qtyOnHand ?? 0;

describe("stockReturn: สต็อกคืนสินค้า", () => {
  it("รับคืนแล้วสต็อกเพิ่ม บันทึกเป็นชนิดของประเภทที่เลือก เลขที่ใบขึ้นต้น SRT และเก็บช่องทางไว้ในเหตุผล", () => {
    const { state, warehouse, variant } = seed();
    expect(qtyOf(state, variant, warehouse)).toBe(6);
    const next = produce(state, (d) => {
      engine.stockReturn(d, { date: DATE, warehouseId: warehouse, returnType: "return_customer", channel: "shopee", receivedBy: "u1", receivedByName: "รับคืน", note: "ไซซ์ไม่พอดี", lines: [{ itemId: variant, qty: 2 }] });
    });
    expect(qtyOf(next, variant, warehouse)).toBe(8);
    const mv = Object.values(next.movements).find((m) => m.movementType === "return_customer")!;
    expect(mv).toMatchObject({ qtyChange: 2, qtyBefore: 6, qtyAfter: 8, note: "ไซซ์ไม่พอดี" });
    expect(mv.reason).toBe("สินค้าคืน · Shopee");
    expect(mv.refNo).toMatch(/^SRT-\d{8}-\d{4}$/);
    const doc = Object.values(next.stockInDocs).find((x) => x.returnType === "return_customer")!;
    expect(doc.docNo).toBe(mv.refNo);
    expect(doc.lines).toHaveLength(1);
  });

  it("ทั้ง 4 ประเภทบันทึกได้ และแต่ละประเภทใช้ชนิดการเคลื่อนไหวของตัวเอง", () => {
    const { state, warehouse, variant } = seed();
    const next = produce(state, (d) => {
      for (const t of STOCK_RETURN_TYPES) engine.stockReturn(d, { date: DATE, warehouseId: warehouse, returnType: t, receivedBy: "u1", receivedByName: "x", lines: [{ itemId: variant, qty: 1 }] });
    });
    const types = Object.values(next.movements).map((m) => m.movementType);
    for (const t of STOCK_RETURN_TYPES) expect(types.filter((x) => x === t)).toHaveLength(1);
    expect(qtyOf(next, variant, warehouse)).toBe(10);
  });

  it("ไม่เลือกประเภท / ไม่มีรายการ / จำนวนไม่เกิน 0 ต้องปฏิเสธ และไม่แตะสต็อก", () => {
    const { state, warehouse, variant } = seed();
    const base = { date: DATE, warehouseId: warehouse, receivedBy: "u1", receivedByName: "x" };
    expect(() => produce(state, (d) => { engine.stockReturn(d, { ...base, returnType: "" as never, lines: [{ itemId: variant, qty: 1 }] }); })).toThrow(engine.BusinessRuleError);
    expect(() => produce(state, (d) => { engine.stockReturn(d, { ...base, returnType: "return_rts", lines: [] }); })).toThrow(engine.BusinessRuleError);
    expect(() => produce(state, (d) => { engine.stockReturn(d, { ...base, returnType: "return_rts", lines: [{ itemId: variant, qty: 0 }] }); })).toThrow(engine.BusinessRuleError);
    expect(qtyOf(state, variant, warehouse)).toBe(6);
  });

  it("ของคืนไม่ปนกับ 'สต็อกเข้า' บนแดชบอร์ด และสรุปแยกประเภท พร้อมอัตราเทียบยอดขาย", () => {
    const { state, warehouse, variant } = seed();
    const next = produce(state, (d) => {
      engine.stockReturn(d, { date: DATE, warehouseId: warehouse, returnType: "return_customer", receivedBy: "u1", receivedByName: "x", lines: [{ itemId: variant, qty: 1 }] });
      engine.stockReturn(d, { date: DATE, warehouseId: warehouse, returnType: "return_rts", receivedBy: "u1", receivedByName: "x", lines: [{ itemId: variant, qty: 1 }] });
    });
    const dash = dashboardStats(next, FROM, TO);
    expect(dash.stockIn.qty).toBe(10); // เฉพาะของใหม่ ไม่รวมของคืน 2 ชิ้น
    expect(dash.stockOut.qty).toBe(4);
    const r = returnStats(next, FROM, TO);
    expect(r.total).toEqual({ qty: 2, docs: 2 });
    expect(r.byType.return_customer).toEqual({ qty: 1, docs: 1 });
    expect(r.byType.return_rts).toEqual({ qty: 1, docs: 1 });
    expect(r.byType.return_defective).toEqual({ qty: 0, docs: 0 });
    expect(r.salesQty).toBe(4);
    expect(r.ratePct).toBe(50); // คืน 2 จากขาย 4
  });

  it("ไม่มียอดขายในช่วงนั้น อัตราเป็น null (ไม่หารด้วยศูนย์)", () => {
    const { state } = seed();
    expect(returnStats(state, "2000-01-01T00:00:00.000Z", "2000-01-02T00:00:00.000Z").ratePct).toBeNull();
  });
});
