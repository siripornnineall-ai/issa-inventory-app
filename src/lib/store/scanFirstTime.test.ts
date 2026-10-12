import { describe, it, expect } from "vitest";
import { checkScannedToken, checkUnitTokenScan } from "./engine";
import type { UnitToken } from "@/lib/types";

const token: UnitToken = { id: "t1", code: "K7PX2MQ9", variantId: "v1", createdAt: "2026-10-12T00:00:00.000Z" };

describe("สแกนป้ายที่พิมพ์จากเครื่องอื่น (ยังไม่อยู่ใน state ของเครื่องนี้)", () => {
  it("เช็คกับ state เก่าที่ยังไม่มีป้ายนี้ จะขึ้น 'ไม่พบรหัส' ในการสแกนครั้งแรก (ต้นเหตุของบั๊ก)", () => {
    const res = checkUnitTokenScan({}, token.id, "in");
    expect(res.ok).toBe(false);
  });

  it("เช็คด้วยตัวป้ายที่ดึงมาจากฐานข้อมูล ผ่านตั้งแต่สแกนครั้งแรก", () => {
    expect(checkScannedToken({}, token, "in")).toEqual({ ok: true });
  });

  it("ป้ายที่เคยสแกนเข้าไปแล้วภายใน 3 ชั่วโมง ยังถูกกันเหมือนเดิม (ใช้ข้อมูลจากตัวป้าย)", () => {
    const scanned: UnitToken = { ...token, lastAction: "in", lastActionAt: new Date().toISOString() };
    const res = checkScannedToken({}, scanned, "in");
    expect(res.ok).toBe(false);
    expect(checkScannedToken({}, scanned, "out")).toEqual({ ok: true });
  });
});
