import { describe, it, expect } from "vitest";
import { produce } from "immer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyState } from "./state";
import * as engine from "./engine";
import { sparseChange } from "./syncStatus";
import { syncStateDiff } from "@/lib/supabase/sync";

function fakeSupabase() {
  const calls: { table: string; op: string; payload: unknown }[] = [];
  const supabase = {
    from(table: string) {
      const make = (op: string) => (payload: unknown) => {
        calls.push({ table, op, payload });
        const res = { data: null, error: null, status: 200, statusText: "OK", count: null };
        const chain = { eq: () => chain, select: () => chain, then: (resolve: (r: typeof res) => unknown) => Promise.resolve(resolve(res)) };
        return chain;
      };
      return { insert: make("insert"), update: make("update"), upsert: make("upsert"), delete: make("delete") };
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

const DATE = new Date().toISOString();

function base() {
  const ids = { wh: "", v1: "", v2: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const p = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1000, category: "กางเกง", status: "active", images: [] });
    ids.v1 = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    ids.v2 = engine.addVariant(d, p, { color: "ดำ", size: "L", purchasePrice: 400, sellingPrice: 1000 });
    engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.v1, qty: 10 }, { itemId: ids.v2, qty: 5 }] });
  });
  return { state, ...ids };
}

describe("sparseChange (เก็บเฉพาะส่วนที่เปลี่ยน)", () => {
  it("มีเฉพาะระเบียนที่เปลี่ยน ไม่ลากทั้ง state ไปเก็บ", () => {
    const { state, wh, v1 } = base();
    const next = produce(state, (d) => {
      engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: v1, qty: 2 }] });
    });
    const s = sparseChange(state, next);
    expect(Object.keys(s.next.products)).toHaveLength(0);
    expect(Object.keys(s.next.variants)).toHaveLength(0);
    expect(Object.keys(s.next.stockOutDocs)).toHaveLength(1);
    expect(Object.keys(s.next.orders)).toHaveLength(1);
    expect(Object.keys(s.next.variantStock)).toHaveLength(1); // ตัวเลือกเดียวที่สต็อกเปลี่ยน
    expect(Object.keys(s.prev.variantStock)).toHaveLength(1);
    expect(Object.keys(s.prev.stockOutDocs)).toHaveLength(0); // ของใหม่ ไม่มีในฝั่งก่อน
    // ขนาดคงที่เล็ก (ค่าตั้งต้นของ state ว่าง + ระเบียนที่เปลี่ยน) ไม่โตตามขนาดข้อมูลทั้งระบบ (หลาย MB)
    expect(JSON.stringify(s).length).toBeLessThan(20000);
  });

  it("ส่งจาก sparse ได้ผลเขียนฐานข้อมูลเหมือนส่งจาก state ทั้งก้อนทุกประการ (รับเข้า ขาย ยกเลิก)", async () => {
    const { state, wh, v1, v2 } = base();
    const steps: ((d: Parameters<typeof engine.stockIn>[0]) => void)[] = [
      (d) => { engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: v2, qty: 4, unitCost: 300 }], note: "ทดสอบ" }); },
      (d) => { engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: v1, qty: 3 }] }); },
      (d) => { engine.stockReturn(d, { date: DATE, warehouseId: wh, returnType: "return_customer", receivedBy: "u1", receivedByName: "คืน", lines: [{ itemId: v1, qty: 1, unitPrice: 990, reason: "size", tags: ["เล็กไป"] }] }); },
    ];
    for (const step of steps) {
      const next = produce(state, step);
      const full = fakeSupabase();
      await syncStateDiff(full.supabase, state, next);
      const sparse = sparseChange(state, next);
      const part = fakeSupabase();
      await syncStateDiff(part.supabase, JSON.parse(JSON.stringify(sparse.prev)), JSON.parse(JSON.stringify(sparse.next)));
      expect(part.calls.length).toBeGreaterThan(0);
      const norm = (calls: typeof full.calls) => JSON.stringify(calls.map((c) => [c.table, c.op, c.payload]).sort());
      expect(norm(part.calls)).toBe(norm(full.calls));
    }
  });
});
