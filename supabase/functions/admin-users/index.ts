// Edge Function: admin-users
// งานจัดการบัญชีผู้ใช้ที่ต้องใช้สิทธิ์ service role (สร้าง/ลบบัญชี Supabase Auth, ตั้งรหัสผ่านให้คนอื่น)
// ซึ่งทำจากฝั่งเบราว์เซอร์ไม่ได้ ทุกคำสั่งตรวจก่อนว่าผู้เรียกเป็น "ผู้ดูแลระบบ (admin)" ที่ยังเปิดใช้งานอยู่
// service role key มาจาก environment ของ Supabase เอง ไม่เคยถูกส่งไปที่เบราว์เซอร์หรือเก็บในโค้ดแอป
//
// deploy ด้วย verify_jwt = false เพราะตรวจ JWT เองในโค้ดผ่าน auth.getUser(token) ด้านล่าง
// (รองรับทั้งคีย์แบบเก่าและ signing keys แบบใหม่ของ Supabase)
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["admin", "manager", "warehouse", "sales", "viewer"];
const MIN_PASSWORD_LENGTH = 8;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function validPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD_LENGTH && pw.length <= 72;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "รองรับเฉพาะ POST" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "ระบบยังไม่ได้ตั้งค่า service role" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^bearer /i, "");
  if (!token) return json(401, { error: "กรุณาเข้าสู่ระบบก่อน" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) ยืนยันตัวตนผู้เรียกจาก access token
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  const caller = callerData?.user;
  if (callerErr || !caller) return json(401, { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });

  // 2) ต้องเป็นผู้ดูแลระบบที่เปิดใช้งานอยู่เท่านั้น
  const { data: callerProfile } = await admin.from("profiles").select("role, active").eq("id", caller.id).maybeSingle();
  if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.active) {
    return json(403, { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่ทำรายการนี้ได้" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "รูปแบบข้อมูลไม่ถูกต้อง" });
  }

  const action = body.action;

  // ---------- สร้างผู้ใช้ใหม่พร้อมรหัสผ่านชั่วคราว ----------
  if (action === "create") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role : "";
    if (!name) return json(400, { error: "กรุณาระบุชื่อผู้ใช้งาน" });
    if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) return json(400, { error: "รูปแบบอีเมลไม่ถูกต้อง" });
    if (!ROLES.includes(role)) return json(400, { error: "บทบาทไม่ถูกต้อง" });
    if (!validPassword(body.password)) return json(400, { error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      const dup = /already|registered|exists/i.test(createErr?.message ?? "");
      return json(dup ? 409 : 400, { error: dup ? `อีเมล "${email}" ถูกใช้งานแล้ว` : `สร้างบัญชีไม่สำเร็จ: ${createErr?.message ?? "ไม่ทราบสาเหตุ"}` });
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .insert({ id: created.user.id, name, email, role, active: true, must_change_password: true })
      .select("*")
      .single();
    if (profileErr || !profile) {
      // ย้อนกลับ: ไม่ปล่อยบัญชี Auth ค้างไว้โดยไม่มี profile
      await admin.auth.admin.deleteUser(created.user.id);
      return json(400, { error: `บันทึกข้อมูลผู้ใช้ไม่สำเร็จ: ${profileErr?.message ?? "ไม่ทราบสาเหตุ"}` });
    }
    return json(200, { profile });
  }

  // ---------- ตั้งรหัสผ่านใหม่ให้ผู้ใช้อื่น (บังคับให้เปลี่ยนเองเมื่อเข้าระบบครั้งถัดไป) ----------
  if (action === "reset_password") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) return json(400, { error: "ไม่พบผู้ใช้งานที่ต้องการ" });
    if (userId === caller.id) return json(400, { error: 'เปลี่ยนรหัสผ่านของตัวเองได้ที่เมนู "เปลี่ยนรหัสผ่าน"' });
    if (!validPassword(body.password)) return json(400, { error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` });

    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: body.password });
    if (pwErr) return json(400, { error: `ตั้งรหัสผ่านไม่สำเร็จ: ${pwErr.message}` });
    const { error: flagErr } = await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    if (flagErr) return json(400, { error: `ตั้งรหัสผ่านแล้ว แต่บันทึกสถานะบังคับเปลี่ยนรหัสไม่สำเร็จ: ${flagErr.message}` });
    return json(200, { ok: true });
  }

  // ---------- เปลี่ยนอีเมล (ชื่อที่ใช้เข้าสู่ระบบ) ของผู้ใช้ รวมถึงของผู้ดูแลระบบเอง ----------
  if (action === "update_email") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!userId) return json(400, { error: "ไม่พบผู้ใช้งานที่ต้องการ" });
    if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) return json(400, { error: "รูปแบบอีเมลไม่ถูกต้อง" });

    const { data: all } = await admin.from("profiles").select("id, email");
    const target = (all ?? []).find((p) => p.id === userId);
    if (!target) return json(404, { error: "ไม่พบผู้ใช้งานนี้" });
    if (target.email.toLowerCase() === email) return json(200, { ok: true, email: target.email });
    if ((all ?? []).some((p) => p.id !== userId && p.email.toLowerCase() === email)) {
      return json(409, { error: `อีเมล "${email}" ถูกใช้งานแล้ว` });
    }

    // เปลี่ยนที่บัญชีเข้าสู่ระบบก่อน (email_confirm ข้ามการส่งอีเมลยืนยัน) แล้วค่อยเปลี่ยนใน profiles
    // ถ้าขั้นหลังพัง ย้อนอีเมลบัญชีเข้าสู่ระบบกลับ จะได้ไม่เหลือสองฝั่งไม่ตรงกัน
    const oldEmail = target.email;
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (authErr) {
      const taken = /already|registered|exists/i.test(authErr.message);
      return json(taken ? 409 : 400, { error: taken ? `อีเมล "${email}" ถูกใช้งานแล้ว` : `เปลี่ยนอีเมลไม่สำเร็จ: ${authErr.message}` });
    }
    const { error: profErr } = await admin.from("profiles").update({ email }).eq("id", userId);
    if (profErr) {
      await admin.auth.admin.updateUserById(userId, { email: oldEmail, email_confirm: true });
      return json(400, { error: `เปลี่ยนอีเมลไม่สำเร็จ: ${profErr.message}` });
    }
    return json(200, { ok: true, email });
  }

  // ---------- ลบผู้ใช้ (ทั้ง profile และบัญชี Auth) ----------
  if (action === "delete") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) return json(400, { error: "ไม่พบผู้ใช้งานที่ต้องการ" });
    if (userId === caller.id) return json(400, { error: "ไม่สามารถลบบัญชีของตัวเองได้" });

    // ลบ profile ก่อน: ถ้าผู้ใช้เคยทำรายการ ฐานข้อมูลจะปฏิเสธด้วย foreign key (23503) และบัญชี Auth ยังอยู่ครบ
    const { error: profileErr } = await admin.from("profiles").delete().eq("id", userId);
    if (profileErr) {
      if (profileErr.code === "23503") {
        return json(409, { error: "ผู้ใช้งานนี้มีประวัติการทำรายการในระบบแล้ว จึงลบไม่ได้ กรุณาใช้การปิดการใช้งานแทน" });
      }
      return json(400, { error: `ลบผู้ใช้งานไม่สำเร็จ: ${profileErr.message}` });
    }
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr && !/not.*found/i.test(authErr.message)) {
      return json(400, { error: `ลบข้อมูลผู้ใช้แล้ว แต่ลบบัญชีเข้าสู่ระบบไม่สำเร็จ: ${authErr.message}` });
    }
    return json(200, { ok: true });
  }

  return json(400, { error: "ไม่รู้จักคำสั่งนี้" });
});
