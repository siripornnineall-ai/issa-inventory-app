import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { returnSummary } from "./returnSummary";

const NOW = Date.now();
const DATE = new Date(NOW).toISOString();
const ALL = { from: NOW - 30 * 86400000, to: NOW + 86400000 };

function seed() {
  const ids = { wh: "", brandA: "", brandB: "", slimBlk: "", slimWht: "", wendyBlk: "", doc: { customer: "", exchange: "", rts: "" } };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    ids.brandA = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    ids.brandB = engine.upsertBrand(d, { name: "Fasonaf", code: "FS" });
    const slim = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [], brandId: ids.brandA });
    const wendy = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1290, category: "กางเกง", status: "active", images: [], brandId: ids.brandB });
    ids.slimBlk = engine.addVariant(d, slim, { color: "ดำ", size: "XL", purchasePrice: 400, sellingPrice: 1090 });
    ids.slimWht = engine.addVariant(d, slim, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    ids.wendyBlk = engine.addVariant(d, wendy, { color: "ดำ", size: "XL", purchasePrice: 400, sellingPrice: 1290 });
    engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.slimBlk, qty: 50 }, { itemId: ids.slimWht, qty: 50 }, { itemId: ids.wendyBlk, qty: 50 }] });
    engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: ids.wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: ids.slimBlk, qty: 10 }, { itemId: ids.wendyBlk, qty: 10 }] });
    const base = { date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "คืน" };
    ids.doc.customer = engine.stockReturn(d, { ...base, returnType: "return_customer", channel: "shopee", note: "ลูกค้าบอกใส่แล้วอึดอัด", lines: [{ itemId: ids.slimBlk, qty: 2, unitPrice: 1000, reason: "size", tags: ["เล็กไป"] }] }).id;
    ids.doc.exchange = engine.stockReturn(d, { ...base, returnType: "return_exchange", channel: "facebook", lines: [{ itemId: ids.slimBlk, qty: 1, unitPrice: 1090, reason: "size", tags: ["เล็กไป", "ผ้าบาง"], exchangeToId: ids.wendyBlk }] }).id;
    ids.doc.rts = engine.stockReturn(d, { ...base, returnType: "return_rts", channel: "shopee", lines: [{ itemId: ids.wendyBlk, qty: 1, unitPrice: 1290, reason: "wrong_item" }] }).id;
  });
  return { state, ...ids };
}

describe("สรุปสินค้าคืน/เปลี่ยน", () => {
  it("รวมใบ ชิ้น มูลค่า และเทียบเป็นเปอร์เซ็นต์ของยอดขายช่วงเดียวกัน", () => {
    const { state } = seed();
    const s = returnSummary(state, ALL);
    expect(s.docs).toBe(3);
    expect(s.pieces).toBe(4);
    expect(s.value).toBe(2 * 1000 + 1090 + 1290);
    expect(s.salesPieces).toBe(20);
    expect(s.ratePct).toBe(20); // 4 / 20
    expect(s.byType.return_customer).toMatchObject({ docs: 1, pieces: 2, value: 2000 });
    expect(s.byType.return_exchange).toMatchObject({ docs: 1, pieces: 1 });
    expect(s.byType.return_defective.pieces).toBe(0);
  });

  it("เหตุผลเรียงจากมากไปน้อย คำที่ลูกค้าพูดนับเป็นชิ้น และช่องทางมาจากใบที่บันทึก", () => {
    const { state } = seed();
    const s = returnSummary(state, ALL);
    expect(s.byReason.map((r) => [r.label, r.pieces])).toEqual([
      ["ไซซ์ไม่พอดี", 3],
      ["ส่งผิดรุ่น/สี/ไซซ์", 1],
    ]);
    expect(s.byTag).toEqual([
      { tag: "เล็กไป", pieces: 3 },
      { tag: "ผ้าบาง", pieces: 1 },
    ]);
    expect(Object.fromEntries(s.byChannel.map((c) => [c.channel, c.pieces]))).toEqual({ Shopee: 3, Facebook: 1 });
    expect(s.notes.map((n) => n.text)).toContain("เล็กไป · ลูกค้าบอกใส่แล้วอึดอัด"); // คำที่ลูกค้าพูด + หมายเหตุ
  });

  it("เปลี่ยนจากอะไรเป็นอะไร: ระดับสี/ไซซ์ และระดับรุ่น", () => {
    const { state } = seed();
    const s = returnSummary(state, ALL);
    expect(s.exchanges).toEqual([{ from: "Billie Slim ดำ XL", to: "Wendy Mid ดำ XL", pieces: 1 }]);
    expect(s.exchangeModels).toEqual([{ from: "Billie Slim", to: "Wendy Mid", pieces: 1 }]);
  });

  it("ตัวกรองแบรนด์และประเภท", () => {
    const { state, brandB } = seed();
    const fas = returnSummary(state, { ...ALL, brandId: brandB });
    expect(fas.pieces).toBe(1); // เฉพาะ Wendy Mid ที่ตีกลับ
    expect(fas.salesPieces).toBe(10);
    const ex = returnSummary(state, { ...ALL, returnType: "return_exchange" });
    expect(ex.docs).toBe(1);
    expect(ex.pieces).toBe(1);
  });

  it("ใบเก่าที่ไม่มีเหตุผล/ราคา: นับเป็น \"ไม่ได้ระบุ\" และมูลค่าประมาณจากราคาขายปัจจุบัน (บอกจำนวนบรรทัดที่ประมาณ)", () => {
    const { state, slimWht, wh } = seed();
    const withOld = produce(state, (d) => {
      d.stockInDocs.old = { id: "old", docNo: "SRT-OLD-0001", date: DATE, itemType: "product", returnType: "return_customer", receiptImages: [], warehouseId: wh, lines: [{ id: "lo", itemId: slimWht, qty: 3 }], receivedBy: "u1", status: "confirmed", createdAt: DATE };
    });
    const s = returnSummary(withOld, ALL);
    const none = s.byReason.find((r) => r.code === "none")!;
    expect(none).toMatchObject({ label: "ไม่ได้ระบุ", pieces: 3, value: 3 * 1090 });
    expect(s.estimatedLines).toBe(1);
  });

  it("ใบที่ยกเลิกแล้วไม่ถูกนับ และใบนอกช่วงวันที่ไม่ถูกนับ", () => {
    const { state, doc } = seed();
    const cancelled = produce(state, (d) => {
      engine.cancelStockIns(d, [doc.customer], "รับผิด", "u2", "Su");
    });
    expect(returnSummary(cancelled, ALL).docs).toBe(2);
    expect(returnSummary(state, { from: NOW + 2 * 86400000, to: NOW + 3 * 86400000 }).docs).toBe(0);
  });
});
