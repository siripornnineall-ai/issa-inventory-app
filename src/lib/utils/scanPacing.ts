// ปรับจังหวะถอดรหัส QR ตามความแรงของเครื่อง: ถอดรหัสทุกเฟรมด้วย JavaScript บนเธรดหลักหนักมากบน Android ราคาประหยัด
// (แอปทั้งหน้ากระตุกจนสแกนช้า) จึงวัดเวลาที่ใช้จริง ถ้านานก็ย่อภาพลงและห่างรอบออกไป เครื่องแรงยังได้ความถี่เดิม
export interface QrPacing {
  width: number; // ความกว้างสูงสุดของภาพที่ส่งให้ถอดรหัส (พิกเซล)
  intervalMs: number; // เว้นระหว่างรอบ
}

export const QR_MIN_WIDTH = 640;
export const QR_SLOW_MS = 80;
export const QR_FAST_MS = 40;

// maxWidth = ความกว้างสูงสุดของเครื่องนี้ (ไม่ให้เกินตอนขยายกลับ)
// ย่อภาพลงเมื่อรอบนั้นช้า และ **ขยายกลับเมื่อเครื่องเร็วพอ** (เดิมย่อแล้วย่อเลย ช้าแค่รอบเดียว เช่นตอนหน้ากำลังโหลดตัวถอดรหัส
// ภาพจะค้างที่ความละเอียดต่ำตลอดการสแกนจนอ่าน QR บนป้ายช้ามากแม้ภาพกล้องลื่น)
export function nextQrPacing(prev: QrPacing, durationMs: number, baseIntervalMs: number, maxWidth = 1280): QrPacing {
  let width = prev.width;
  if (durationMs > QR_SLOW_MS && width > QR_MIN_WIDTH) width = Math.max(QR_MIN_WIDTH, Math.round(width * 0.75));
  else if (durationMs < QR_FAST_MS && width < maxWidth) width = Math.min(maxWidth, Math.round(width * 1.25));
  // ให้เธรดหลักว่างอย่างน้อยราวสองในสามของเวลา
  const intervalMs = Math.max(baseIntervalMs, Math.round(durationMs * 3));
  return { width, intervalMs };
}
