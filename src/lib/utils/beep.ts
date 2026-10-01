// เสียงบี๊บสั้น ๆ ยืนยันผลสแกน โดยสังเคราะห์เป็นไฟล์ WAV เล็ก ๆ ครั้งเดียวแล้วเล่นผ่าน <audio>
// (ไม่ใช้ Web Audio API แบบ AudioContext ตรง ๆ เพราะตอนกล้อง getUserMedia เปิดอยู่ (สแกน QR)
// iOS Safari บางเครื่อง suspend เสียงจาก AudioContext เงียบ ๆ โดยไม่มี error — <audio> element
// เชื่อถือได้กว่าในสถานการณ์นี้ และเป็นวิธีปลดล็อกเสียงบนมือถือที่ใช้กันทั่วไป)

// segment: freq = ความถี่ (Hz) ใส่ 0 = เว้นวรรคเงียบ, amp = ความดัง 0-1 (ค่าเริ่มต้น 0.6), hard = true จะอัดสัญญาณให้เต็มและแหลมขึ้น
// (soft clipping) ได้เสียงดังกว่าไซน์ธรรมดาที่แอมพลิจูดเท่ากัน ใช้กับเสียงเตือนที่ต้องได้ยินแม้อยู่ในที่เสียงดัง
export interface BeepSegment {
  freq: number;
  duration: number;
  amp?: number;
  hard?: boolean;
}

export function synthWav(segments: BeepSegment[], sampleRate = 16000): string {
  let totalSamples = 0;
  for (const seg of segments) totalSamples += Math.floor(seg.duration * sampleRate);
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const seg of segments) {
    const n = Math.floor(seg.duration * sampleRate);
    const fadeSamples = Math.max(1, Math.floor(sampleRate * 0.005));
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const fade = Math.min(1, i / fadeSamples, (n - i) / fadeSamples);
      const amp = seg.amp ?? 0.6;
      const wave = seg.freq <= 0 ? 0 : Math.sin(2 * Math.PI * seg.freq * t);
      const shaped = seg.hard ? Math.tanh(2.5 * wave) / Math.tanh(2.5) : wave;
      const sample = shaped * fade * amp;
      view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 32767, true);
      offset += 2;
    }
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export type BeepKind = "success" | "error" | "duplicate";

// เสียงสแกนซ้ำ: เตือนดัง ๆ โทนสูง 2 ระดับสลับกัน 2 รอบ (ติ๊ด-ต๊อด ติ๊ด-ต๊อด) ยาวราว 0.45 วินาที
// ใช้ช่วง 1.3-1.8 kHz ที่หูไวและลำโพงมือถือเล่นได้ดังที่สุด (โทนต่ำ 200-300 Hz เล่นเบามากบนมือถือ) และใช้แอมพลิจูดเต็ม
export const DUPLICATE_BEEP: BeepSegment[] = [
  { freq: 1760, duration: 0.1, amp: 0.95, hard: true },
  { freq: 1320, duration: 0.1, amp: 0.95, hard: true },
  { freq: 0, duration: 0.05 },
  { freq: 1760, duration: 0.1, amp: 0.95, hard: true },
  { freq: 1320, duration: 0.1, amp: 0.95, hard: true },
];

export const ERROR_BEEP: BeepSegment[] = [
  { freq: 320, duration: 0.12 },
  { freq: 220, duration: 0.16 },
];

let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;
let duplicateAudio: HTMLAudioElement | null = null;

function getAudioEl(kind: BeepKind): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (kind === "success") {
    if (!successAudio) successAudio = new Audio(synthWav([{ freq: 1400, duration: 0.09 }]));
    return successAudio;
  }
  if (kind === "duplicate") {
    if (!duplicateAudio) {
      duplicateAudio = new Audio(synthWav(DUPLICATE_BEEP));
      duplicateAudio.volume = 1;
    }
    return duplicateAudio;
  }
  if (!errorAudio) {
    errorAudio = new Audio(synthWav(ERROR_BEEP));
  }
  return errorAudio;
}

// iOS Safari ปลดล็อกเสียงได้เฉพาะตอนมี user gesture ตรง (เช่น tap) เท่านั้น — เรียกตัวนี้ใน
// ตัวจัดการคลิกของปุ่มเปิดกล้องไว้ล่วงหน้า เพื่อให้ playBeep ที่เรียกทีหลัง (ตอนสแกนเจอ ระหว่างกล้องเปิดอยู่
// ซึ่งไม่ใช่ user gesture ตรง) มีเสียงออกจริง
export function primeAudio() {
  for (const kind of ["success", "error", "duplicate"] as const) {
    const el = getAudioEl(kind);
    if (!el) continue;
    const originalVolume = el.volume;
    el.volume = 0;
    el.play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.volume = originalVolume;
      })
      .catch(() => {
        el.volume = originalVolume;
      });
  }
}

export function playBeep(kind: BeepKind) {
  const el = getAudioEl(kind);
  if (!el) return;
  el.currentTime = 0;
  void el.play().catch(() => {});
}
