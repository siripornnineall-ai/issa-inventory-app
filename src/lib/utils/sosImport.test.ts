import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSosWorkbook } from "./sosImport";

// สร้างไฟล์จำลองที่มีโครงสร้างเดียวกับรายงานของ SOS (ไม่ใช้ไฟล์จริงของลูกค้า)
function workbook(opts: { withStock?: boolean; badSubtotal?: boolean } = {}) {
  const sales: unknown[][] = [
    ["SOS Sense Of Style", "", "", "", "", "", "", ""],
    ["", "", "รายงานสรุปยอดการขาย (สินค้า)", "", "", "", "", ""],
    ["ตั้งแต่วันที่ 1 กันยายน 2569 ถึงวันที่ 30 กันยายน 2569", "", "", "", "", "รายการขาย", "", ""],
    ["TEST SOS SIAM : Issa_apparelofficial", "", "", "", "", "", "", ""],
    ["No.", "รหัสสินค้า", "รายละเอียดสินค้า", "จำนวน", "ต่อหน่วย", "ก่อนลด", "ส่วนลด", "ยอดสุทธิ"],
    ["1", "B1590-A1", "Billie Slim ทรงกระบอกเล็ก black M", 2, 690, 1380, 60, 1320],
    ["2", "B1590-A2", "Wendy Mid ทรงกระบอกกลาง navy L", 1, 690, 690, 0, 690],
    ["3", "B1590-A3", "EMS Issa อื่นๆ", 1, 50, 50, 0, 50],
    ["", "", "", opts.badSubtotal ? 99 : 4, "", 2120, 60, 2060],
    ["", "", "", "", "", "", "", ""],
    ["TEST SOS SIAM : Issa_apparelofficial (เอกสาร ชำระเป็น บัตรเครดิต)", "", "", "", "", "", "", ""],
    ["No.", "รหัสสินค้า", "รายละเอียดสินค้า", "จำนวน", "ต่อหน่วย", "ก่อนลด", "ส่วนลด", "ยอดสุทธิ"],
    ["1", "B1590-A4", "Rainny Wide กระบอกใหญ่ cream S", 3, 690, 2070, 0, 2070],
    ["", "", "", 3, "", 2070, 0, 2070],
    ["", "", "", "", "", "", "", ""],
    ["", "ยอดขายรวม", 2060, "", "", "", "", ""],
    ["", "GP", 103, "", "", "", "", ""],
    ["", "ยอดหลังหัก GP", 1957, "", "", "", "", ""],
    ["", "ค่าบริการอื่นๆ", 40, "", "", "", "", ""],
    ["", "ยอดรับ", 1917, "", "", "", "", ""],
    ["", "ภาษีหัก ณ ที่จ่าย", 5, "", "", "", "", ""],
    ["", "ยอดรับ In.Vat", 1922, "", "", "", "", ""],
    ["", "Vat 7%", 0, "", "", "", "", ""],
    ["", "ยอดรับ Ex.Vat", 1922, "", "", "", "", ""],
  ];
  const stock: unknown[][] = [
    ["SOS Sense Of Style", "", "", ""],
    ["สรุปยอดสินค้าคงเหลือ", "", "", ""],
    ["TEST SOS SIAM ณ วันที่ 1 ตุลาคม 2569", "", "", ""],
    ["สินค้า : Issa_apparelofficial", "", "", ""],
    ["No.", "รหัสสินค้า", "รายละเอียดสินค้า", "จำนวน"],
    ["1", "B1590-A1", "Billie Slim ทรงกระบอกเล็ก black M", 3],
    ["2", "B1590-A9", "Pocky Mid ทรงกระบอกกลาง brown M", -1],
    ["", "", "", 2],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sales), "รายงาน");
  if (opts.withStock !== false) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stock), "สินค้าคงเหลือ");
  return wb;
}

describe("อ่านไฟล์รายงานของ SOS", () => {
  it("อ่านสาขา งวด (แปลง พ.ศ. เป็น ค.ศ.) และสต็อก ณ วันที่", () => {
    const p = parseSosWorkbook(workbook());
    expect(p.branchName).toBe("TEST SOS SIAM");
    expect(p.periodStart).toBe("2026-09-01");
    expect(p.periodEnd).toBe("2026-09-30");
    expect(p.stockAsOf).toBe("2026-10-01");
  });

  it("แยกรายการขายเป็นส่วนปกติ (main) กับส่วนบัตรเครดิต (credit)", () => {
    const p = parseSosWorkbook(workbook());
    expect(p.sales.filter((l) => l.section === "main")).toHaveLength(3);
    const credit = p.sales.filter((l) => l.section === "credit");
    expect(credit).toHaveLength(1);
    expect(credit[0]).toMatchObject({ code: "B1590-A4", qty: 3, net: 2070 });
    expect(p.sales[0]).toMatchObject({ code: "B1590-A1", qty: 2, unitPrice: 690, gross: 1380, discount: 60, net: 1320 });
  });

  it("อ่านสรุปท้ายรายงานที่ SOS คำนวณ (ยอดขายรวม GP ค่าบริการ ยอดรับ ภาษีหัก ณ ที่จ่าย)", () => {
    const { summary } = parseSosWorkbook(workbook());
    expect(summary).toMatchObject({ salesTotal: 2060, gp: 103, afterGp: 1957, otherFees: 40, received: 1917, wht: 5, receivedInclVat: 1922, vat: 0, receivedExVat: 1922 });
  });

  it("อ่านสต็อก และเตือนเมื่อมีรายการติดลบ", () => {
    const p = parseSosWorkbook(workbook());
    expect(p.stock).toHaveLength(2);
    expect(p.stock[0]).toMatchObject({ code: "B1590-A1", qty: 3 });
    expect(p.warnings.some((w) => w.includes("ติดลบ"))).toBe(true);
  });

  it("เตือนเมื่อจำนวนชิ้นที่รวมไม่ตรงกับแถวรวมของไฟล์ และเมื่อไม่มีแผ่นสต็อก", () => {
    expect(parseSosWorkbook(workbook({ badSubtotal: true })).warnings.some((w) => w.includes("ไม่ตรงกับแถวรวม"))).toBe(true);
    expect(parseSosWorkbook(workbook({ withStock: false })).warnings.some((w) => w.includes("สินค้าคงเหลือ"))).toBe(true);
  });

  it("ไม่ใช่ไฟล์ของ SOS = ข้อผิดพลาดที่อ่านเข้าใจ", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a"]]), "Sheet1");
    expect(() => parseSosWorkbook(wb)).toThrow(/รายงาน/);
  });
});
