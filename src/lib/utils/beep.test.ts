import { describe, it, expect } from "vitest";
import { synthWav, DUPLICATE_BEEP, ERROR_BEEP } from "./beep";

// ถอดไฟล์ WAV (data URI ที่ synthWav สร้าง) กลับเป็นตัวอย่างเสียง เพื่อวัดความดังจริง ไม่ใช่เดาจากค่าที่ตั้งไว้
function decode(uri: string) {
  const b64 = uri.replace("data:audio/wav;base64,", "");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const sampleRate = view.getUint32(24, true);
  const n = (bytes.length - 44) / 2;
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) samples[i] = view.getInt16(44 + i * 2, true) / 32768;
  return { samples, sampleRate };
}

const peak = (s: Float64Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
// RMS เฉพาะช่วงที่มีเสียง (ไม่นับช่วงเว้นวรรคเงียบ) เพื่อเทียบความดังต่อโทนแบบเป็นธรรม
const rmsWhenSounding = (s: Float64Array) => {
  const loud = Array.from(s).filter((v) => Math.abs(v) > 0.001);
  return Math.sqrt(loud.reduce((a, v) => a + v * v, 0) / loud.length);
};
// Goertzel: พลังงาน ณ ความถี่หนึ่ง ๆ ใช้เช็คว่าเสียงอยู่ในช่วงที่ลำโพงมือถือเล่นได้ดี
function energyAt(s: Float64Array, sampleRate: number, hz: number) {
  const w = (2 * Math.PI * hz) / sampleRate;
  let c = 0;
  let sn = 0;
  for (let i = 0; i < s.length; i++) {
    c += s[i] * Math.cos(w * i);
    sn += s[i] * Math.sin(w * i);
  }
  return (c * c + sn * sn) / s.length;
}

describe("เสียงสแกนซ้ำ (duplicate beep)", () => {
  const dup = decode(synthWav(DUPLICATE_BEEP));
  const err = decode(synthWav(ERROR_BEEP));

  it("is much louder than the old error tone it replaces for duplicate scans", () => {
    expect(rmsWhenSounding(dup.samples)).toBeGreaterThan(rmsWhenSounding(err.samples) * 1.8);
    expect(peak(dup.samples)).toBeGreaterThan(0.9);
  });

  it("never exceeds full scale, so it does not distort into a crackle", () => {
    expect(peak(dup.samples)).toBeLessThanOrEqual(1);
  });

  it("is a short alert (under one second) so it does not block the next scan", () => {
    const seconds = dup.samples.length / dup.sampleRate;
    expect(seconds).toBeGreaterThan(0.3);
    expect(seconds).toBeLessThan(0.8);
  });

  it("puts its energy at 1.3-1.8 kHz where phone speakers are loudest, not at the old 220-320 Hz", () => {
    const high = energyAt(dup.samples, dup.sampleRate, 1760) + energyAt(dup.samples, dup.sampleRate, 1320);
    const low = energyAt(dup.samples, dup.sampleRate, 220) + energyAt(dup.samples, dup.sampleRate, 320);
    expect(high).toBeGreaterThan(low * 50);
  });

  it("leaves the old error tone itself unchanged", () => {
    expect(ERROR_BEEP).toEqual([
      { freq: 320, duration: 0.12 },
      { freq: 220, duration: 0.16 },
    ]);
  });
});
