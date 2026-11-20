import { describe, it, expect } from "vitest";
import { compactCellNumber } from "./useIsMobile";

const full = (n: number) => n.toLocaleString("en-US");

describe("compactCellNumber", () => {
  it("จอใหญ่/เทสต์ แสดงเต็มเสมอ", () => {
    expect(compactCellNumber(1505, false, full)).toBe("1,505");
  });
  it("มือถือ: ต่ำกว่า 1,000 แสดงเต็ม, ตั้งแต่ 1,000 ย่อเป็น k", () => {
    expect(compactCellNumber(999, true, full)).toBe("999");
    expect(compactCellNumber(1505, true, full)).toBe("1.5k");
    expect(compactCellNumber(2000, true, full)).toBe("2k");
    expect(compactCellNumber(-1250, true, full)).toBe("-1.3k");
  });
});
