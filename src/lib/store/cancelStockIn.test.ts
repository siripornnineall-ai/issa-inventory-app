import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import * as engine from "./engine";
import { dashboardStats, returnStats, slowMovers } from "./selectors";
import { salesBetween } from "@/lib/utils/salesMatrix";
import { voidedDocNos, isVoidedMovement } from "@/lib/utils/voidedMovements";

const FROM = "2000-01-01T00:00:00.000Z";
const TO = "2100-01-01T00:00:00.000Z";
const DATE = new Date().toISOString();

// รุ่นเดียว 2 ตัวเลือก (ดำ M / ขาว M) ตั้งต้นสต็อก 0
function seed() {
  const ids = { warehouse: "", black: "", white: "" };
  const state = produce(emptyState(), (draft) => {
    ids.warehouse = engine.upsertWarehouse(draft, { name: "คลังหลัก", type: "main" });
    const productId = engine.createProduct(draft, { sellingName: "Wendy Mid", sellingPrice: 1090, category: "กางเกงขายาว", status: "active", images: [] });
    ids.black = engine.addVariant(draft, productId, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    ids.white = engine.addVariant(draft, productId, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1090 });
  });
  return { state, ...ids };
}

const qtyOf = (s: ReturnType<typeof seed>["state"], v: string, w: string) => s.variantStock[`${v}::${w}`]?.qtyOnHand ?? 0;
const recv = (d: Parameters<typeof engine.stockIn>[0], w: string, lines: { itemId: string; qty: number }[]) =>
  engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: w, receivedBy: "u1", receivedByName: "รับ", lines });

