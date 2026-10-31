import { describe, it, expect } from "vitest";
import { produce } from "immer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncStateDiff } from "./sync";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

type Call = { table: string; op: string; payload: unknown; options?: unknown };

function fakeSupabase() {
  const calls: Call[] = [];
  const supabase = {
    from(table: string) {
      const make = (op: string) => (payload: unknown, options?: unknown) => {
        calls.push({ table, op, payload, options });
        const res = { data: null, error: null, status: 200, statusText: "OK", count: null };
        const chain = {
          eq: () => chain,
          select: () => chain,
          then: (resolve: (r: typeof res) => unknown) => Promise.resolve(resolve(res)),
        };
        return chain;
      };
      return { insert: make("insert"), update: make("update"), upsert: make("upsert"), delete: make("delete") };
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

function setup() {
  let wh = "";
  let variant = "";
  const base = produce(emptyState(), (d) => {
    wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const p = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1000, category: "กางเกงขายาว", status: "active", images: [] });
    variant = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
  });
  return { base, wh, variant };
}

describe("ยอดสต็อกให้ฐานข้อมูลคิดเอง (แอปไม่ส่งยอดทั้งก้อน)", () => {
  it("รับเข้า/ขายออก: ส่งแค่รายการเคลื่อนไหว ไม่มีการเขียน variant_stock ที่มี qty_on_hand", async () => {
    const { base, wh, variant } = setup();
    const received = produce(base, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: variant, qty: 10 }] });
    });
    const sold = produce(received, (d) => {
      engine.stockOut(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: variant, qty: 4 }] });
    });

    const a = fakeSupabase();
    await syncStateDiff(a.supabase, received, sold);
    expect(a.calls.filter((c) => c.table === "stock_movements" && c.op === "insert")).toHaveLength(1);
    expect(a.calls.some((c) => c.table === "variant_stock")).toBe(false);

    // ไม่ว่าครั้งไหน ไม่มีคำขอไหนมี qty_on_hand
    const b = fakeSupabase();
    await syncStateDiff(b.supabase, base, received);
    for (const c of b.calls.filter((x) => x.table === "variant_stock" || x.table === "equipment_stock")) {
      expect(JSON.stringify(c.payload)).not.toContain("qty_on_hand");
    }
  });

  it("แถวสต็อกใหม่: ส่งแบบข้ามถ้ามีแถวอยู่แล้ว (ไม่ทับยอดที่ฐานข้อมูลคิดไว้)", async () => {
    const { base, wh, variant } = setup();
    const received = produce(base, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: variant, qty: 10 }] });
    });
    // เทียบกับ state ที่ยังไม่มีแถวสต็อกของตัวเลือกนี้เลย
    const withoutRow = produce(base, (d) => {
      delete d.variantStock[`${variant}::${wh}`];
    });
    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, withoutRow, received);
    const row = calls.find((c) => c.table === "variant_stock");
    expect(row?.op).toBe("upsert");
    expect(row?.payload).toEqual({ variant_id: variant, warehouse_id: wh });
    expect(row?.options).toMatchObject({ ignoreDuplicates: true });
  });

  it("ยอดจอง (qty_reserved) เปลี่ยน: ส่งเฉพาะยอดจอง ไม่ส่งยอดคงเหลือ", async () => {
    const { base, wh, variant } = setup();
    const stocked = produce(base, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: variant, qty: 10 }] });
    });
    const reserved = produce(stocked, (d) => {
      d.variantStock[`${variant}::${wh}`].qtyReserved = 3;
    });
    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, stocked, reserved);
    const row = calls.find((c) => c.table === "variant_stock");
    expect(row?.payload).toEqual({ variant_id: variant, warehouse_id: wh, qty_reserved: 3 });
  });

  it("อุปกรณ์: แถวใหม่ส่งแบบข้ามถ้าซ้ำ และไม่ส่งยอดคงเหลือ", async () => {
    let wh = "";
    let eq = "";
    const base = produce(emptyState(), (d) => {
      wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    });
    const created = produce(base, (d) => {
      eq = engine.createEquipment(d, { name: "กรรไกร", code: "EQ-1", type: "tool", purchasePricePerUnit: 10, unit: "อัน", reorderPoint: 1, reorderQty: 2, status: "active", images: [] } as never);
    });
    const received = produce(created, (d) => {
      engine.stockIn(d, { itemType: "equipment", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: eq, qty: 5 }] });
    });
    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, base, received);
    for (const c of calls.filter((x) => x.table === "equipment_stock")) {
      expect(JSON.stringify(c.payload)).not.toContain("qty_on_hand");
    }
  });
});
