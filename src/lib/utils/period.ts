import { monthRange, shiftMonth } from "./salesMatrix";

// ช่วงวันที่ที่เลือกดูข้อมูล: วันที่เริ่มและวันที่สิ้นสุด (รวมวันสิ้นสุด) รูปแบบ YYYY-MM-DD เวลาท้องถิ่น เหมือนค่าของช่องเลือกวันที่
export interface Period {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const monthLabel = (year: number, month0: number) => new Date(year, month0, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

export function monthPeriod(year: number, month0: number): Period {
  return { from: ymd(new Date(year, month0, 1)), to: ymd(new Date(year, month0 + 1, 0)) };
}

export function isValidPeriod(p: Period): boolean {
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  return ok.test(p.from) && ok.test(p.to) && p.from <= p.to;
}

// ช่วงเวลาเป็นมิลลิวินาที [from, to) โดย to = เริ่มวันถัดจากวันสิ้นสุด
export function periodRange(p: Period): { from: number; to: number } {
  const end = parse(p.to);
  return { from: parse(p.from).getTime(), to: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime() };
}

// เป็นทั้งเดือนปฏิทินพอดี (วันที่ 1 ถึงสิ้นเดือน) หรือไม่
export function fullMonthOf(p: Period): { year: number; month0: number } | null {
  const f = parse(p.from);
  const m = monthPeriod(f.getFullYear(), f.getMonth());
  return m.from === p.from && m.to === p.to ? { year: f.getFullYear(), month0: f.getMonth() } : null;
}

// ช่วงก่อนหน้าที่ใช้เทียบ: ทั้งเดือน = เดือนก่อน / ช่วงอื่น = ช่วงที่ยาวเท่ากันติดก่อนวันเริ่ม
export function previousRange(p: Period): { from: number; to: number } {
  const month = fullMonthOf(p);
  if (month) {
    const prev = shiftMonth(month.year, month.month0, -1);
    return monthRange(prev.year, prev.month0);
  }
  const cur = periodRange(p);
  const start = parse(p.from);
  const days = Math.round((cur.to - cur.from) / 86400000);
  return { from: new Date(start.getFullYear(), start.getMonth(), start.getDate() - days).getTime(), to: cur.from };
}

const dayLabel = (s: string) => parse(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

// "เดือน ตุลาคม 2569" หรือ "ช่วง 1 ต.ค. 2569 – 15 ต.ค. 2569"
export function periodLabel(p: Period): string {
  const m = fullMonthOf(p);
  if (m) return `เดือน ${monthLabel(m.year, m.month0)}`;
  return p.from === p.to ? `วันที่ ${dayLabel(p.from)}` : `ช่วง ${dayLabel(p.from)} – ${dayLabel(p.to)}`;
}

// ส่วนของชื่อไฟล์/ชีต: เดือนเต็ม = YYYY-MM / ช่วงอื่น = YYYY-MM-DD_YYYY-MM-DD
export function periodFileKey(p: Period): string {
  const m = fullMonthOf(p);
  return m ? `${m.year}-${pad(m.month0 + 1)}` : `${p.from}_${p.to}`;
}
