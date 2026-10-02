// กรอบเล็งของกล้องสแกน (ต้องตรงกับ CSS ใน CameraScanner: h-44 = 176px, กว้าง min(90vw, 28rem = 448px))
export const GUIDE_HEIGHT_PX = 176;
export const GUIDE_MAX_WIDTH_PX = 448;
export const GUIDE_WIDTH_RATIO = 0.9;

export interface VideoGeometry {
  videoWidth: number; // พิกเซลจริงของภาพจากกล้อง
  videoHeight: number;
  clientWidth: number; // ขนาดที่แสดงบนหน้าจอ (พิกเซล CSS) วิดีโอใช้ object-cover จึงถูกขยายเต็มจอแล้วตัดส่วนเกิน
  clientHeight: number;
}

export interface Region {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// ส่วนของภาพกล้อง (หน่วยพิกเซลจริงของวิดีโอ) ที่อยู่ในกรอบเล็งบนหน้าจอ ขยายขอบเผื่อมือสั่น
// ถอดรหัสบาร์โค้ดเฉพาะส่วนนี้ที่ความละเอียดเต็ม ไม่ย่อภาพ: บาร์โค้ด 1D บนป้ายเล็กมีแท่งบางมาก
// ย่อภาพลงทำให้แท่งเหลือไม่ถึง 2 พิกเซลแล้วอ่านไม่ออก และการตัดเฉพาะกรอบยังทำให้ถอดรหัสเร็วขึ้นหลายเท่า
export function guideRegionInVideo(g: VideoGeometry, margin = { x: 1.3, y: 1.6 }): Region {
  const { videoWidth: vw, videoHeight: vh, clientWidth: cw, clientHeight: ch } = g;
  if (!vw || !vh || !cw || !ch) return { sx: 0, sy: 0, sw: vw, sh: vh };
  const scale = Math.max(cw / vw, ch / vh); // object-cover
  const guideW = Math.min(GUIDE_WIDTH_RATIO * cw, GUIDE_MAX_WIDTH_PX);
  const sw = Math.min(vw, Math.round((guideW / scale) * margin.x));
  const sh = Math.min(vh, Math.round((GUIDE_HEIGHT_PX / scale) * margin.y));
  return { sx: Math.round((vw - sw) / 2), sy: Math.round((vh - sh) / 2), sw, sh };
}
