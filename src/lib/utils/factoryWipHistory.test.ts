import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { wipEntryRows, wipHistorySheetRows } from "./factoryWipView";

const base = { actorId: "u1", actorName: "คุณ" };

function seed() {
  const ids = { blkM: "", whtL: "" };
  const state = produce(emptyState(), (d) => {
    const p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    ids.blkM = engine.addVariant(d, p, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    ids.whtL = engine.addVariant(d, p, { color: "ขาว", size: "L", purchasePrice: 400, sellingPrice: 1090 });
    engine.recordFactoryWip(d, { ...base, kind: "opening", date: "2026-11-05T00:00:00.000Z", lines: [{ variantId: ids.blkM, qty: 100 }, { variantId: ids.whtL, qty: 40 }] });
    engine.recordFactoryWip(d, { ...base, kind: "scrap", date: "2026-11-10T00:00:00.000Z", note: "ผ้าขาด", lines: [{ variantId: ids.blkM, qty: 3 }] });
  });
  return { state, ...ids };
}

describe("ประวัติโรงงาน BC (ทีละสี/ไซซ์)", () => {
  it("แสดงทุกช่องที่บันทึก พร้อมรุ่น สี ไซซ์ จำนวนติดลบสำหรับเสียหาย", () => {
    const { state } = seed();
    const rows = wipEntryRows(state);
    expect(rows).toHaveLength(3);
    const scrap = rows.find((r) => r.kind === "scrap")!;
    expect(scrap).toMatchObject({ productName: "Billie Slim", color: "ดำ", size: "M", qtyChange: -3, note: "ผ้าขาด", actorName: "คุณ" });
  });

  it("กรองตามประเภท ช่วงวันที่ และคำค้น", () => {
    const { state } = seed();
    expect(wipEntryRows(state, { kind: "opening" })).toHaveLength(2);
    expect(wipEntryRows(state, { from: new Date("2026-11-08").getTime(), to: new Date("2026-11-30").getTime() })).toHaveLength(1);
    expect(wipEntryRows(state, { search: "ขาว" })).toHaveLength(1);
    expect(wipEntryRows(state, { search: "ผ้าขาด" })).toHaveLength(1);
    expect(wipEntryRows(state, { search: "ไม่มีคำนี้" })).toHaveLength(0);
  });

  it("แถวสำหรับ Excel มีหัวคอลัมน์และข้อมูลครบ", () => {
    const { state } = seed();
    const sheet = wipHistorySheetRows(wipEntryRows(state));
    expect(sheet[0]).toEqual(["วันที่", "ประเภท", "รุ่น", "สี", "ไซซ์", "SKU", "จำนวน", "ผู้บันทึก", "หมายเหตุ"]);
    expect(sheet).toHaveLength(4);
  });
});
