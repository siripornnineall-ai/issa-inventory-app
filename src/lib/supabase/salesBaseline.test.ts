import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBaseline } from "./salesBaseline";

// จำลองฐานข้อมูลที่ตอบสูงสุด 1,000 แถวต่อคำขอ เหมือน PostgREST
function fakeClient(total: number): SupabaseClient {
  const all = Array.from({ length: total }, (_, i) => ({ month: `2026-${String((i % 9) + 1).padStart(2, "0")}-01`, product_id: "p", color: "c" + i, size: "M", qty: 1 }));
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.order = () => q;
  q.range = (a: number, b: number) => Promise.resolve({ data: all.slice(a, b + 1), error: null });
  return { from: () => q } as unknown as SupabaseClient;
}

describe("loadBaseline", () => {
  it("ดึงครบทุกหน้า ไม่ตัดที่ 1,000 แถว", async () => {
    const r = await loadBaseline(fakeClient(2166));
    expect(r.rows).toHaveLength(2166);
    expect(r.months).toHaveLength(9);
  });
});
