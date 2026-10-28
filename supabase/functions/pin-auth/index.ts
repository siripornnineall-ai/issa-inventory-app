// Edge Function: pin-auth
// เข้าสู่ระบบด้วย PIN 6 หลัก (ช่องทางเสริมของอีเมล+รหัสผ่าน) ตรวจ PIN ฝั่งเซิร์ฟเวอร์เท่านั้น
//   list  (ไม่ต้องเข้าสู่ระบบ) รายชื่อการ์ดบนหน้าเข้าสู่ระบบ: ผู้ใช้ที่เปิดใช้งานทุกคนที่ไม่ใช่ผู้ดูแลระบบ (ชื่อ+ตำแหน่ง+ตั้ง PIN แล้วหรือยัง ไม่มีอีเมล)
//   login (ไม่ต้องเข้าสู่ระบบ) ตรวจ PIN แล้วออกเซสชัน: ผิดครบ 5 ครั้งล็อกบัญชี 15 นาที และจำกัดการลองผิดต่อ IP
//   set   (ต้องเข้าสู่ระบบ)   ตั้ง/เปลี่ยน PIN ของตัวเอง ต้องยืนยันรหัสผ่านปัจจุบันด้วย
//   clear (ต้องเข้าสู่ระบบ)   ลบ PIN ของตัวเอง
// ผู้ดูแลระบบ (admin) ใช้ PIN ไม่ได้ ต้องใช้รหัสผ่านเต็มเสมอ
// เซสชันออกด้วย magic link ฝั่งเซิร์ฟเวอร์ (ไม่แตะรหัสผ่านของผู้ใช้) service role key มาจาก environment ของ Supabase เอง
// deploy ด้วย verify_jwt = false เพราะ list/login เรียกก่อนเข้าสู่ระบบ ส่วน set/clear ตรวจ JWT เองด้านล่าง
import { createClient } from "npm:@supabase/supabase-js@2";
import { IP_FAIL_LIMIT, IP_WINDOW_MINUTES, hashPin, lockMinutesLeft, nextFailState, validPinFormat, verifyPin, weakPinReason, MAX_FAILED, PIN_LENGTH } from "./pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const WRONG = "PIN ไม่ถูกต้อง";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "รองรับเฉพาะ POST" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !anonKey) return json(500, { error: "ระบบยังไม่ได้ตั้งค่า" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "รูปแบบข้อมูลไม่ถูกต้อง" });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const action = body.action;

  // ---------- รายชื่อการ์ด ----------
  if (action === "list") {
    const [{ data: profiles }, { data: pins }] = await Promise.all([
      admin.from("profiles").select("id, name, role").eq("active", true).neq("role", "admin").order("name"),
      admin.from("user_pins").select("user_id"),
    ]);
    const withPin = new Set((pins ?? []).map((p) => p.user_id as string));
    return json(200, { users: (profiles ?? []).map((p) => ({ id: p.id, name: p.name, role: p.role, hasPin: withPin.has(p.id) })) });
  }

  // ---------- เข้าสู่ระบบด้วย PIN ----------
  if (action === "login") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId || !validPinFormat(body.pin)) return json(401, { error: WRONG });

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000).toISOString();
    const { count: recentFails } = await admin.from("pin_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since);
    if ((recentFails ?? 0) >= IP_FAIL_LIMIT) return json(429, { error: `ลองผิดหลายครั้งเกินไป กรุณารอ ${IP_WINDOW_MINUTES} นาทีแล้วลองใหม่ หรือเข้าด้วยอีเมลและรหัสผ่าน` });

    const recordFailure = async () => {
      await admin.from("pin_attempts").insert({ ip });
      if (Math.random() < 0.05) await admin.from("pin_attempts").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
    };

    const { data: profile } = await admin.from("profiles").select("id, email, role, active").eq("id", userId).maybeSingle();
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash, failed_count, locked_until").eq("user_id", userId).maybeSingle();
    // ไม่บอกว่าผิดเพราะไม่มีบัญชี/ไม่ได้ตั้ง PIN/ถูกปิดใช้งาน กันคนนอกไล่สำรวจ
    if (!profile || !pinRow || !profile.active || profile.role === "admin") {
      await recordFailure();
      return json(401, { error: WRONG });
    }

    const now = new Date();
    const left = lockMinutesLeft(pinRow.locked_until, now);
    if (left > 0) return json(423, { error: `บัญชีนี้ถูกล็อกชั่วคราวเพราะใส่ PIN ผิดหลายครั้ง กรุณารออีก ${left} นาที หรือเข้าด้วยอีเมลและรหัสผ่าน`, minutesLeft: left });

    const ok = await verifyPin(body.pin, pinRow.pin_hash);
    if (!ok) {
      const next = nextFailState(pinRow.failed_count ?? 0, now);
      await admin.from("user_pins").update({ failed_count: next.failedCount, locked_until: next.lockedUntil?.toISOString() ?? null }).eq("user_id", userId);
      await recordFailure();
      if (next.lockedUntil) return json(423, { error: `ใส่ PIN ผิด ${MAX_FAILED} ครั้ง บัญชีนี้ถูกล็อกชั่วคราว กรุณารอสักครู่ หรือเข้าด้วยอีเมลและรหัสผ่าน`, minutesLeft: lockMinutesLeft(next.lockedUntil, now) });
      return json(401, { error: WRONG, attemptsLeft: MAX_FAILED - next.failedCount });
    }

    await admin.from("user_pins").update({ failed_count: 0, locked_until: null }).eq("user_id", userId);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) return json(500, { error: "สร้างเซสชันไม่สำเร็จ กรุณาเข้าด้วยอีเมลและรหัสผ่าน" });
    const { data: session, error: verifyErr } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (verifyErr || !session?.session) return json(500, { error: "สร้างเซสชันไม่สำเร็จ กรุณาเข้าด้วยอีเมลและรหัสผ่าน" });
    return json(200, { session: { access_token: session.session.access_token, refresh_token: session.session.refresh_token } });
  }

  // ---------- ตั้ง/ลบ PIN ของตัวเอง (ต้องเข้าสู่ระบบ) ----------
  if (action === "set" || action === "clear" || action === "admin_clear") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^bearer /i, "");
    if (!token) return json(401, { error: "กรุณาเข้าสู่ระบบก่อน" });
    const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
    const caller = callerData?.user;
    if (callerErr || !caller) return json(401, { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });

    // ผู้ดูแลระบบล้าง PIN ของพนักงาน (ลืม PIN หรือบัญชีถูกล็อก): พนักงานต้องตั้ง PIN ใหม่เองหลังเข้าด้วยรหัสผ่าน
    if (action === "admin_clear") {
      const { data: callerProfile } = await admin.from("profiles").select("role, active").eq("id", caller.id).maybeSingle();
      if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.active) return json(403, { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่ทำรายการนี้ได้" });
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!userId) return json(400, { error: "ไม่พบผู้ใช้งานที่ต้องการ" });
      const { error } = await admin.from("user_pins").delete().eq("user_id", userId);
      return error ? json(400, { error: `ล้าง PIN ไม่สำเร็จ: ${error.message}` }) : json(200, { ok: true });
    }

    if (action === "clear") {
      const { error } = await admin.from("user_pins").delete().eq("user_id", caller.id);
      return error ? json(400, { error: `ลบ PIN ไม่สำเร็จ: ${error.message}` }) : json(200, { ok: true });
    }

    const { data: profile } = await admin.from("profiles").select("role, active, email").eq("id", caller.id).maybeSingle();
    if (!profile || !profile.active) return json(403, { error: "บัญชีนี้ใช้งานไม่ได้" });
    if (profile.role === "admin") return json(403, { error: "ผู้ดูแลระบบต้องเข้าด้วยอีเมลและรหัสผ่านเท่านั้น ตั้ง PIN ไม่ได้" });
    if (!validPinFormat(body.pin)) return json(400, { error: `PIN ต้องเป็นตัวเลข ${PIN_LENGTH} หลัก` });
    const weak = weakPinReason(body.pin);
    if (weak) return json(400, { error: weak });
    if (typeof body.password !== "string" || !body.password) return json(400, { error: "กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน" });

    const { error: pwErr } = await anon.auth.signInWithPassword({ email: profile.email, password: body.password });
    if (pwErr) return json(401, { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });

    const { error } = await admin.from("user_pins").upsert({ user_id: caller.id, pin_hash: await hashPin(body.pin), failed_count: 0, locked_until: null, updated_at: new Date().toISOString() });
    return error ? json(400, { error: `ตั้ง PIN ไม่สำเร็จ: ${error.message}` }) : json(200, { ok: true });
  }

  return json(400, { error: "ไม่รู้จักคำสั่งนี้" });
});