describe("ยกเลิกใบรับเข้า", () => {
  it("ยกเลิกแล้วหักสต็อกคืนตามที่รับเข้า ใบเปลี่ยนเป็นยกเลิกพร้อมเหตุผล และมีรายการหักคืนในประวัติ (รายการเดิมไม่ถูกลบ)", () => {
    const { state, warehouse, black, white } = seed();
    let docId = "";
    const received = produce(state, (d) => {
      docId = recv(d, warehouse, [{ itemId: black, qty: 15 }, { itemId: white, qty: 24 }]).id;
    });
    expect(qtyOf(received, black, warehouse)).toBe(15);

    const next = produce(received, (d) => {
      const res = engine.cancelStockIns(d, [docId], "  รับเข้าผิดรุ่น  ", "u2", "Su");
      expect(res).toEqual({ docs: 1, pieces: 39 });
    });
    expect(qtyOf(next, black, warehouse)).toBe(0);
    expect(qtyOf(next, white, warehouse)).toBe(0);

    const doc = next.stockInDocs[docId];
    expect(doc).toMatchObject({ status: "cancelled", cancelReason: "รับเข้าผิดรุ่น", cancelledByName: "Su" });
    expect(doc.cancelledAt).toBeTruthy();

    const movs = Object.values(next.movements).filter((m) => m.refNo === doc.docNo);
    expect(movs.filter((m) => m.movementType === "stock_in")).toHaveLength(2); // รายการเดิมยังอยู่
    const reversals = movs.filter((m) => m.movementType === "cancel_stock_in");
    expect(reversals).toHaveLength(2);
    expect(reversals.map((m) => m.qtyChange).sort((a, b) => a - b)).toEqual([-24, -15]);
    expect(reversals[0].reason).toBe(`ยกเลิกใบ ${doc.docNo}: รับเข้าผิดรุ่น`);
    expect(reversals[0].actorName).toBe("Su");
  });

  it("ยกเลิกหลายใบพร้อมกันได้ (เช่นรับเข้าทีละบรรทัดผิดรุ่นเป็นชุด) และต้องเป็นผลสำเร็จทั้งหมดหรือไม่ทำเลย", () => {
    const { state, warehouse, black, white } = seed();
    const ids: string[] = [];
    const received = produce(state, (d) => {
      ids.push(recv(d, warehouse, [{ itemId: black, qty: 5 }]).id);
      ids.push(recv(d, warehouse, [{ itemId: black, qty: 3 }]).id);
      ids.push(recv(d, warehouse, [{ itemId: white, qty: 2 }]).id);
    });
    // ขายขาวออกไป 1 ชิ้น → ใบขาวยกเลิกไม่ได้ ทั้งชุดต้องไม่ถูกยกเลิกเลย
    const sold = produce(received, (d) => {
      engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: warehouse, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: white, qty: 2 }] });
    });
    expect(() => produce(sold, (d) => { engine.cancelStockIns(d, ids, "ผิดรุ่น", "u2", "Su"); })).toThrow(engine.BusinessRuleError);
    expect(qtyOf(sold, black, warehouse)).toBe(8);
    expect(Object.values(sold.stockInDocs).every((x) => x.status === "confirmed")).toBe(true);

    // เฉพาะ 2 ใบของดำ ยกเลิกได้
    const next = produce(sold, (d) => {
      expect(engine.cancelStockIns(d, ids.slice(0, 2), "ผิดรุ่น", "u2", "Su")).toEqual({ docs: 2, pieces: 8 });
    });
    expect(qtyOf(next, black, warehouse)).toBe(0);
  });

  it("ของจากใบนั้นถูกขายออกไปแล้วจนคงเหลือไม่พอหักคืน → ปฏิเสธ บอกชื่อสินค้า/จำนวน และไม่แตะสต็อก (ไม่ปล่อยให้ติดลบ)", () => {
    const { state, warehouse, black } = seed();
    let docId = "";
    const received = produce(state, (d) => {
      docId = recv(d, warehouse, [{ itemId: black, qty: 5 }]).id;
      engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: warehouse, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: black, qty: 3 }] });
    });
    expect(() => produce(received, (d) => { engine.cancelStockIns(d, [docId], "ผิดรุ่น", "u2", "Su"); })).toThrow(/รับเข้า 5 ชิ้น แต่ตอนนี้คงเหลือ 2 ชิ้น/);
    expect(qtyOf(received, black, warehouse)).toBe(2);
    expect(received.stockInDocs[docId].status).toBe("confirmed");
    expect(engine.stockInCancelProblems(received, [docId])).toHaveLength(1);
  });

  it("ต้องมีเหตุผล ยกเลิกซ้ำไม่ได้ ไม่พบใบไม่ได้ และไม่เลือกใบเลยไม่ได้", () => {
    const { state, warehouse, black } = seed();
    let docId = "";
    const received = produce(state, (d) => {
      docId = recv(d, warehouse, [{ itemId: black, qty: 5 }]).id;
    });
    expect(() => produce(received, (d) => { engine.cancelStockIns(d, [docId], "   ", "u2", "Su"); })).toThrow(/เหตุผล/);
    expect(() => produce(received, (d) => { engine.cancelStockIns(d, [], "ผิด", "u2", "Su"); })).toThrow(/เลือกใบ/);
    expect(() => produce(received, (d) => { engine.cancelStockIns(d, ["nope"], "ผิด", "u2", "Su"); })).toThrow(/ไม่พบใบ/);
    const once = produce(received, (d) => { engine.cancelStockIns(d, [docId], "ผิด", "u2", "Su"); });
    expect(() => produce(once, (d) => { engine.cancelStockIns(d, [docId], "ผิดอีก", "u2", "Su"); })).toThrow(/ยกเลิกไปแล้ว/);
    expect(qtyOf(once, black, warehouse)).toBe(0);
  });

  it("ใบรับคืนก็ยกเลิกได้ และไม่ถูกนับเป็นสินค้าคืนหรือหักยอดขายสุทธิอีก", () => {
    const { state, warehouse, black } = seed();
    let docId = "";
    const base = produce(state, (d) => {
      recv(d, warehouse, [{ itemId: black, qty: 10 }]);
      engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: warehouse, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: black, qty: 4 }] });
    });
    const returned = produce(base, (d) => {
      docId = engine.stockReturn(d, { date: DATE, warehouseId: warehouse, returnType: "return_customer", receivedBy: "u1", receivedByName: "คืน", lines: [{ itemId: black, qty: 2, reason: "size" }] }).id;
    });
    expect(returnStats(returned, FROM, TO).total.qty).toBe(2);

    const cancelled = produce(returned, (d) => { engine.cancelStockIns(d, [docId], "ลงผิดหน้า", "u2", "Su"); });
    expect(qtyOf(cancelled, black, warehouse)).toBe(6);
    expect(returnStats(cancelled, FROM, TO).total.qty).toBe(0);
  });

  it("ตัวเลขสรุปข้ามใบที่ยกเลิกแล้ว: สต็อกเข้าบนแดชบอร์ดไม่นับทั้งรายการเดิมและรายการหักคืน", () => {
    const { state, warehouse, black } = seed();
    let docId = "";
    const received = produce(state, (d) => {
      docId = recv(d, warehouse, [{ itemId: black, qty: 142 }]).id;
      recv(d, warehouse, [{ itemId: black, qty: 8 }]);
    });
    expect(dashboardStats(received, FROM, TO).stockIn.qty).toBe(150);
    const cancelled = produce(received, (d) => { engine.cancelStockIns(d, [docId], "ผิดรุ่น", "u2", "Su"); });
    expect(dashboardStats(cancelled, FROM, TO).stockIn.qty).toBe(8);
    expect(dashboardStats(cancelled, FROM, TO).stockOut.qty).toBe(0);

    const set = voidedDocNos(cancelled);
    const docNo = cancelled.stockInDocs[docId].docNo;
    expect(set.has(docNo)).toBe(true);
    const movs = Object.values(cancelled.movements);
    expect(movs.filter((m) => isVoidedMovement(m, set))).toHaveLength(2);
  });

  it("ใบที่ยกเลิกไม่รีเซ็ตวันที่รับของล่าสุดของสินค้าค้างสต็อก", () => {
    const { state, warehouse, black } = seed();
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    let wrongDocId = "";
    const received = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: longAgo, warehouseId: warehouse, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: black, qty: 10 }] });
      wrongDocId = recv(d, warehouse, [{ itemId: black, qty: 1 }]).id;
    });
    const cancelled = produce(received, (d) => { engine.cancelStockIns(d, [wrongDocId], "ผิด", "u2", "Su"); });
    const item = slowMovers(cancelled).find((s) => s.variantId === black);
    expect(item?.daysSinceReceived).toBeGreaterThan(50);
  });

  it("ยอดขายสุทธิไม่หักของคืนจากใบที่ยกเลิก", () => {
    const { state, warehouse, black } = seed();
    let docId = "";
    const base = produce(state, (d) => {
      recv(d, warehouse, [{ itemId: black, qty: 10 }]);
      engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: warehouse, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: black, qty: 4 }] });
    });
    const returned = produce(base, (d) => {
      docId = engine.stockReturn(d, { date: DATE, warehouseId: warehouse, returnType: "return_rts", receivedBy: "u1", receivedByName: "คืน", lines: [{ itemId: black, qty: 3, reason: "size" }] }).id;
    });
    const range = { from: new Date(Date.now() - 86400000).getTime(), to: new Date(Date.now() + 86400000).getTime() };
    const net = (s: typeof returned) => salesBetween(s, range, { from: 0, to: 0 }).reduce((sum, p) => sum + p.net, 0);
    expect(net(returned)).toBe(1); // ขาย 4 − คืน 3
    const cancelled = produce(returned, (d) => { engine.cancelStockIns(d, [docId], "ผิด", "u2", "Su"); });
    expect(net(cancelled)).toBe(4);
  });
});
