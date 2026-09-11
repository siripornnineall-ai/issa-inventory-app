// เสียงบี๊บสั้น ๆ ยืนยันผลสแกน โดยสังเคราะห์เป็นไฟล์ WAV เล็ก ๆ ครั้งเดียวแล้วเล่นผ่าน <audio>
// (ไม่ใช้ Web Audio API แบบ AudioContext ตรง ๆ เพราะตอนกล้อง getUserMedia เปิดอยู่ (สแกน QR)
// iOS Safari บางเครื่อง suspend เสียงจาก AudioContext เงียบ ๆ โดยไม่มี error — <audio> element
// เชื่อถือได้กว่าในสถานการณ์นี้ และเป็นวิธีปลดล็อกเสียงบนมือถือที่ใช้กันทั่วไป)

function synthWav(segments: { freq: number; duration: number }[], sampleRate = 8000): string {
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
      const sample = Math.sin(2 * Math.PI * seg.freq * t) * fade * 0.6;
      view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 32767, true);
      offset += 2;
    }
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

function getAudioEl(kind: "success" | "error"): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (kind === "success") {
    if (!successAudio) successAudio = new Audio(synthWav([{ freq: 1400, duration: 0.09 }]));
    return successAudio;
  }
  if (!errorAudio) {
    errorAudio = new Audio(
      synthWav([
        { freq: 320, duration: 0.12 },
        { freq: 220, duration: 0.16 },
      ])
    );
  }
  return errorAudio;
}

// iOS Safari ปลดล็อกเสียงได้เฉพาะตอนมี user gesture ตรง (เช่น tap) เท่านั้น — เรียกตัวนี้ใน
// ตัวจัดการคลิกของปุ่มเปิดกล้องไว้ล่วงหน้า เพื่อให้ playBeep ที่เรียกทีหลัง (ตอนสแกนเจอ ระหว่างกล้องเปิดอยู่
// ซึ่งไม่ใช่ user gesture ตรง) มีเสียงออกจริง
export function primeAudio() {
  for (const kind of ["success", "error"] as const) {
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

export function playBeep(kind: "success" | "error") {
  const el = getAudioEl(kind);
  if (!el) return;
  el.currentTime = 0;
  void el.play().catch(() => {});
}
