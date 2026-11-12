import * as XLSX from "xlsx";

// อ่านไฟล์รายงานของ SOS Sense Of Style (.xls ที่ดาวน์โหลดรายสาขา) หนึ่งไฟล์ = หนึ่งสาขา หนึ่งงวด
// แผ่น "รายงาน": รายการขาย แบ่งเป็นส่วน main (ที่ SOS คิดเป็นยอดขายรวม) และส่วน "เอกสาร ชำระเป็น บัตรเครดิต" (credit)
//   ท้ายแผ่นมีสรุปที่ SOS คำนวณ: ยอดขายรวม GP ค่าบริการ ยอดรับ ภาษีหัก ณ ที่จ่าย ฯลฯ
// แผ่น "สินค้าคงเหลือ": สต็อกที่สาขา ณ วันต้นเดือนถัดไป
// ปีในไฟล์เป็น พ.ศ. แปลงเป็น ค.ศ. ให้

export interface SosSalesLine {
  section: "main" | "credit";
  code: string;
  description: string;
  qty: number;
  unitPrice: number;
  gross: number;
  discount: number;
  net: number;
}

export interface SosStockLine {
  code: string;
  description: string;
  qty: number;
}

export interface SosSummary {
  salesTotal: number | null;
  gp: number | null;
  afterGp: number | null;
  otherFees: number | null;
  received: number | null;
  wht: number | null;
  receivedInclVat: number | null;
  vat: number | null;
  receivedExVat: number | null;
}

export interface SosParsed {
  branchName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  stockAsOf: string | null;
  sales: SosSalesLine[];
  stock: SosStockLine[];
  summary: SosSummary;
  warnings: string[];
}

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
};

function isoDate(day: string, monthTh: string, yearBe: string): string | null {
  const m = THAI_MONTHS[monthTh];
  if (!m) return null;
  const y = Number(yearBe) - 543;
  return `${y}-${String(m).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const text = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

type Row = unknown[];

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] | null {
  const ws = wb.Sheets[name];
  return ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as Row[]) : null;
}

const SUMMARY_LABELS: Record<string, keyof SosSummary> = {
  ยอดขายรวม: "salesTotal",
  GP: "gp",
  "ยอดหลังหัก GP": "afterGp",
  ค่าบริการอื่นๆ: "otherFees",
  ยอดรับ: "received",
  "ภาษีหัก ณ ที่จ่าย": "wht",
  "ยอดรับ In.Vat": "receivedInclVat",
  "Vat 7%": "vat",
  "ยอดรับ Ex.Vat": "receivedExVat",
};

export function parseSosWorkbook(wb: XLSX.WorkBook): SosParsed {
  const salesRows = sheetRows(wb, "รายงาน");
  if (!salesRows) throw new Error('ไม่พบแผ่น "รายงาน" ในไฟล์ (ไม่ใช่ไฟล์รายงานยอดขายของ SOS)');
  const warnings: string[] = [];

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let branchName = "";
  for (const r of salesRows.slice(0, 8)) {
    const first = text(r[0]);
    const p = first.match(/ตั้งแต่วันที่\s*(\d+)\s*(\S+)\s*(\d{4})\s*ถึงวันที่\s*(\d+)\s*(\S+)\s*(\d{4})/);
    if (p) {
      periodStart = isoDate(p[1], p[2], p[3]);
      periodEnd = isoDate(p[4], p[5], p[6]);
    }
    if (!branchName && first.includes(" : ") && !p) branchName = first.split(" : ")[0].trim();
  }
  if (!branchName) throw new Error("ไม่พบชื่อสาขาในหัวรายงาน");
  if (!periodStart || !periodEnd) throw new Error("ไม่พบช่วงวันที่ของรายงานยอดขาย");

  const sales: SosSalesLine[] = [];
  const summary: SosSummary = { salesTotal: null, gp: null, afterGp: null, otherFees: null, received: null, wht: null, receivedInclVat: null, vat: null, receivedExVat: null };
  let section: "main" | "credit" = "main";
  const subtotals: Record<"main" | "credit", number> = { main: 0, credit: 0 };
  for (const r of salesRows.slice(5)) {
    const c0 = text(r[0]);
    const c1 = text(r[1]);
    if (/ชำระเป็น\s*บัตรเครดิต/.test(c0)) {
      section = "credit";
      continue;
    }
    if (/^\d+$/.test(c0) && c1) {
      sales.push({
        section,
        code: c1,
        description: text(r[2]),
        qty: num(r[3]),
        unitPrice: num(r[4]),
        gross: num(r[5]),
        discount: num(r[6]),
        net: num(r[7]),
      });
      continue;
    }
    if (!c0 && !c1 && !text(r[2]) && r[3] !== "" && typeof r[3] === "number") {
      subtotals[section] = num(r[3]); // แถวรวมท้ายแต่ละส่วน
      continue;
    }
    const key = SUMMARY_LABELS[c1];
    if (key && !c0) summary[key] = num(r[2]);
  }
  for (const sec of ["main", "credit"] as const) {
    const sum = sales.filter((l) => l.section === sec).reduce((s, l) => s + l.qty, 0);
    if (subtotals[sec] && sum !== subtotals[sec]) warnings.push(`จำนวนชิ้นส่วน ${sec === "main" ? "ปกติ" : "บัตรเครดิต"} รวมจากรายการ ${sum} ไม่ตรงกับแถวรวมของไฟล์ ${subtotals[sec]}`);
  }
  if (summary.receivedExVat === null && summary.received === null) warnings.push("ไม่พบสรุปท้ายรายงาน (ยอดรับ) ในไฟล์");

  // สินค้าคงเหลือ
  let stockAsOf: string | null = null;
  const stock: SosStockLine[] = [];
  const stockRows = sheetRows(wb, "สินค้าคงเหลือ");
  if (stockRows) {
    for (const r of stockRows.slice(0, 6)) {
      const m = text(r[0]).match(/ณ วันที่\s*(\d+)\s*(\S+)\s*(\d{4})/);
      if (m) {
        stockAsOf = isoDate(m[1], m[2], m[3]);
        const stockBranch = text(r[0]).split(" ณ ")[0].trim();
        if (stockBranch && stockBranch !== branchName) warnings.push(`ชื่อสาขาในแผ่นสต็อก (${stockBranch}) ไม่ตรงกับแผ่นยอดขาย (${branchName})`);
      }
    }
    for (const r of stockRows.slice(5)) {
      if (/^\d+$/.test(text(r[0])) && text(r[1])) stock.push({ code: text(r[1]), description: text(r[2]), qty: num(r[3]) });
    }
    if (stock.some((s) => s.qty < 0)) warnings.push(`สต็อกของ SOS มีรายการติดลบ ${stock.filter((s) => s.qty < 0).length} รายการ (ข้อมูลฝั่ง SOS คลาดเคลื่อน)`);
  } else {
    warnings.push('ไม่พบแผ่น "สินค้าคงเหลือ" ในไฟล์');
  }

  return { branchName, periodStart, periodEnd, stockAsOf, sales, stock, summary, warnings };
}

export function parseSosFile(data: ArrayBuffer): SosParsed {
  return parseSosWorkbook(XLSX.read(data, { type: "array" }));
}
