// จับเวลาตอนโหลดข้อมูลเข้าแอป (เปิดแอปครั้งแรก / กดรีเฟรช) เก็บค่าล่าสุดไว้แสดงในเมนูโปรไฟล์
// ให้ผู้ใช้เห็นเองว่าช้าตรงไหนโดยไม่ต้องเปิดเครื่องมือนักพัฒนา และส่งตัวเลขมาให้ตรวจได้
export interface LoadStats {
  kind: "เปิดแอป" | "รีเฟรช";
  fetchMs: number; // เวลาดึงข้อมูลทุกตารางจากฐานข้อมูล
  rows: number; // จำนวนแถวที่ได้มา (รวมทุกตาราง)
  at: number; // เวลาที่วัด (ms)
}

let last: LoadStats | null = null;
const listeners = new Set<() => void>();

export function recordLoadStats(stats: LoadStats) {
  last = stats;
  listeners.forEach((l) => l());
}

export function getLoadStats(): LoadStats | null {
  return last;
}

export function subscribeLoadStats(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// นับแถวของทุกตารางใน state ที่เป็นแบบ Record<id, row>
export function countStateRows(state: object): number {
  let n = 0;
  for (const value of Object.values(state)) {
    if (value && typeof value === "object" && !Array.isArray(value)) n += Object.keys(value as object).length;
  }
  return n;
}
