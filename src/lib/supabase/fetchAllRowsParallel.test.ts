import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, FETCH_CONCURRENCY } from "./fetch";

// จำลอง PostgREST ที่ส่ง count มากับหน้าแรกเมื่อขอ { count: "exact" } และนับจำนวนคำขอที่วิ่งพร้อมกัน
function fake(total: number, opts: { countOverride?: number; failFrom?: number } = {}) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }));
  const state = { inflight: 0, maxInflight: 0, calls: [] as { from: number; count: boolean }[] };
  const supabase = {
    from: () => {
      let wantCount = false;
      const b = {
        select: (_cols: string, o?: { count?: string }) => {
          wantCount = o?.count === "exact";
          return b;
        },
        order: () => b,
        range: async (from: number, to: number) => {
          state.calls.push({ from, count: wantCount });
          state.inflight += 1;
          state.maxInflight = Math.max(state.maxInflight, state.inflight);
          await new Promise((r) => setTimeout(r, 5));
          state.inflight -= 1;
          if (opts.failFrom !== undefined && from === opts.failFrom) return { data: null, error: { message: "boom" } };
          return { data: all.slice(from, Math.min(to, from + 999) + 1), error: null, count: wantCount ? (opts.countOverride ?? total) : null };
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { supabase, state, all };
}

describe("fetchAllRows: ดึงหน้าที่เหลือพร้อมกัน", () => {
  it("ได้ครบตามลำดับ ขอ count เฉพาะหน้าแรก และวิ่งพร้อมกันได้แต่ไม่เกินเพดาน", async () => {
    const { supabase, state, all } = fake(9500);
    const { data, error } = await fetchAllRows(supabase, "stock_movements", ["created_at", "id"]);
    expect(error).toBeNull();
    expect(data).toEqual(all);
    expect(state.calls[0]).toEqual({ from: 0, count: true });
    expect(state.calls.slice(1).every((c) => !c.count)).toBe(true);
    expect(state.maxInflight).toBeGreaterThan(1);
    expect(state.maxInflight).toBeLessThanOrEqual(FETCH_CONCURRENCY);
  });

  it("หน้าใดหน้าหนึ่ง error → คืน error ไม่คืนข้อมูลครึ่งเดียว", async () => {
    const { supabase } = fake(6000, { failFrom: 3000 });
    const { data, error } = await fetchAllRows(supabase, "stock_movements", ["id"]);
    expect(error).toEqual({ message: "boom" });
    expect(data).toEqual([]);
  });

  it("แถวเพิ่มระหว่างดึง (count เก่าน้อยกว่าจริง): ดึงต่อจนครบ ไม่ตกหล่น", async () => {
    const { supabase, all } = fake(3200, { countOverride: 2000 });
    const { data } = await fetchAllRows(supabase, "orders", ["id"]);
    expect(data).toEqual(all);
  });
});
