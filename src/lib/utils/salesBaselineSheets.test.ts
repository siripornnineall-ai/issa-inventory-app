import { describe, expect, it } from "vitest";
import { monthFromTitle, parseBaselineSheets } from "./salesBaselineImport";

describe("monthFromTitle", () => {
  it("อ่านเดือนไทยย่อ + ปี", () => {
    expect(monthFromTitle("ม.ค. 2026 — 7 สีหลัก")).toBe("2026-01-01");
    expect(monthFromTitle("มี.ค. 2569")).toBe("2026-03-01");
    expect(monthFromTitle("ไม่มีเดือน")).toBeNull();
  });
});

describe("parseBaselineSheets", () => {
  it("แยกเดือนต่อชีต ข้ามชีตว่าง", () => {
    const csv = "ก.พ. 2026 — 7 สีหลัก\n\nBillie Slim,S,M,รวมจำนวนต่อสี\nดำ,1,2,3\nรวมจำนวนต่อไซส์,1,2,3\n";
    const r = parseBaselineSheets([{ name: "กพ", csv }, { name: "ว่าง", csv: "" }]);
    expect(r).toHaveLength(1);
    expect(r[0].month).toBe("2026-02-01");
    expect(r[0].blocks[0].rows).toHaveLength(2);
  });
});
