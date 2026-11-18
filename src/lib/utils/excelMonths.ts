import * as XLSX from "xlsx-js-style";

// สีช่อง: bg/fg เป็นรหัส hex 6 หลัก (ไม่มี #) ใช้กับชีตที่อยากลงสีเหมือนบนหน้าจอ
export interface CellFill {
  bg?: string;
  fg?: string;
  bold?: boolean;
  center?: boolean;
}

export interface MonthSheet {
  name: string;
  rows: (string | number)[][];
  fills?: Map<string, CellFill>; // key = `${แถว},${คอลัมน์}` (เริ่มที่ 0)
  colWidths?: number[];
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
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.fills) {
      for (const [key, f] of s.fills) {
        const [r, c] = key.split(",").map(Number);
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        ws[ref].s = {
          ...(f.bg ? { fill: { patternType: "solid", fgColor: { rgb: f.bg } } } : {}),
          font: { ...(f.fg ? { color: { rgb: f.fg } } : {}), ...(f.bold ? { bold: true } : {}) },
          ...(f.center ? { alignment: { horizontal: "center" } } : {}),
        };
      }
    }
    if (s.colWidths) ws["!cols"] = s.colWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  XLSX.writeFile(wb, fileName);
}
