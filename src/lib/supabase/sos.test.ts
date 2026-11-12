import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyState } from "@/lib/store/state";
import { importSosParsed } from "./sos";
import type { SosParsed } from "@/lib/utils/sosImport";

type Call = { table: string; op: string; payload?: unknown; filters: unknown[][] };

// ฐานข้อมูลจำลอง: บันทึกคำสั่งที่ส่ง และตอบข้อมูลที่กำหนดไว้ต่อ "ตาราง.คำสั่ง"
function fake(responses: Record<string, { data?: unknown; error?: { message: string } | null }> = {}) {
  const calls: Call[] = [];
  const supabase = {
    from(table: string) {
      const make = (op: string) => (payload?: unknown) => {
        const call: Call = { table, op, payload, filters: [] };
        calls.push(call);
        const chain: Record<string, unknown> = {};
        for (const f of ["eq", "select", "in", "is"]) chain[f] = (...a: unknown[]) => (call.filters.push([f, ...a]), chain);
        chain.single = () => chain;
        chain.then = (resolve: (r: unknown) => unknown) => {
          const r = responses[`${table}.${op}`] ?? {};
          return Promise.resolve(resolve({ data: r.data ?? null, error: r.error ?? null }));
        };
        return chain;
      };
      return { select: make("select"), insert: make("insert"), update: make("update"), delete: make("delete"), upsert: make("upsert") };
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

const parsed: SosParsed = {
  branchName: "SOS TEST",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  stockAsOf: "2026-10-01",
  sales: [
    { section: "main", code: "C1", description: "Billie Slim ทรงกระบอกเล็ก black M", qty: 2, unitPrice: 690, gross: 1380, discount: 0, net: 1380 },
    { section: "main", code: "C2", description: "สูท Classy Blazer black M", qty: 1, unitPrice: 1290, gross: 1290, discount: 0, net: 1290 },
    { section: "main", code: "C3", description: "EMS Issa อื่นๆ", qty: 1, unitPrice: 50, gross: 50, discount: 0, net: 50 },
    { section: "credit", code: "C4", description: "Billie Slim ทรงกระบอกเล็ก black M", qty: 3, unitPrice: 690, gross: 2070, discount: 0, net: 2070 },
  ],
  stock: [{ code: "C1", description: "Billie Slim ทรงกระบอกเล็ก black M", qty: 4 }],
  summary: { salesTotal: 2720, gp: 136, afterGp: 2584, otherFees: 50, received: 2534, wht: 10, receivedInclVat: 2544, vat: 0, receivedExVat: 2544 },
  warnings: [],
};

const state = () =>
  ({
    ...emptyState(),
    products: { p1: { id: "p1", sellingName: "Billie Slim", status: "active", images: [] } },
    variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "A", active: true } },
  }) as never;

const ctx = (replace = false) => ({ state: state(), fileName: "Bill-1.xls", userId: "u1", userName: "แอดมิน", codeMap: {}, replace });

describe("นำเข้าไฟล์ SOS ลงฐานข้อมูล", () => {
  it("สร้างสาขา รายการนำเข้า สรุป (ต้นทุน 200/ชิ้น สูท 400 ค่าส่ง 0) รายการขาย สต็อก และจำจับคู่", async () => {
    const { supabase, calls } = fake({
      "sos_branches.select": { data: [] },
      "sos_branches.insert": { data: { id: "b1" } },
      "sos_imports.select": { data: [] },
      "sos_imports.insert": { data: { id: "i1" } },
    });
    const res = await importSosParsed(supabase, parsed, ctx());
    expect(res).toMatchObject({ importId: "i1", salesLines: 4, stockLines: 1, mapped: 2, unmapped: 2, replaced: false });
    const sum = calls.find((c) => c.table === "sos_summaries")!.payload as Record<string, unknown>;
    expect(sum).toMatchObject({ import_id: "i1", main_qty: 4, main_net: 2720, credit_qty: 3, credit_net: 2070, received_ex_vat: 2544, gp: 136 });
    expect(sum.main_cogs).toBe(2 * 200 + 400 + 0);
    const lines = calls.find((c) => c.table === "sos_sales_lines")!.payload as Record<string, unknown>[];
    expect(lines.map((l) => [l.section, l.variant_id])).toEqual([["main", "v1"], ["main", null], ["main", null], ["credit", "v1"]]);
    expect(calls.some((c) => c.table === "sos_code_map" && c.op === "upsert")).toBe(true);
    expect(calls.some((c) => ["variant_stock", "stock_movements", "unit_tokens"].includes(c.table))).toBe(false); // ไม่แตะสต็อกคลังหลัก
  });

  it("งวดเดียวกันนำเข้าไปแล้ว: ไม่ยอมนำเข้าซ้ำถ้าไม่สั่งแทนที่ และแทนที่ได้เมื่อสั่ง", async () => {
    const base = { "sos_branches.select": { data: [{ id: "b1" }] }, "sos_imports.select": { data: [{ id: "old" }] }, "sos_imports.insert": { data: { id: "i2" } } };
    const { supabase: s1, calls: c1 } = fake(base);
    await expect(importSosParsed(s1, parsed, ctx(false))).rejects.toThrow(/นำเข้า.*ไปแล้ว/);
    expect(c1.some((c) => c.op === "insert")).toBe(false);
    const { supabase: s2, calls: c2 } = fake(base);
    const res = await importSosParsed(s2, parsed, ctx(true));
    expect(res.replaced).toBe(true);
    expect(c2.find((c) => c.table === "sos_imports" && c.op === "delete")!.filters).toContainEqual(["eq", "id", "old"]);
  });

  it("ขั้นใดล้ม: ลบรายการนำเข้าที่ค้างครึ่งทาง (cascade) แล้วแจ้งข้อผิดพลาด", async () => {
    const { supabase, calls } = fake({
      "sos_branches.select": { data: [{ id: "b1" }] },
      "sos_imports.select": { data: [] },
      "sos_imports.insert": { data: { id: "i3" } },
      "sos_sales_lines.insert": { error: { message: "boom" } },
    });
    await expect(importSosParsed(supabase, parsed, ctx())).rejects.toThrow("boom");
    const del = calls.filter((c) => c.table === "sos_imports" && c.op === "delete");
    expect(del).toHaveLength(1);
    expect(del[0].filters).toContainEqual(["eq", "id", "i3"]);
  });
});
