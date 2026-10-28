import { describe, it, expect } from "vitest";
import { MAX_FAILED, LOCK_MINUTES, hashPin, lockMinutesLeft, nextFailState, validPinFormat, verifyPin, weakPinReason } from "./pin";

describe("PIN: รูปแบบและความเดาง่าย", () => {
  it("ต้องเป็นตัวเลข 6 หลักพอดี", () => {
    expect(validPinFormat("482915")).toBe(true);
    for (const bad of ["12345", "1234567", "12345a", "", "12 345", 482915, null, undefined]) expect(validPinFormat(bad)).toBe(false);
  });

  it("ปฏิเสธเลขซ้ำ เลขเรียง เลขชุดซ้ำ และที่นิยมใช้", () => {
    for (const weak of ["000000", "111111", "123456", "234567", "654321", "987654", "121212", "123123", "112233", "159753", "520520"]) {
      expect(weakPinReason(weak), weak).not.toBeNull();
    }
  });

  it("PIN ที่ไม่เข้าข่ายเดาง่ายผ่าน", () => {
    for (const ok of ["482915", "907318", "135790", "280417"]) expect(weakPinReason(ok), ok).toBeNull();
  });
});

describe("PIN: hash และตรวจ", () => {
  it("ตรวจถูกกับ PIN เดิม ผิดกับ PIN อื่น และไม่เก็บ PIN ตรง ๆ", async () => {
    const stored = await hashPin("482915");
    expect(stored.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(stored).not.toContain("482915");
    expect(await verifyPin("482915", stored)).toBe(true);
    expect(await verifyPin("482916", stored)).toBe(false);
  });

  it("ตั้ง PIN เดียวกันสองครั้งได้ hash ไม่เหมือนกัน (salt สุ่ม) แต่ตรวจผ่านทั้งคู่", async () => {
    const a = await hashPin("482915");
    const b = await hashPin("482915");
    expect(a).not.toBe(b);
    expect(await verifyPin("482915", a)).toBe(true);
    expect(await verifyPin("482915", b)).toBe(true);
  });

  it("ข้อมูลที่เก็บเสียรูป ตรวจไม่ผ่านโดยไม่ error", async () => {
    for (const bad of ["", "plain", "pbkdf2-sha256$abc$00$00", "md5$1$00$00", "pbkdf2-sha256$100000$$"]) expect(await verifyPin("482915", bad)).toBe(false);
  });
});

describe("PIN: ล็อกเมื่อผิดหลายครั้ง", () => {
  const now = new Date("2026-10-28T10:00:00Z");

  it("ผิดไม่ถึงกำหนดแค่นับเพิ่ม ครบแล้วล็อกและเริ่มนับใหม่", () => {
    let state = { failedCount: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < MAX_FAILED; i++) {
      state = nextFailState(state.failedCount, now);
      expect(state).toEqual({ failedCount: i, lockedUntil: null });
    }
    state = nextFailState(state.failedCount, now);
    expect(state.failedCount).toBe(0);
    expect(state.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_MINUTES * 60_000);
  });

  it("lockMinutesLeft: ยังล็อกอยู่คืนนาทีที่เหลือ (ปัดขึ้น) พ้นกำหนดหรือไม่ล็อกเป็น 0", () => {
    expect(lockMinutesLeft(new Date(now.getTime() + 14 * 60_000 + 1000), now)).toBe(15);
    expect(lockMinutesLeft(new Date(now.getTime() + 60_000), now)).toBe(1);
    expect(lockMinutesLeft(new Date(now.getTime() - 1), now)).toBe(0);
    expect(lockMinutesLeft(null, now)).toBe(0);
    expect(lockMinutesLeft(now.toISOString(), now)).toBe(0);
  });
});
