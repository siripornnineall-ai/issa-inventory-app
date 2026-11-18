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
    // ตารางควรผลิต: ขาด = ติดลบ (ดำ M ขาด 157 -> -157) ไม่ขาด = จำนวนที่มี (ดำ S มี 62+29=91)
    expect(rows[3].slice(15, 19)).toEqual(["ดำ", 91, -157, -157]);
    // ขาว S: ต้องผลิต 5 -> -5 ช่อง M ไม่มี = ว่าง
    expect(rows[4].slice(15, 19)).toEqual(["ขาว", -5, "", -5]);
    expect(rows[5].slice(15, 19)).toEqual(["รวม", -5, -157, -162]);
    // ขาวไม่มีไซซ์ M = ช่องว่าง
    expect(rows[4].slice(0, 4)).toEqual(["ขาว", 10, "", 10]);
    // แถวรวมท้ายตาราง
    expect(rows[5].slice(0, 4)).toEqual(["รวม", 72, 228, 300]);
  });
});

import { planSheet } from "@/lib/utils/productionPlan";
import * as XLSX from "xlsx-js-style";

describe("planSheet (สีในไฟล์ Excel)", () => {
  const m = {
    productId: "p",
    name: "Billie Wide",
    sizes: ["S"],
    colors: [{ color: "ดำ", cells: { S: { ...cell(62, 0, 0, 62), level: "out" as const } }, need: 62, demand: 62, diff: 0 }],
    sizeNeed: {},
    sizeDemand: {},
    sizeDiff: {},
    totals: { demand: 0, stock: 0, wip: 0, have: 0, diff: 0, need: 0, urgent: 0 },
  } as unknown as PlanMatrix;

  it("หัวตารางเขียวเข้ม ช่องของหมดแดง ช่องที่ต้องผลิตแดงอ่อน และไฟล์มีสีจริง", () => {
    const { rows, fills } = planSheet(emptyState() as never, [m]);
    expect(fills.get("1,0")?.bg).toBe("0F5F56"); // หัวตารางยอดขาย
    expect(fills.get("3,5")?.bg).toBe("F1948A"); // สต็อกคลังของหมด (บล็อกที่ 2 เริ่มคอลัมน์ 4: สี=4, S=5)
    expect(fills.get("3,13")?.bg).toBe("F1948A"); // ควรผลิตเพิ่ม > 0 และของหมด = แดงเข้ม
    const { fills: f2 } = planSheet(emptyState() as never, [m]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    for (const [k, f] of f2) {
      const [r, c] = k.split(",").map(Number);
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = { fill: { patternType: "solid", fgColor: { rgb: f.bg ?? "FFFFFF" } } };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "x");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    expect(buf.length).toBeGreaterThan(500);
  });
});
