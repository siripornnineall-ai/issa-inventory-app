import { describe, it, expect } from "vitest";
import { fullMonthOf, isValidPeriod, monthPeriod, periodFileKey, periodLabel, periodRange, previousRange } from "./period";

describe("period: ช่วงวันที่ที่เลือกดูข้อมูล", () => {
  it("monthPeriod เป็นวันที่ 1 ถึงวันสุดท้ายของเดือน (รวมเดือนกุมภาพันธ์)", () => {
    expect(monthPeriod(2026, 9)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthPeriod(2028, 1)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("periodRange รวมวันสิ้นสุดทั้งวัน (to = เริ่มวันถัดไป)", () => {
    const r = periodRange({ from: "2026-10-10", to: "2026-10-12" });
    expect(new Date(r.from).getDate()).toBe(10);
    expect(new Date(r.to).getDate()).toBe(13);
    expect(new Date(r.to).getHours()).toBe(0);
    expect(periodRange({ from: "2026-10-31", to: "2026-10-31" }).to).toBe(new Date(2026, 10, 1).getTime());
  });

  it("fullMonthOf รู้ว่าเป็นทั้งเดือนหรือช่วงเอง", () => {
    expect(fullMonthOf({ from: "2026-10-01", to: "2026-10-31" })).toEqual({ year: 2026, month0: 9 });
    expect(fullMonthOf({ from: "2026-10-01", to: "2026-10-30" })).toBeNull();
    expect(fullMonthOf({ from: "2026-10-02", to: "2026-10-31" })).toBeNull();
  });

  it("previousRange: ทั้งเดือน = เดือนก่อน / ช่วงเอง = ช่วงยาวเท่ากันที่ติดก่อนวันเริ่ม", () => {
    const m = previousRange({ from: "2026-10-01", to: "2026-10-31" });
    expect(m).toEqual({ from: new Date(2026, 8, 1).getTime(), to: new Date(2026, 9, 1).getTime() });
    const c = previousRange({ from: "2026-10-11", to: "2026-10-20" }); // 10 วัน → 1–10 ต.ค.
    expect(c).toEqual({ from: new Date(2026, 9, 1).getTime(), to: new Date(2026, 9, 11).getTime() });
  });

  it("ชื่อช่วงและชื่อไฟล์", () => {
    expect(periodLabel({ from: "2026-10-01", to: "2026-10-31" })).toMatch(/^เดือน /);
    expect(periodLabel({ from: "2026-10-10", to: "2026-10-12" })).toMatch(/^ช่วง .* – /);
    expect(periodLabel({ from: "2026-10-10", to: "2026-10-10" })).toMatch(/^วันที่ /);
    expect(periodFileKey({ from: "2026-10-01", to: "2026-10-31" })).toBe("2026-10");
    expect(periodFileKey({ from: "2026-10-10", to: "2026-10-12" })).toBe("2026-10-10_2026-10-12");
  });

  it("isValidPeriod ไม่รับวันเริ่มเลยวันสิ้นสุดหรือค่าว่าง", () => {
    expect(isValidPeriod({ from: "2026-10-01", to: "2026-10-31" })).toBe(true);
    expect(isValidPeriod({ from: "2026-10-31", to: "2026-10-01" })).toBe(false);
    expect(isValidPeriod({ from: "", to: "2026-10-01" })).toBe(false);
  });
});
