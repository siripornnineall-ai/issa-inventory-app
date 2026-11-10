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
        const chain = { eq: () => chain, select: () => chain, then: (resolve: (r: typeof res) => unknown) => Promise.resolve(resolve(res)) };
        return chain;
      };
      return { insert: make("insert"), update: make("update"), upsert: make("upsert"), delete: make("delete") };
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

describe("ซิงก์โรงงาน BC", () => {
  it("บันทึกตัวที่ยังไม่เย็บส่งเป็นคำสั่งเดียว ข้ามแถวที่มีอยู่แล้ว และไม่แตะตารางสต็อก", async () => {
    const prev = produce(emptyState(), (d) => {
      const p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
      engine.addVariant(d, p, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
      engine.addVariant(d, p, { color: "ดำ", size: "L", purchasePrice: 400, sellingPrice: 1090 });
    });
    const [m, l] = Object.keys(prev.variants);
    const next = produce(prev, (d) => {
      engine.recordFactoryWip(d, { kind: "scrap", date: "2026-11-10T00:00:00.000Z", note: "ผ้าขาด", actorId: undefined, actorName: "คุณ", lines: [{ variantId: m, qty: 5 }, { variantId: l, qty: 2 }] });
    });
    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, prev, next);
    const wip = calls.filter((c) => c.table === "factory_wip_entries");
    expect(wip).toHaveLength(1);
    expect(wip[0].op).toBe("upsert");
    expect(wip[0].options).toMatchObject({ onConflict: "id", ignoreDuplicates: true });
    const rows = wip[0].payload as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "scrap", qty_change: -5, entry_date: "2026-11-10", note: "ผ้าขาด", actor_name: "คุณ", variant_id: m });
    expect(rows[0].batch_id).toBe(rows[1].batch_id);
    expect(calls.some((c) => c.table === "variant_stock" || c.table === "stock_movements")).toBe(false);
  });

  it("ใบรับเข้าแบบเย็บเสร็จส่ง from_wip เฉพาะเมื่อเป็นแบบนี้ (ใบปกติไม่ส่งคอลัมน์ใหม่)", async () => {
    const wh = { id: "" };
    const prev = produce(emptyState(), (d) => {
      wh.id = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
      const p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
      engine.addVariant(d, p, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1090 });
    });
    const v = Object.keys(prev.variants)[0];
    const run = async (fromWip: boolean) => {
      const next = produce(prev, (d) => {
        engine.stockIn(d, { itemType: "product", date: "2026-11-10T00:00:00.000Z", warehouseId: wh.id, receivedBy: "u1", receivedByName: "รับ", fromWip, lines: [{ itemId: v, qty: 3 }] });
      });
      const { supabase, calls } = fakeSupabase();
      await syncStateDiff(supabase, prev, next);
      return (calls.find((c) => c.table === "stock_in_lines" && c.op === "insert")!.payload as Record<string, unknown>[])[0];
    };
    expect(await run(true)).toMatchObject({ from_wip: true, qty: 3 });
    expect(await run(false)).not.toHaveProperty("from_wip");
  });
});
