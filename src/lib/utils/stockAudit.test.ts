import { describe, it, expect } from "vitest";
import { emptyState } from "@/lib/store/state";
import { findStockMismatches } from "./stockAudit";
import type { StockMovement } from "@/lib/types";

function mv(p: Partial<StockMovement> & { id: string }): StockMovement {
  return {
    createdAt: "2026-10-09T11:00:00.000Z",
    refNo: p.id,
    itemType: "product",
    itemId: "v1",
    itemName: "x",
    sku: "x",
    movementType: "adjustment",
    qtyChange: 1,
    qtyBefore: 0,
    qtyAfter: 1,
    warehouseToId: "w1",
    actorId: "u",
    actorName: "u",
    ...p,
  } as StockMovement;
}

function stateWith(movements: StockMovement[], stock: Record<string, number>) {
  const s = emptyState();
  s.movements = Object.fromEntries(movements.map((m) => [m.id, m]));
  s.variantStock = Object.fromEntries(Object.entries(stock).map(([k, q]) => [k, { itemId: k.split("::")[0], warehouseId: k.split("::")[1], qtyOnHand: q, qtyReserved: 0 }]));
  return s;
}

describe("findStockMismatches", () => {
  it("ยอดตรงกับบรรทัดสุดท้ายในประวัติ ไม่แจ้ง", () => {
    expect(findStockMismatches(stateWith([mv({ id: "a" })], { "v1::w1": 1 }))).toEqual([]);
  });

  it("ประวัติบอก 1 แต่ยอดคงเหลือเป็น 0 (กรณี Flow Wide ครีม S) แจ้งพร้อมยอดที่ควรเป็น", () => {
    const res = findStockMismatches(stateWith([mv({ id: "a" })], { "v1::w1": 0 }));
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ itemId: "v1", warehouseId: "w1", recorded: 1, actual: 0 });
  });

  it("ดูเฉพาะบรรทัดสุดท้ายของรายการ: ผ่านหลายบรรทัดแล้วยอดตรงตัวสุดท้าย ไม่แจ้ง", () => {
    const list = [
      mv({ id: "a", createdAt: "2026-10-09T10:00:00.000Z", qtyAfter: 5 }),
      mv({ id: "b", createdAt: "2026-10-09T12:00:00.000Z", movementType: "sale", warehouseToId: undefined, warehouseFromId: "w1", qtyChange: -2, qtyBefore: 5, qtyAfter: 3 }),
    ];
    expect(findStockMismatches(stateWith(list, { "v1::w1": 3 }))).toEqual([]);
    expect(findStockMismatches(stateWith(list, { "v1::w1": 5 }))).toHaveLength(1);
  });

  it("กรองตามวันที่: ข้ามรายการที่เคลื่อนไหวล่าสุดก่อนวันที่กำหนด (ข้อมูลช่วงทดลอง)", () => {
    const old = mv({ id: "o", createdAt: "2026-08-04T00:00:00.000Z", itemId: "v2", qtyAfter: 10 });
    const st = stateWith([old], { "v2::w1": 0 });
    expect(findStockMismatches(st)).toHaveLength(1);
    expect(findStockMismatches(st, { sinceISO: "2026-10-08T17:00:00.000Z" })).toEqual([]);
  });
});
