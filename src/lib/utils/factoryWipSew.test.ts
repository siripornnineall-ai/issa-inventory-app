import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { needCutRows, sewFirstRows, sewLevel, wipMatrices } from "./factoryWipView";

const DATE = "2026-11-10T00:00:00.000Z";
const base = { date: DATE, actorId: "u1", actorName: "คุณ" };

function seed() {
  const ids = { wh: "", m: "", l: "", xl: "", w: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    const p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [], brandId: brand });
    ids.m = engine.addVariant(d, p, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    ids.l = engine.addVariant(d, p, { color: "ดำ", size: "L", purchasePrice: 400, sellingPrice: 1090 });
    ids.xl = engine.addVariant(d, p, { color: "ดำ", size: "XL", purchasePrice: 400, sellingPrice: 1090 });
    ids.w = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1090 });
  });
  return { state, ...ids };
}

const stockIn = (d: Parameters<typeof engine.stockIn>[0], wh: string, itemId: string, qty: number) =>
  engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId, qty }] });

describe("โรงงาน BC: ควรเย็บก่อน", () => {
  it("เกณฑ์: สต็อก 0 = out, 1-10 = low, 11 ขึ้นไป = ไม่แจ้ง, ไม่มีชิ้นรอเย็บ = ไม่แจ้ง", () => {
    expect(sewLevel(0, 5)).toBe("out");
    expect(sewLevel(10, 5)).toBe("low");
    expect(sewLevel(11, 5)).toBeUndefined();
    expect(sewLevel(0, 0)).toBeUndefined();
  });

  it("ช่องที่สต็อกคลัง <= 10 และมีชิ้นรอเย็บ ถูกทำเครื่องหมาย เรียงหมดก่อนใกล้หมด; ไม่ไปเปลี่ยนสต็อก", () => {
    const { state, wh, m, l, xl } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: m, qty: 20 }, { variantId: l, qty: 15 }, { variantId: xl, qty: 30 }] });
      stockIn(d, wh, l, 8); // ใกล้หมด
      stockIn(d, wh, xl, 50); // ยังพอ
    });
    const mats = wipMatrices(next);
    expect(mats[0].urgentCells).toBe(2);
    expect(mats[0].levels["ดำ"]).toEqual({ M: "out", L: "low" });
    const rows = sewFirstRows(next, mats);
    expect(rows.map((r) => [r.size, r.level, r.stock, r.wip])).toEqual([
      ["M", "out", 0, 20],
      ["L", "low", 8, 15],
    ]);
  });

  it("หมดแต่ไม่มีชิ้นตัดรอ → อยู่ในรายการ 'อาจต้องสั่งตัดเพิ่ม' ไม่อยู่ในควรเย็บ", () => {
    const { state, wh, m, xl, w } = seed();
    const next = produce(state, (d) => {
      engine.recordFactoryWip(d, { ...base, kind: "opening", lines: [{ variantId: m, qty: 20 }] });
      stockIn(d, wh, xl, 50);
    });
    const mats = wipMatrices(next);
    const cut = needCutRows(next, mats).map((r) => `${r.color}${r.size}`);
    expect(cut).toContain("ขาวM");
    expect(cut).toContain("ดำL");
    expect(cut).not.toContain("ดำXL"); // สต็อกพอ
    expect(cut).not.toContain("ดำM"); // มีชิ้นรอเย็บ อยู่ในควรเย็บแทน
    expect(w).toBeTruthy();
  });
});
