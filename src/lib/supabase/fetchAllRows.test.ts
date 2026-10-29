import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, fetchAppState, fetchProductImages, IMAGE_PAGE_SIZE, IMAGE_SAFE_PAGE_SIZE, type LoadProgress } from "./fetch";
import { currentSlowest } from "@/lib/store/loadStats";

// จำลอง PostgREST ที่ตัดผลลัพธ์สูงสุด 1,000 แถวต่อคำสั่ง (max-rows) และรองรับ order/range
function fakeSupabase(total: number, opts: { maxRows?: number; failAtPage?: number } = {}) {
  const maxRows = opts.maxRows ?? 1000;
  const all = Array.from({ length: total }, (_, i) => ({ id: String(i).padStart(5, "0") }));
  const calls: { from: number; to: number; order: string[] }[] = [];
  const supabase = {
    from: () => {
      const order: string[] = [];
      const builder = {
        select: () => builder,
        order: (col: string) => {
          order.push(col);
          return builder;
        },
        range: async (from: number, to: number) => {
          calls.push({ from, to, order: [...order] });
          if (opts.failAtPage !== undefined && calls.length - 1 === opts.failAtPage) return { data: null, error: { message: "boom" } };
          const end = Math.min(to, from + maxRows - 1);
          return { data: all.slice(from, end + 1), error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { supabase, calls, all };
}

describe("fetchAllRows", () => {
  it("เกิน 1,000 แถวก็ดึงมาครบ (เดิมถูกตัดที่ 1,000 ทำให้สินค้าใหม่ขึ้น 0 ตัวเลือก)", async () => {
    const { supabase, calls, all } = fakeSupabase(2345);
    const { data, error } = await fetchAllRows(supabase, "product_variants", ["id"]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2345);
    expect(data).toEqual(all);
    expect(calls.map((c) => c.from)).toEqual([0, 1000, 2000]);
    expect(calls.every((c) => c.order.join() === "id")).toBe(true);
  });

  it("จำนวนแถวพอดีกับขนาดหน้า ไม่วนไม่รู้จบ และไม่ตกหล่น", async () => {
    const { supabase, calls } = fakeSupabase(2000);
    const { data } = await fetchAllRows(supabase, "variant_stock", ["variant_id", "warehouse_id"]);
    expect(data).toHaveLength(2000);
    expect(calls).toHaveLength(3); // หน้าที่สามว่างเปล่าเป็นตัวบอกว่าจบ
    expect(calls[0].order).toEqual(["variant_id", "warehouse_id"]);
  });

  it("ตารางเล็กใช้คำสั่งเดียว", async () => {
    const { supabase, calls } = fakeSupabase(31);
    const { data } = await fetchAllRows(supabase, "products", ["id"]);
    expect(data).toHaveLength(31);
    expect(calls).toHaveLength(1);
  });

  it("เกิด error ระหว่างหน้า: คืน error ไม่คืนข้อมูลครึ่ง ๆ กลาง ๆ ไปใช้เป็นข้อมูลจริง", async () => {
    const { supabase } = fakeSupabase(2500, { failAtPage: 1 });
    const { data, error } = await fetchAllRows(supabase, "product_variants", ["id"]);
    expect(error).toEqual({ message: "boom" });
    expect(data).toEqual([]);
  });
});

describe("fetchAllRows: กรองแถวก่อนดึง", () => {
  it("ใช้ filter กับคำสั่งก่อน order/range (เช่น ดึงเฉพาะป้ายที่เคยสแกน)", async () => {
    const steps: string[] = [];
    const supabase = {
      from: () => {
        const builder: Record<string, unknown> = {
          select: () => builder,
          not: (col: string, op: string, val: unknown) => {
            steps.push(`not:${col}:${op}:${String(val)}`);
            return builder;
          },
          order: (col: string) => {
            steps.push("order:" + col);
            return builder;
          },
          range: async () => ({ data: [{ id: "a" }], error: null }),
        };
        return builder;
      },
    } as unknown as SupabaseClient;
    const { data } = await fetchAllRows(supabase, "unit_tokens", ["created_at", "id"], 1000, (q) => q.not("last_action_at", "is", null));
    expect(data).toEqual([{ id: "a" }]);
    expect(steps).toEqual(["not:last_action_at:is:null", "order:created_at", "order:id"]);
  });
});

describe("fetchProductImages: เปิดแอปไม่ต้องดึงรูปทีละ 15 แถว", () => {
  function imagesSupabase(total: number, failOnBigPage = false) {
    const pageSizes: number[] = [];
    const all = Array.from({ length: total }, (_, i) => ({ id: String(i).padStart(5, "0") }));
    const supabase = {
      from: () => {
        const builder = {
          select: () => builder,
          order: () => builder,
          range: async (from: number, to: number) => {
            const size = to - from + 1;
            pageSizes.push(size);
            if (failOnBigPage && size === IMAGE_PAGE_SIZE) return { data: null, error: { message: "statement timeout" } };
            return { data: all.slice(from, to + 1), error: null };
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;
    return { supabase, pageSizes };
  }

  it("785 รูปดึงด้วยหน้าใหญ่ แค่ 2 คำสั่ง (เดิม 53 คำสั่งต่อเนื่อง) และได้ครบ", async () => {
    const { supabase, pageSizes } = imagesSupabase(785);
    const rows = await fetchProductImages(supabase);
    expect(rows).toHaveLength(785);
    expect(pageSizes).toEqual([IMAGE_PAGE_SIZE, IMAGE_PAGE_SIZE]);
  });

  it("หน้าใหญ่ล้มเหลว (เช่น หมดเวลา) ถอยไปดึงหน้าเล็กแบบเดิมและยังได้ครบ", async () => {
    const { supabase, pageSizes } = imagesSupabase(40, true);
    const rows = await fetchProductImages(supabase);
    expect(rows).toHaveLength(40);
    expect(pageSizes[0]).toBe(IMAGE_PAGE_SIZE);
    expect(pageSizes.slice(1).every((s) => s === IMAGE_SAFE_PAGE_SIZE)).toBe(true);
  });
});
describe("fetchAppState: รายงานความคืบหน้าและตารางที่ช้าสุด", () => {
  it("แจ้งความคืบหน้าทุกตาราง จบที่ครบทุกตารางและไม่มีตารางค้าง และเก็บตารางที่ช้าสุดไว้", async () => {
    const tablesSeen: string[] = [];
    const supabase = {
      from: (table: string) => {
        tablesSeen.push(table);
        const builder: Record<string, unknown> = {
          select: () => builder,
          not: () => builder,
          order: () => builder,
          range: async () => ({ data: [], error: null }),
        };
        return builder;
      },
    } as unknown as SupabaseClient;
    const events: LoadProgress[] = [];
    await fetchAppState(supabase, (p) => events.push({ ...p, pending: [...p.pending] }));
    const last = events[events.length - 1];
    expect(last.done).toBe(last.total);
    expect(last.pending).toEqual([]);
    expect(Math.max(...events.map((e) => e.pending.length))).toBeGreaterThan(5); // เห็นว่ารอหลายตารางพร้อมกัน
    expect(new Set(tablesSeen).size).toBe(last.total); // ทุกตารางถูกนับครบ ไม่ซ้ำไม่ตก
    expect(currentSlowest().length).toBeGreaterThan(0);
    expect(currentSlowest().length).toBeLessThanOrEqual(3);
  });
});