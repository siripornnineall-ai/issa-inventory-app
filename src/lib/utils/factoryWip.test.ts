import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { wipBalances, wipByProduct } from "./factoryWip";
import { wipBatches, wipMatrices } from "./factoryWipView";

const DATE = "2026-11-10T00:00:00.000Z";

function seed() {
  const ids = { wh: "", brand: "", slim: "", blkM: "", blkL: "", whtM: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    ids.brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    ids.slim = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [], brandId: ids.brand });
    ids.blkM = engine.addVariant(d, ids.slim, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    ids.blkL = engine.addVariant(d, ids.slim, { color: "ดำ", size: "L", purchasePrice: 400, sellingPrice: 1090 });
    ids.whtM = engine.addVariant(d, ids.slim, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1090 });
  });
  return { state, ...ids };
}

const base = { date: DATE, actorId: "u1", actorName: "คุณ" };
const receive = (d: Parameters<typeof engine.stockIn>[0], wh: string, itemId: string, qty: number, fromWip: boolean) =>
  engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", fromWip, lines: [{ itemId, qty }] });

describe("โรงงาน BC: ตัวที่ยังไม่เย็บ", () => {
  it("ยอดตั้งต้น + ตัดเข้า รวมเป็นยอดยังไม่เย็บแยกสี/ไซซ์ และไม่แตะสต็อกสินค้า", () => {
    const { state, blkM, blkL, whtM } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 100 }, { variantId: whtM, qty: 40 }] });
      engine.recordFactoryWip(d, { ...base, kind: "cut_in", lines: [{ variantId: blkM, qty: 50 }, { variantId: blkL, qty: 30 }] });
    });
    const bal = wipBalances(next);
    expect(bal.get(blkM)).toBe(150);
    expect(bal.get(blkL)).toBe(30);
    expect(bal.get(whtM)).toBe(40);
    // ไม่ปนกับสต็อกสินค้า: ไม่มีรายการเคลื่อนไหว ไม่มียอดคงเหลือเพิ่ม
    expect(Object.keys(next.movements)).toHaveLength(0);
    expect(Object.values(next.variantStock).every((s) => s.qtyOnHand === 0)).toBe(true);
    expect(wipByProduct(next)[0]).toMatchObject({ name: "Billie Slim", total: 220 });
  });

  it("รับเข้าแบบ 'เย็บเสร็จจากโรงงาน BC' เพิ่มสต็อกสินค้า และหักตัวที่ยังไม่เย็บสี/ไซซ์เดียวกัน", () => {
    const { state, wh, blkM, blkL } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 100 }, { variantId: blkL, qty: 20 }] });
      receive(d, wh, blkM, 60, true);
    });
    expect(wipBalances(next).get(blkM)).toBe(40);
    expect(wipBalances(next).get(blkL)).toBe(20); // สี/ไซซ์อื่นไม่ถูกหัก
    expect(next.variantStock[`${blkM}::${wh}`].qtyOnHand).toBe(60);
    const mv = Object.values(next.movements).find((m) => m.movementType === "stock_in")!;
    expect(mv.reason).toContain("โรงงาน BC");
  });

  it("รับเข้าปกติ (ไม่ใช่เย็บเสร็จ) ไม่หักตัวที่ยังไม่เย็บ", () => {
    const { state, wh, blkM } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 100 }] });
      receive(d, wh, blkM, 60, false);
    });
    expect(wipBalances(next).get(blkM)).toBe(100);
  });

  it("รับมากกว่าที่บันทึกไว้: บันทึกได้ ยอดติดลบ (ตกลงแบบ ข)", () => {
    const { state, wh, blkM } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 40 }] });
      receive(d, wh, blkM, 60, true);
    });
    expect(wipBalances(next).get(blkM)).toBe(-20);
    expect(wipByProduct(next)[0].negativeCells).toBe(1);
  });

  it("ยกเลิกใบรับเข้า ยอดยังไม่เย็บกลับมาเอง", () => {
    const { state, wh, blkM } = seed();
    let docId = "";
    const received = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 100 }] });
      docId = receive(d, wh, blkM, 60, true).id;
    });
    expect(wipBalances(received).get(blkM)).toBe(40);
    const cancelled = produce(received, (d) => {
      engine.cancelStockIns(d, [docId], "รับผิด", "u1", "คุณ");
    });
    expect(wipBalances(cancelled).get(blkM)).toBe(100);
  });

  it("เสียหายเป็นลบให้เอง ปรับยอดลดได้ และต้องมีเหตุผล", () => {
    const { state, blkM } = seed();
    const base2 = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 100 }] });
    });
    const next = produce(base2, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "scrap", note: "ผ้าขาด", lines: [{ variantId: blkM, qty: 5 }] });
      engine.recordFactoryWip(d, { ...base, kind: "adjust", note: "นับแล้วขาด", lines: [{ variantId: blkM, qty: -3 }] });
    });
    expect(wipBalances(next).get(blkM)).toBe(92);
    expect(() => produce(base2, (d) => void engine.recordFactoryWip(d, { ...base, kind: "scrap", lines: [{ variantId: blkM, qty: 1 }] }))).toThrow(/เหตุผล/);
    expect(() => produce(base2, (d) => void engine.recordFactoryWip(d, { ...base, kind: "cut_in", lines: [{ variantId: blkM, qty: -1 }] }))).toThrow(/มากกว่า 0/);
    expect(() => produce(base2, (d) => void engine.recordFactoryWip(d, { ...base, kind: "cut_in", lines: [{ variantId: blkM, qty: 0 }] }))).toThrow(/อย่างน้อย 1/);
  });

  it("รับมาจากโรงงาน BC ใช้กับอุปกรณ์ไม่ได้", () => {
    const { state, wh } = seed();
    expect(() =>
      produce(state, (d) => {
        engine.stockIn(d, { itemType: "equipment", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", fromWip: true, lines: [{ itemId: "x", qty: 1 }] });
      })
    ).toThrow(/เฉพาะสินค้า/);
  });

  it("ตารางสี x ไซซ์และประวัติการบันทึกรวมตามครั้งที่บันทึก", () => {
    const { state, blkM, blkL, whtM, brand } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: blkM, qty: 100 }, { variantId: blkL, qty: 20 }, { variantId: whtM, qty: 40 }] });
    });
    const [m] = wipMatrices(next);
    expect(m.sizes).toEqual(["M", "L"]);
    expect(m.colors[0]).toMatchObject({ color: "ดำ", total: 120 });
    expect(m.sizeTotals).toEqual({ M: 140, L: 20 });
    expect(wipMatrices(next, { search: "ไม่มีรุ่นนี้" })).toHaveLength(0);
    expect(wipMatrices(next, { brandId: brand })).toHaveLength(1);
    const batches = wipBatches(next);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ pieces: 160, cells: 3, kind: "opening", products: ["Billie Slim"] });
  });
});
