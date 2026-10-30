import { describe, it, expect } from "vitest";
import { produce } from "immer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncStateDiff } from "./sync";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

type Call = { table: string; op: string; payload: unknown };

function fakeSupabase() {
  const calls: Call[] = [];
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

describe("ซิงก์ใบรับคืน: เหตุผล ราคา และเปลี่ยนเป็น", () => {
  it("บรรทัดของใบรับคืนเขียนเหตุผล คำที่ลูกค้าพูด ราคาต่อชิ้น และสินค้าที่เปลี่ยนเป็นลงฐานข้อมูล", async () => {
    let from = "";
    let to = "";
    const next = produce(emptyState(), (d) => {
      const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
      const p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
      from = engine.addVariant(d, p, { color: "ดำ", size: "XL", purchasePrice: 400, sellingPrice: 1090 });
      to = engine.addVariant(d, p, { color: "ขาว", size: "XL", purchasePrice: 400, sellingPrice: 1090 });
      engine.stockReturn(d, { date: new Date().toISOString(), warehouseId: wh, returnType: "return_exchange", receivedBy: "u1", receivedByName: "คืน", lines: [{ itemId: from, qty: 2, unitPrice: 990, reason: "size", tags: ["เล็กไป"], exchangeToId: to }] });
    });
    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, emptyState(), next);
    const lines = calls.find((c) => c.table === "stock_in_lines" && c.op === "insert");
    const row = (lines?.payload as Record<string, unknown>[])[0];
    expect(row).toMatchObject({ item_id: from, qty: 2, unit_price: 990, return_reason: "size", return_tags: ["เล็กไป"], exchange_to_variant_id: to });
  });
});
