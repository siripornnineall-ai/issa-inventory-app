import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "./fetch";

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
