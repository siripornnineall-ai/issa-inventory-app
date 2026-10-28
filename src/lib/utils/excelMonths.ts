import * as XLSX from "xlsx";

export interface MonthSheet {
  name: string;
  rows: (string | number)[][];
}

// หนึ่งชีตต่อเดือน (ชื่อชีต YYYY-MM เรียงตามลำดับของ months) เดือนที่ไม่มีข้อมูล (rowsFor คืน null) ข้าม
export function monthSheets(months: { year: number; month0: number }[], rowsFor: (m: { year: number; month0: number }) => (string | number)[][] | null): MonthSheet[] {
  const out: MonthSheet[] = [];
  for (const m of months) {
    const rows = rowsFor(m);
    if (rows) out.push({ name: `${m.year}-${String(m.month0 + 1).padStart(2, "0")}`, rows });
  }
  return out;
}

export function downloadWorkbook(fileName: string, sheets: MonthSheet[]) {
  if (sheets.length === 0) return;
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  XLSX.writeFile(wb, fileName);
}
