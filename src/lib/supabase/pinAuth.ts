import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "./client";
import type { UserRole } from "@/lib/types";
// กติกา PIN ใช้ชุดเดียวกับที่ Edge Function ตรวจ (ไฟล์เดียว ไม่ซ้ำสองที่)
export { PIN_LENGTH, validPinFormat, weakPinReason } from "../../../supabase/functions/pin-auth/pin";

// เรียก Edge Function "pin-auth" (supabase/functions/pin-auth) — เข้าสู่ระบบด้วย PIN 6 หลัก
// ฝั่งฟังก์ชันตรวจ PIN, ล็อกบัญชีเมื่อผิดซ้ำ และออกเซสชันให้ ฟังก์ชันที่นี่โยน PinError พร้อมข้อความภาษาไทยที่แสดงได้เลย

export class PinError extends Error {
  status: number;
  minutesLeft?: number;
  attemptsLeft?: number;
  constructor(message: string, status = 0, extra: { minutesLeft?: number; attemptsLeft?: number } = {}) {
    super(message);
    this.status = status;
    this.minutesLeft = extra.minutesLeft;
    this.attemptsLeft = extra.attemptsLeft;
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().functions.invoke("pin-auth", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new PinError(payload?.error ?? "ทำรายการไม่สำเร็จ", error.context.status, { minutesLeft: payload?.minutesLeft, attemptsLeft: payload?.attemptsLeft });
    }
    throw new PinError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
  return data as T;
}

export interface PinUser {
  id: string;
  name: string;
  role: UserRole;
}

// รายชื่อการ์ดบนหน้าเข้าสู่ระบบ: ผู้ใช้ที่ตั้ง PIN ไว้แล้ว (ไม่รวมผู้ดูแลระบบ) ล้มเหลวหรือช้าเกิน timeoutMs ถือว่าไม่มีรายชื่อ
// ให้ตกไปใช้อีเมล+รหัสผ่านทันที (ฟังก์ชันฝั่งเซิร์ฟเวอร์ที่ไม่ได้ถูกเรียกนานอาจต้องปลุกก่อน ไม่ให้หน้าเข้าสู่ระบบค้างรอ)
export async function pinList(timeoutMs = 2500): Promise<PinUser[]> {
  const fetchList = async (): Promise<PinUser[]> => {
    try {
      const { users } = await invoke<{ users: PinUser[] }>({ action: "list" });
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PinUser[]>((resolve) => {
    timer = setTimeout(() => resolve([]), timeoutMs);
  });
  try {
    return await Promise.race([fetchList(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function pinLogin(userId: string, pin: string): Promise<{ access_token: string; refresh_token: string }> {
  const { session } = await invoke<{ session: { access_token: string; refresh_token: string } }>({ action: "login", userId, pin });
  return session;
}

// ตั้ง/เปลี่ยน PIN ของตัวเอง ต้องยืนยันด้วยรหัสผ่านปัจจุบัน
export async function pinSet(pin: string, password: string): Promise<void> {
  await invoke({ action: "set", pin, password });
}

export async function pinClear(): Promise<void> {
  await invoke({ action: "clear" });
}

// ผู้ดูแลระบบล้าง PIN ของพนักงาน (ลืม PIN / ถูกล็อก) พนักงานตั้งใหม่เองหลังเข้าด้วยรหัสผ่าน
export async function pinAdminClear(userId: string): Promise<void> {
  await invoke({ action: "admin_clear", userId });
}

// ถามไม่สำเร็จ (เน็ตหลุด ฯลฯ) ถือว่ามี PIN แล้ว จะได้ไม่เตือน/ชวนตั้งซ้ำโดยไม่จำเป็น
export async function hasPin(): Promise<boolean> {
  const { data, error } = await createClient().rpc("has_pin");
  return error ? true : data === true;
}
