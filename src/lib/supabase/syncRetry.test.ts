import { describe, it, expect } from "vitest";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { check } from "./sync";

type Res = PostgrestSingleResponse<unknown>;
const ok = (data: unknown = null): Res => ({ data, error: null, status: 200, statusText: "OK", count: null }) as Res;
const fail = (message: string, code: string, status: number): Res =>
  ({ data: null, error: { message, code, details: "", hint: "", name: "PostgrestError" }, status, statusText: "", count: null }) as unknown as Res;

// builder จำลอง: ทุกครั้งที่ await จะส่งคำขอใหม่ ตอบตามลำดับที่กำหนด (เหมือน supabase-js)
function builder(responses: Res[]) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    then<T>(resolve: (r: Res) => T) {
      const r = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      return Promise.resolve(resolve(r));
    },
  } as unknown as PromiseLike<Res> & { calls: number };
}

describe("sync check (ลองซ้ำเมื่อเน็ตหลุด)", () => {
  it("ส่งครั้งเดียวสำเร็จ ไม่ลองซ้ำ", async () => {
    const b = builder([ok("x")]);
    expect(await check(b, [0, 0])).toBe("x");
    expect(b.calls).toBe(1);
  });

  it("เน็ตหลุด (ไม่มีรหัสผิดพลาด) แล้วรอบสองสำเร็จ → สำเร็จ ไม่ทำให้ยอด/ประวัติหายเงียบ ๆ", async () => {
    const b = builder([fail("TypeError: Failed to fetch", "", 0), ok("saved")]);
    expect(await check(b, [0, 0])).toBe("saved");
    expect(b.calls).toBe(2);
  });

  it("เซิร์ฟเวอร์ 503 ลองซ้ำจนครบ แล้วจึงแจ้งผิดพลาด", async () => {
    const b = builder([fail("unavailable", "", 503)]);
    await expect(check(b, [0, 0])).rejects.toThrow("unavailable");
    expect(b.calls).toBe(3);
  });

  it("ข้อผิดพลาดเชิงข้อมูล (SKU ซ้ำ 23505 ในรอบแรก) ไม่ลองซ้ำ และต้องแจ้งผิดพลาด", async () => {
    const b = builder([fail("duplicate key", "23505", 409)]);
    await expect(check(b, [0, 0])).rejects.toThrow("duplicate key");
    expect(b.calls).toBe(1);
  });

  it("รอบแรกหลุดแต่เซิร์ฟเวอร์บันทึกไปแล้ว รอบลองซ้ำชนคีย์ซ้ำ (23505) → นับว่าสำเร็จ", async () => {
    const b = builder([fail("Failed to fetch", "", 0), fail("duplicate key", "23505", 409)]);
    await expect(check(b, [0, 0])).resolves.toBeNull();
    expect(b.calls).toBe(2);
  });
});
