// จัดรูปแบบวันที่/เวลาแบบไทย เขตเวลา Asia/Bangkok

const TZ = "Asia/Bangkok";

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayInputValue(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
}

export function formatThaiDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatThaiDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const date = formatThaiDate(d);
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} ${time} น.`;
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function isWithinRange(iso: string, fromISO: string, toISO: string): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(fromISO).getTime() && t <= new Date(toISO).getTime();
}

// แปลงค่าจาก <input type="date"> (YYYY-MM-DD) เป็น ISO string โดยใช้เวลาปัจจุบัน ณ วันที่เลือก
export function dateInputToISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const now = new Date();
  now.setFullYear(y, m - 1, d);
  return now.toISOString();
}
