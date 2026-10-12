import { describe, it, expect } from "vitest";
import { pruneRestoredTokens } from "./draftRestore";
import type { UnitToken } from "@/lib/types";

const now = new Date().toISOString();
const tok = (id: string, extra: Partial<UnitToken> = {}): UnitToken => ({ id, variantId: "v1", createdAt: now, ...extra });

describe("pruneRestoredTokens", () => {
  it("ป้ายที่ถูกบันทึกเข้าไปแล้วระหว่างนั้น ตัดออกและลดจำนวนในรายการ", () => {
    const tokens = { a: tok("a"), b: tok("b", { lastAction: "in", lastActionAt: now }), c: tok("c") };
    const res = pruneRestoredTokens(tokens, { v1: ["a", "b", "c"] }, [{ variantId: "v1", qty: 3 }], "in");
    expect(res.dropped).toBe(1);
    expect(res.scanned).toEqual({ v1: ["a", "c"] });
    expect(res.lines).toEqual([{ variantId: "v1", qty: 2 }]);
  });

  it("ตัดจนไม่เหลือ ลบรายการนั้นทิ้ง", () => {
    const tokens = { b: tok("b", { lastAction: "out", lastActionAt: now }) };
    const res = pruneRestoredTokens(tokens, { v1: ["b"] }, [{ variantId: "v1", qty: 1 }], "out");
    expect(res.lines).toEqual([]);
    expect(res.scanned).toEqual({});
  });

  it("ป้ายที่เครื่องนี้ยังไม่มีข้อมูล เก็บไว้ก่อน และรายการที่ไม่ได้สแกน (เลือกเอง) ไม่ถูกแตะ", () => {
    const res = pruneRestoredTokens({}, { v1: ["x"] }, [{ variantId: "v1", qty: 4 }, { variantId: "v2", qty: 2 }], "in");
    expect(res.dropped).toBe(0);
    expect(res.lines).toHaveLength(2);
  });

  it("สแกนเข้าแล้ว แต่ร่างเป็นของการเบิกออก ไม่ถือว่าซ้ำ", () => {
    const tokens = { a: tok("a", { lastAction: "in", lastActionAt: now }) };
    expect(pruneRestoredTokens(tokens, { v1: ["a"] }, [{ variantId: "v1", qty: 1 }], "out").dropped).toBe(0);
  });
});
