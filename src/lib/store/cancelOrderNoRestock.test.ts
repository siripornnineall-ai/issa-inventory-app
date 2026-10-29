import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import * as engine from "./engine";
import { dashboardStats } from "./selectors";
import { salesBetween } from "@/lib/utils/salesMatrix";
import { voidedDocNos, isVoidedMovement } from "@/lib/utils/voidedMovements";

const FROM = "2000-01-01T00:00:00.000Z";
const TO = "2100-01-01T00:00:00.000Z";
const DATE = new Date().toISOString();

// รับเข้า 10 ชิ้น แล้ว "ขาย" 4 ชิ้นออก (เหมือนที่ขายหลอกเพื่อลบของรับเข้าผิด)
function seed() {
  const ids = { warehouse: "", variant: "", orderId: "", docNo: "" };
  const state = produce(emptyState(), (d) => {
    ids.warehouse = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const p = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1000, category: "กางเกงขายาว", status: "active", images: [] });
    ids.variant = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: ids.warehouse, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.variant, qty: 10 }] });
    const res = engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: ids.warehouse, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: ids.variant, qty: 4 }] });
    ids.orderId = res.order!.id;
    ids.docNo = res.doc.docNo;
  });
  return { state, ...ids };
}

const qtyOf = (s: ReturnType<typeof seed>["state"], v: string, w: string) => s.variantStock[`${v}::${w}`]?.qtyOnHand ?? 0;
const net = (s: ReturnType<typeof seed>["state"]) => {
  const range = { from: Date.now() - 86400000, to: Date.now() + 86400000 };
  return salesBetween(s, range, { from: 0, to: 0 }).reduce((sum, p) => sum + p.net, 0);
};

describe("ยกเลิกออเดอร์แบบไม่คืนสต็อก (ขายหลอกที่บันทึกเพื่อลบของรับเข้าผิด)", () => {
  it("ออเดอร์ที่สร้างจากการขายจำเลขที่ใบเบิกออกที่ตัดสต็อกไว้", () => {
    const { state, orderId, docNo } = seed();
    expect(state.orders[orderId].stockOutDocNo).toBe(docNo);
  });

  it("ยกเลิกแบบไม่คืนสต็อก: สต็อกไม่เปลี่ยน ออเดอร์เปลี่ยนเป็นยกเลิก (restocked ยังเป็น false) ไม่มีรายการคืนสต็อก", () => {
    const { state, warehouse, variant, orderId } = seed();
    expect(qtyOf(state, variant, warehouse)).toBe(6);
    const movCount = Object.keys(state.movements).length;
    const next = produce(state, (d) => {
      engine.cancelOrder(d, orderId, "  ลงผิดรุ่น ไม่ใช่ยอดขาย  ", "u9", "ผู้ดูแลระบบ (แก้ลงผิด)", { restock: false });
    });
    expect(qtyOf(next, variant, warehouse)).toBe(6);
    expect(next.orders[orderId]).toMatchObject({ status: "cancelled", cancelReason: "ลงผิดรุ่น ไม่ใช่ยอดขาย", restocked: false });
    expect(next.orders[orderId].cancelledAt).toBeTruthy();
    expect(Object.keys(next.movements)).toHaveLength(movCount); // ไม่มี cancel_restock เพิ่ม
  });

  it("ตัวเลขสรุปข้ามใบนั้น: ยอดขายสุทธิ ยอดขายและสต็อกออกบนแดชบอร์ด รวมทั้งเจาะลึก", () => {
    const { state, orderId, docNo } = seed();
    expect(net(state)).toBe(4);
    expect(dashboardStats(state, FROM, TO).stockOut.qty).toBe(4);
    const next = produce(state, (d) => {
      engine.cancelOrder(d, orderId, "ลงผิด", "u9", "แอดมิน", { restock: false });
    });
    expect(net(next)).toBe(0);
    const stats = dashboardStats(next, FROM, TO);
    expect(stats.stockOut.qty).toBe(0);
    expect(stats.sales.qty).toBe(0);
    expect(stats.stockIn.qty).toBe(10); // รับเข้าจริงยังนับ
    const set = voidedDocNos(next);
    expect(set.has(docNo)).toBe(true);
    expect(Object.values(next.movements).filter((m) => isVoidedMovement(m, set)).map((m) => m.movementType)).toEqual(["sale"]);
  });

  it("ต้องมีเหตุผล และยกเลิกซ้ำไม่ได้", () => {
    const { state, orderId } = seed();
    expect(() => produce(state, (d) => { engine.cancelOrder(d, orderId, "  ", "u9", "แอดมิน", { restock: false }); })).toThrow(/เหตุผล/);
    const once = produce(state, (d) => {
      engine.cancelOrder(d, orderId, "ลงผิด", "u9", "แอดมิน", { restock: false });
    });
    expect(() => produce(once, (d) => { engine.cancelOrder(d, orderId, "ซ้ำ", "u9", "แอดมิน", { restock: false }); })).toThrow(/ยกเลิกไปแล้ว/);
    expect(() => produce(once, (d) => { engine.cancelOrder(d, orderId, "ซ้ำ", "u9", "แอดมิน"); })).toThrow(/ยกเลิกไปแล้ว/);
  });

  it("ยกเลิกแบบปกติยังคืนสต็อกเหมือนเดิม และไม่ถูกนับเป็นใบที่ถูกยกเลิกแบบลงผิด", () => {
    const { state, warehouse, variant, orderId, docNo } = seed();
    const next = produce(state, (d) => {
      engine.cancelOrder(d, orderId, "ลูกค้ายกเลิก", "u9", "แอดมิน");
    });
    expect(qtyOf(next, variant, warehouse)).toBe(10);
    expect(next.orders[orderId]).toMatchObject({ status: "cancelled", restocked: true });
    expect(voidedDocNos(next).has(docNo)).toBe(false);
  });
});
