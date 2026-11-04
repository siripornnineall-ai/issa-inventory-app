import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

describe("/api/version", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BUILD_ID;
  });

  it("ตอบเลขเวอร์ชันของ build และห้ามแคช", async () => {
    process.env.NEXT_PUBLIC_BUILD_ID = "abc123";
    const res = await GET();
    expect(await res.json()).toEqual({ id: "abc123" });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("ไม่มีเลขเวอร์ชัน: ตอบ dev", async () => {
    const res = await GET();
    expect(await res.json()).toEqual({ id: "dev" });
  });
});
