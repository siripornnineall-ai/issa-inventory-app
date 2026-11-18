import { describe, it, expect } from "vitest";
import { planSheetRows, type PlanMatrix, type PlanCell } from "@/lib/utils/productionPlan";
import { emptyState } from "@/lib/store/state";

const cell = (demand: number, stock: number, wip: number, need: number): PlanCell => ({ variantId: "v", demand, stock, wip, have: stock + wip, diff: stock + wip - demand, need, coverDays: null });

describe("planSheetRows (Excel เป็นตารางสี x ไซซ์)", () => {
  it("วาง 4 ตารางเรียงข้างกัน มีรวมท้ายแถวและท้ายตาราง", () => {
    const m = {
      productId: "p",
      name: "Billie Wide",
      sizes: ["S", "M"],
      colors: [
        { color: "ดำ", cells: { S: cell(62, 62, 29, 0), M: cell(228, 71, 0, 157) }, need: 157, demand: 290, diff: 0 },
        { color: "ขาว", cells: { S: cell(10, 5, 0, 5) }, need: 5, demand: 10, diff: 0 },
      ],
      sizeNeed: {},
      sizeDemand: {},
      sizeDiff: {},
      totals: { demand: 0, stock: 0, wip: 0, have: 0, diff: 0, need: 0, urgent: 0 },
    } as unknown as PlanMatrix;
    const rows = planSheetRows(emptyState() as never, [m]);
    expect(rows[0][0]).toBe("Billie Wide");
    expect(rows[1][0]).toBe("ยอดขาย");
    expect(rows[2].slice(0, 4)).toEqual(["สี", "S", "M", "รวม"]);
    // แถวดำ: ยอดขาย 62,228 รวม 290 | คลัง 62,71 รวม 133
    expect(rows[3].slice(0, 4)).toEqual(["ดำ", 62, 228, 290]);
    expect(rows[3].slice(5, 9)).toEqual(["ดำ", 62, 71, 133]);
    // ขาวไม่มีไซซ์ M = ช่องว่าง
    expect(rows[4].slice(0, 4)).toEqual(["ขาว", 10, "", 10]);
    // แถวรวมท้ายตาราง
    expect(rows[5].slice(0, 4)).toEqual(["รวม", 72, 228, 300]);
  });
});
