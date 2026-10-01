import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "./client";
import type { AppUser, UserRole } from "@/lib/types";

// เรียก Edge Function "admin-users" (supabase/functions/admin-users) สำหรับงานที่ต้องใช้สิทธิ์ service role:
// สร้างบัญชีพร้อมรหัสผ่านชั่วคราว, ตั้งรหัสผ่านใหม่ให้คนอื่น, ลบผู้ใช้ — ฝั่งฟังก์ชันตรวจซ้ำว่าผู้เรียกเป็น admin จริง
// ทุกฟังก์ชันที่นี่โยน Error พร้อมข้อความภาษาไทยที่แสดงให้ผู้ใช้เห็นได้เลย

export const MIN_PASSWORD_LENGTH = 8;

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? "ทำรายการไม่สำเร็จ");
    }
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
  return data as T;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  avatar_url: string | null;
  must_change_password: boolean;
  created_at: string;
}

export async function adminCreateUser(input: { name: string; email: string; role: UserRole; password: string }): Promise<AppUser> {
  const { profile } = await invoke<{ profile: ProfileRow }>({ action: "create", ...input });
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role as UserRole,
    active: profile.active,
    avatarUrl: profile.avatar_url ?? undefined,
    mustChangePassword: profile.must_change_password === true ? true : undefined,
    createdAt: profile.created_at,
  };
}

export async function adminResetPassword(userId: string, password: string): Promise<void> {
  await invoke({ action: "reset_password", userId, password });
}

// เปลี่ยนอีเมล (ชื่อที่ใช้เข้าสู่ระบบ) ของผู้ใช้ รวมถึงของตัวเอง — เปลี่ยนที่บัญชีเข้าสู่ระบบและ profiles พร้อมกัน คืนอีเมลที่บันทึกจริง
export async function adminUpdateEmail(userId: string, email: string): Promise<string> {
  const { email: saved } = await invoke<{ email: string }>({ action: "update_email", userId, email });
  return saved;
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await invoke({ action: "delete", userId });
}

// สุ่มรหัสผ่านชั่วคราว 12 ตัว ตัดตัวอักษรที่อ่านสับสนออก (0/O, 1/l/I) เพราะต้องบอกต่อให้พนักงานพิมพ์เอง
export function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
