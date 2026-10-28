import { describe, it, expect } from "vitest";
import { monthSheets } from "./excelMonths";
import { monthsSince } from "./salesMatrix";

describe("monthsSince / monthSheets: ส่งออกย้อนหลังทุกเดือน", () => {
  it("ไล่ทุกเดือนจากเดือนแรกที่มีข้อมูลถึงเดือนนี้ เรียงใหม่ไปเก่า ข้ามปีได้", () => {
    const months = monthsSince(new Date("2025-11-20T10:00:00").getTime(), new Date("2026-02-10T09:00:00"));
    expect(months).toEqual([
      { year: 2026, month0: 1 },
      { year: 2026, month0: 0 },
      { year: 2025, month0: 11 },
      { year: 2025, month0: 10 },
    ]);
  });

  it("ไม่มีข้อมูลเลย = ไม่มีเดือนให้ส่งออก", () => {
    expect(monthsSince(null)).toEqual([]);
  });

  it("เริ่มเดือนเดียวกับเดือนนี้ได้เดือนเดียว", () => {
    expect(monthsSince(new Date("2026-10-02T10:00:00").getTime(), new Date("2026-10-28T09:00:00"))).toEqual([{ year: 2026, month0: 9 }]);
  });

  it("monthSheets ตั้งชื่อชีต YYYY-MM และข้ามเดือนที่ไม่มีข้อมูล", () => {
    const sheets = monthSheets(
      [
        { year: 2026, month0: 9 },
        { year: 2026, month0: 8 },
        { year: 2026, month0: 7 },
      ],
      (m) => (m.month0 === 8 ? null : [[`เดือน ${m.month0 + 1}`]]),
    );
    expect(sheets).toEqual([
      { name: "2026-10", rows: [["เดือน 10"]] },
      { name: "2026-08", rows: [["เดือน 8"]] },
    ]);
  });
});
