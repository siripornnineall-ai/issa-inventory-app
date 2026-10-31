import { describe, it, expect } from "vitest";
import { produce } from "immer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncStateDiff } from "./sync";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

type Call = { table: string; op: string; payload: unknown; eq?: [string, unknown] };

// supabase จำลอง: จดว่าเขียนตารางไหนด้วยอะไร และตอบสำเร็จเสมอ
function fakeSupabase() {
  const calls: Call[] = [];
  const supabase = {
    from(table: string) {
      const make = (op: string) => (payload: unknown) => {
        const call: Call = { table, op, payload };
        calls.push(call);
        const res = { data: null, error: null, status: 200, statusText: "OK", count: null };
        const chain = {
          eq(col: string, val: unknown) {
            call.eq = [col, val];
            return chain;
          },
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

describe("ซิงก์การยกเลิกใบรับเข้า ลงฐานข้อมูล", () => {
  it("ใบที่ยกเลิกถูก update สถานะ+เหตุผล, รายการหักคืนถูก insert, และแอปไม่เขียนยอดสต็อกเอง", async () => {
    let wh = "";
    let item = "";
    let docId = "";
    const received = produce(emptyState(), (d) => {
      wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
      const p = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1090, category: "กางเกงขายาว", status: "active", images: [] });
      item = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1090 });
      docId = engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: item, qty: 15 }] }).id;
    });
    const cancelled = produce(received, (d) => {
      engine.cancelStockIns(d, [docId], "รับเข้าผิดรุ่น", "u2", "Su");
    });

    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, received, cancelled);

    const docUpdate = calls.find((c) => c.table === "stock_in_docs" && c.op === "update");
    expect(docUpdate?.eq).toEqual(["id", docId]);
    expect(docUpdate?.payload).toMatchObject({ status: "cancelled", cancel_reason: "รับเข้าผิดรุ่น", cancelled_by_name: "Su" });
    expect((docUpdate?.payload as { cancelled_at: string }).cancelled_at).toBeTruthy();

    const reversal = calls.find((c) => c.table === "stock_movements" && c.op === "insert");
    expect(JSON.stringify(reversal?.payload)).toContain("cancel_stock_in");
    expect(JSON.stringify(reversal?.payload)).toContain("-15");

    // ยอดคงเหลือฐานข้อมูลหักเองจากรายการหักคืนข้างบน (trigger) แอปไม่ส่งยอดทั้งก้อนอีก
    expect(calls.some((c) => c.table === "variant_stock")).toBe(false);
  });

  it("ออเดอร์ใหม่เก็บเลขที่ใบเบิกออก และยกเลิกแบบไม่คืนสต็อก: update สถานะยกเลิก restocked=false โดยไม่มีรายการคืนสต็อกหรือแก้สต็อก", async () => {
    let orderId = "";
    let docNo = "";
    const sold = produce(emptyState(), (d) => {
      const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
      const p = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1000, category: "กางเกงขายาว", status: "active", images: [] });
      const v = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: v, qty: 10 }] });
      const res = engine.stockOut(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: v, qty: 4 }] });
      orderId = res.order!.id;
      docNo = res.doc.docNo;
    });
    const created = fakeSupabase();
    await syncStateDiff(created.supabase, emptyState(), sold);
    const orderInsert = created.calls.find((c) => c.table === "orders" && c.op === "insert");
    expect((orderInsert?.payload as { stock_out_doc_no: string }).stock_out_doc_no).toBe(docNo);

    const voided = produce(sold, (d) => {
      engine.cancelOrder(d, orderId, "ลงผิดรุ่น", "u9", "แอดมิน", { restock: false });
    });
    const { supabase, calls } = fakeSupabase();
    await syncStateDiff(supabase, sold, voided);
    const upd = calls.find((c) => c.table === "orders" && c.op === "update");
    expect(upd?.eq).toEqual(["id", orderId]);
    expect(upd?.payload).toMatchObject({ status: "cancelled", cancel_reason: "ลงผิดรุ่น", restocked: false });
    expect(calls.some((c) => c.table === "stock_movements")).toBe(false);
    expect(calls.some((c) => c.table === "variant_stock")).toBe(false);
  });
});
