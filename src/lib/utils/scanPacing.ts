// ปรับจังหวะถอดรหัส QR ตามความแรงของเครื่อง: ถอดรหัสทุกเฟรมด้วย JavaScript บนเธรดหลักหนักมากบน Android ราคาประหยัด
// (แอปทั้งหน้ากระตุกจนสแกนช้า) จึงวัดเวลาที่ใช้จริง ถ้านานก็ย่อภาพลงและห่างรอบออกไป เครื่องแรงยังได้ความถี่เดิม
export interface QrPacing {
  width: number; // ความกว้างสูงสุดของภาพที่ส่งให้ถอดรหัส (พิกเซล)
  intervalMs: number; // เว้นระหว่างรอบ
}

export const QR_MIN_WIDTH = 640;
export const QR_SLOW_MS = 80;

export function nextQrPacing(prev: QrPacing, durationMs: number, baseIntervalMs: number): QrPacing {
  const width = durationMs > QR_SLOW_MS && prev.width > QR_MIN_WIDTH ? Math.max(QR_MIN_WIDTH, Math.round(prev.width * 0.75)) : prev.width;
  // ให้เธรดหลักว่างอย่างน้อยราวสองในสามของเวลา
  const intervalMs = Math.max(baseIntervalMs, Math.round(durationMs * 3));
  return { width, intervalMs };
}
