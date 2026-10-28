// กติกาของ PIN เข้าสู่ระบบ แยกออกมาเป็นฟังก์ชันล้วน ๆ (ไม่แตะฐานข้อมูล/เครือข่าย) เพื่อทดสอบได้ใน vitest
// ใช้เฉพาะ Web Crypto (crypto.subtle) ซึ่งมีทั้งใน Deno (Edge Function) และ Node

export const PIN_LENGTH = 6;
export const MAX_FAILED = 5; // ผิดครบกี่ครั้งแล้วล็อกบัญชี
export const LOCK_MINUTES = 15;
export const IP_FAIL_LIMIT = 20; // ผิดจากที่อยู่ IP เดียวกันเกินนี้ในช่วงเวลา ถูกปฏิเสธชั่วคราว
export const IP_WINDOW_MINUTES = 15;

const ITERATIONS = 100_000;

export function validPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

const COMMON = new Set(["123123", "112233", "123321", "456654", "159753", "147258", "258369", "789456", "321654", "520520", "131313", "142857"]);

// PIN ที่เดาง่าย (เลขซ้ำ, เรียงต่อเนื่อง, ซ้ำเป็นชุด, ที่คนนิยมใช้) คืนเหตุผลภาษาไทย หรือ null ถ้าใช้ได้
export function weakPinReason(pin: string): string | null {
  const d = pin.split("").map(Number);
  if (d.every((n) => n === d[0])) return "PIN ห้ามเป็นเลขซ้ำกันทั้งหมด";
  if (d.every((n, i) => i === 0 || n === d[i - 1] + 1) || d.every((n, i) => i === 0 || n === d[i - 1] - 1)) return "PIN ห้ามเป็นเลขเรียงกัน";
  for (const period of [2, 3]) {
    if (d.every((n, i) => i < period || n === d[i - period])) return "PIN ห้ามเป็นเลขชุดเดิมซ้ำกัน";
  }
  if (COMMON.has(pin)) return "PIN นี้เดาง่ายเกินไป";
  return null;
}

const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf as ArrayBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toHex(bits);
}

// รูปแบบที่เก็บ: pbkdf2-sha256$รอบ$salt$hash (hex) — salt สุ่มใหม่ทุกครั้งที่ตั้ง PIN
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${await derive(pin, salt, ITERATIONS)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltHex, hashHex] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 1 || !saltHex || !hashHex) return false;
  const actual = await derive(pin, fromHex(saltHex), iterations);
  // เทียบแบบใช้เวลาคงที่ ไม่หยุดทันทีที่ตัวอักษรแรกที่ไม่ตรง
  if (actual.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// ผิดอีกหนึ่งครั้ง: ถ้าครบ MAX_FAILED ให้ล็อก LOCK_MINUTES นาทีและเริ่มนับใหม่
export function nextFailState(failedCount: number, now: Date): { failedCount: number; lockedUntil: Date | null } {
  const failed = failedCount + 1;
  if (failed >= MAX_FAILED) return { failedCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  return { failedCount: failed, lockedUntil: null };
}

// จำนวนนาทีที่เหลือก่อนปลดล็อก (ปัดขึ้น) 0 = ไม่ได้ล็อก
export function lockMinutesLeft(lockedUntil: string | Date | null | undefined, now: Date): number {
  if (!lockedUntil) return 0;
  const ms = new Date(lockedUntil).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}
