import { describe, it, expect } from "vitest";
import { produce } from "immer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncStateDiff, SYNC_RETRY_DELAYS_MS } from "./sync";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

SYNC_RETRY_DELAYS_MS.splice(0);

type Call = { table: string; op: string; payload: unknown };

// supabase จำลอง: ตารางที่ระบุ มีเลขที่ถูกใช้ไปแล้วโดยอีกเครื่อง (ใบใหม่ที่ใช้เลขนั้นจะชน) และตอบเลขสูงสุดตอนถามหาเลขใหม่
function fakeSupabase(taken: Record<string, { column: string; used: Set<string>; max: string; existingId?: string }>) {
  const calls: Call[] = [];
  const supabase = {
    from(table: string) {
      const spec = taken[table];
      const make = (op: string) => (payload: unknown) => {
        calls.push({ table, op, payload });
        let res: { data: unknown; error: unknown; status: number } = { data: null, error: null, status: 200 };
        if (op === "insert" && spec && !Array.isArray(payload)) {
          const no = (payload as Record<string, string>)[spec.column];
          if (spec.used.has(no)) {
            res = { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${table}_${spec.column}_key"`, details: `Key (${spec.column})=(${no}) already exists.` }, status: 409 };
          } else {
            spec.used.add(no);
          }
        }
        const chain: Record<string, unknown> = {
          eq: () => chain,
          select: () => chain,
          then: (resolve: (r: unknown) => unknown) => Promise.resolve(resolve(res)),
        };
        return chain;
      };
      const select = () => {
        const q: Record<string, unknown> = {
          like: () => q,
          order: () => q,
          eq: () => q,
          limit: () => q,
          then: (resolve: (r: unknown) => unknown) => {
            // ถามหาเลขสูงสุด (like/order) → ตอบ max, ถามด้วย eq → ตอบใบที่มีอยู่
            const data = spec?.existingId ? [{ id: spec.existingId }] : spec ? [{ [spec.column]: spec.max }] : [];
            return Promise.resolve(resolve({ data, error: null, status: 200 }));
          },
        };
        return q;
      };
      return { insert: make("insert"), update: make("update"), upsert: make("upsert"), delete: make("delete"), select };
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

function base() {
  let wh = "";
  let variant = "";
  const state = produce(emptyState(), (d) => {
    wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const p = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    variant = engine.addVariant(d, p, { color: "ดำ", size: "M", purchasePrice: 200, sellingPrice: 1090 });
    d.docSeq.SIN = 705;
    d.docSeq.SOUT = 627;
    d.docSeq.ORD = 623;
  });
  return { state, wh, variant };
}

describe("เลขที่เอกสารชนกับอีกเครื่อง: ออกเลขใหม่ให้ ใบไม่หาย", () => {
  it("ใบรับเข้า: เลขชน → ออกเลขถัดไปที่ว่าง บันทึกรายการสินค้าใต้เลขใหม่ และรายการเคลื่อนไหวอ้างเลขใหม่", async () => {
    const { state, wh, variant } = base();
    const received = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "Su", lines: [{ itemId: variant, qty: 19, unitCost: 250 }] });
    });
    const oldNo = Object.values(received.stockInDocs)[0].docNo; // SIN-<วันนี้>-0706
    const dateNo = oldNo.slice(4, 12);
    const { supabase, calls } = fakeSupabase({ stock_in_docs: { column: "doc_no", used: new Set([oldNo]), max: `SIN-${dateNo}-0710` } });

    await syncStateDiff(supabase, state, received);

    const inserts = calls.filter((c) => c.table === "stock_in_docs" && c.op === "insert");
    expect(inserts).toHaveLength(2);
    expect((inserts[0].payload as { doc_no: string }).doc_no).toBe(oldNo);
    expect((inserts[1].payload as { doc_no: string }).doc_no).toBe(`SIN-${dateNo}-0711`);
    // รายการสินค้าของใบถูกบันทึก (เดิมหายไป)
    expect(calls.some((c) => c.table === "stock_in_lines" && c.op === "insert")).toBe(true);
    // รายการเคลื่อนไหวอ้างเลขใหม่ ไม่ใช่เลขเดิมที่เป็นของใบอื่น
    const mov = calls.find((c) => c.table === "stock_movements" && c.op === "insert");
    const rows = (Array.isArray(mov?.payload) ? mov?.payload : [mov?.payload]) as { ref_no: string; related_doc_no: string }[];
    expect(rows[0].ref_no).toBe(`SIN-${dateNo}-0711`);
    expect(rows[0].related_doc_no).toBe(`SIN-${dateNo}-0711`);
  });

  it("ขายออก: ใบเบิกชนเลข → ออเดอร์เก็บเลขใบเบิกใหม่ และรายการเคลื่อนไหวอ้างเลขใหม่ เรียงใบก่อนรายการเคลื่อนไหว", async () => {
    const { state, wh, variant } = base();
    const stocked = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: variant, qty: 10 }] });
    });
    const sold = produce(stocked, (d) => {
      engine.stockOut(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: variant, qty: 2 }] });
    });
    const out = Object.values(sold.stockOutDocs)[0];
    const order = Object.values(sold.orders)[0];
    const dateNo = out.docNo.slice(5, 13);
    const { supabase, calls } = fakeSupabase({
      stock_out_docs: { column: "doc_no", used: new Set([out.docNo]), max: `SOUT-${dateNo}-0630` },
      orders: { column: "order_no", used: new Set([order.orderNo]), max: `ORD-${dateNo}-0640` },
    });

    await syncStateDiff(supabase, stocked, sold);

    const newDocNo = `SOUT-${dateNo}-0631`;
    const orderInserts = calls.filter((c) => c.table === "orders" && c.op === "insert");
    expect(orderInserts).toHaveLength(2); // ออเดอร์เลขชนด้วย ออกเลขใหม่
    const finalOrder = orderInserts[1].payload as { order_no: string; stock_out_doc_no: string };
    expect(finalOrder.order_no).toBe(`ORD-${dateNo}-0641`);
    expect(finalOrder.stock_out_doc_no).toBe(newDocNo);
    expect(calls.some((c) => c.table === "order_lines" && c.op === "insert")).toBe(true);
    expect(calls.some((c) => c.table === "stock_out_lines" && c.op === "insert")).toBe(true);

    const mov = calls.find((c) => c.table === "stock_movements" && c.op === "insert");
    const rows = (Array.isArray(mov?.payload) ? mov?.payload : [mov?.payload]) as { ref_no: string; related_doc_no: string }[];
    expect(rows.every((r) => r.ref_no === newDocNo && r.related_doc_no === newDocNo)).toBe(true);
    // ลำดับ: ใบเบิกต้องบันทึกสำเร็จก่อนรายการเคลื่อนไหวและออเดอร์
    const idxDoc = calls.map((c) => `${c.table}:${c.op}`).lastIndexOf("stock_out_docs:insert");
    const idxMov = calls.findIndex((c) => c.table === "stock_movements");
    const idxOrder = calls.findIndex((c) => c.table === "orders");
    expect(idxDoc).toBeLessThan(idxMov);
    expect(idxDoc).toBeLessThan(idxOrder);
  });

  it("ไม่ชนเลข: ใช้เลขเดิมทุกอย่าง ไม่มีการถามหาเลขใหม่", async () => {
    const { state, wh, variant } = base();
    const received = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: variant, qty: 3 }] });
    });
    const oldNo = Object.values(received.stockInDocs)[0].docNo;
    const { supabase, calls } = fakeSupabase({ stock_in_docs: { column: "doc_no", used: new Set(), max: "x" } });
    await syncStateDiff(supabase, state, received);
    expect(calls.filter((c) => c.table === "stock_in_docs" && c.op === "insert")).toHaveLength(1);
    const mov = calls.find((c) => c.table === "stock_movements" && c.op === "insert");
    const rows = (Array.isArray(mov?.payload) ? mov?.payload : [mov?.payload]) as { ref_no: string }[];
    expect(rows[0].ref_no).toBe(oldNo);
  });

  it("รอบส่งซ้ำ: เลขที่ชนคือใบเดียวกันที่บันทึกไปแล้ว (id ตรงกัน) นับว่าสำเร็จ ไม่ออกเลขใหม่ ไม่เกิดใบซ้ำ", async () => {
    const { state, wh, variant } = base();
    const received = produce(state, (d) => {
      engine.stockIn(d, { itemType: "product", date: new Date().toISOString(), warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: variant, qty: 3 }] });
    });
    const doc = Object.values(received.stockInDocs)[0];
    const { supabase, calls } = fakeSupabase({ stock_in_docs: { column: "doc_no", used: new Set([doc.docNo]), max: "x", existingId: doc.id } });
    await syncStateDiff(supabase, state, received, { retry: true });
    expect(calls.filter((c) => c.table === "stock_in_docs" && c.op === "insert")).toHaveLength(1); // ไม่ลองเลขใหม่
  });
});
