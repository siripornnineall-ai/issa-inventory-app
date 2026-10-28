"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useStore, useActions } from "@/lib/store";
import type { AppState } from "@/lib/store/state";
import { useCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PinPad } from "@/components/account/PinPad";
import { PinSetupDialog } from "@/components/account/PinSetup";
import { toastError, toastSuccess } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { fetchAppState } from "@/lib/supabase/fetch";
import { PIN_LENGTH, PinError, hasPin, pinList, pinLogin, type PinUser } from "@/lib/supabase/pinAuth";
import { ROLE_LABEL_TH, type AppUser } from "@/lib/types";

type Mode = "loading" | "cards" | "pin" | "email";

// สีวงกลมตัวอักษรย่อของแต่ละคน (คงที่ตามชื่อ จะได้เห็นสีเดิมทุกครั้ง)
const AVATAR_COLORS = ["#0b3b44", "#b5651d", "#4f6f52", "#7a4e8c", "#a4453b", "#2f6690", "#8a6d1f", "#5b6770"];
function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// จำอีเมลของแต่ละคนไว้บนเครื่องนี้หลังเข้าด้วยรหัสผ่านสำเร็จ ครั้งหน้าแตะการ์ดชื่อแล้วกรอกแค่รหัสผ่าน (อีเมลไม่ถูกส่งมาจากเซิร์ฟเวอร์ตอนแสดงการ์ด)
const emailKey = (userId: string) => `issa-login-email:${userId}`;
function rememberedEmail(userId: string): string {
  try {
    return localStorage.getItem(emailKey(userId)) ?? "";
  } catch {
    return "";
  }
}
function rememberEmail(userId: string, email: string) {
  try {
    localStorage.setItem(emailKey(userId), email);
  } catch {
    // เก็บไม่ได้ก็แค่ต้องพิมพ์อีเมลใหม่รอบหน้า
  }
}

// ชวนตั้ง PIN หลังเข้าด้วยรหัสผ่าน: ถ้ากด "ไว้ทีหลัง" ไม่ถามอีก 7 วันบนเครื่องนี้
const PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const snoozeKey = (userId: string) => `issa-pin-prompt-snooze:${userId}`;
function snoozed(userId: string): boolean {
  try {
    const at = Number(localStorage.getItem(snoozeKey(userId)));
    return Number.isFinite(at) && Date.now() - at < PROMPT_SNOOZE_MS;
  } catch {
    return false;
  }
}
function snooze(userId: string) {
  try {
    localStorage.setItem(snoozeKey(userId), String(Date.now()));
  } catch {
    // เก็บไม่ได้ก็แค่ถามใหม่รอบหน้า
  }
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.4 }}>
      {name.trim().slice(0, 1)}
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const { login } = useActions();
  const [mode, setMode] = useState<Mode>("loading");
  const [cards, setCards] = useState<PinUser[]>([]);
  const [selected, setSelected] = useState<PinUser | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  // แตะการ์ดของคนที่ยังไม่ตั้ง PIN: พาไปเข้าด้วยอีเมลและรหัสผ่านครั้งแรก (เก็บชื่อไว้ทักทาย)
  const [firstTimeName, setFirstTimeName] = useState<{ name: string; admin: boolean } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // เข้าด้วยรหัสผ่านสำเร็จแล้ว รอผู้ใช้ตอบว่าจะตั้ง PIN ไหม ก่อนเข้าระบบจริง
  const [pendingPin, setPendingPin] = useState<{ state: AppState; profile: AppUser; password: string } | null>(null);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    let live = true;
    void pinList().then((list) => {
      if (!live) return;
      setCards(list);
      setMode(list.length > 0 ? "cards" : "email");
    });
    return () => {
      live = false;
    };
  }, []);

  function enter(state: AppState, profile: AppUser) {
    useStore.getState().actions.hydrate(state);
    login(profile.id);
    toastSuccess(`ยินดีต้อนรับ ${profile.name}`);
    router.replace("/dashboard");
  }

  // หลังได้เซสชัน (ไม่ว่าทางรหัสผ่านหรือ PIN): โหลดข้อมูล ตรวจว่ามีบัญชีและเปิดใช้งานอยู่ แล้วคืนข้อมูลให้ผู้เรียกเข้าระบบต่อ
  async function loadProfile(supabase: SupabaseClient, authUserId: string): Promise<{ state: AppState; profile: AppUser } | { error: string }> {
    const state = await fetchAppState(supabase);
    const profile = state.users[authUserId];
    if (!profile) {
      await supabase.auth.signOut();
      return { error: "ไม่พบข้อมูลผู้ใช้งานนี้ในระบบ" };
    }
    if (!profile.active) {
      await supabase.auth.signOut();
      return { error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
    }
    return { state, profile };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.user) {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      const loaded = await loadProfile(supabase, data.user.id);
      if ("error" in loaded) {
        setError(loaded.error);
        return;
      }
      const { state, profile } = loaded;
      rememberEmail(profile.id, email.trim());
      // ชวนตั้ง PIN เฉพาะพนักงานที่ยังไม่มี PIN (ผู้ดูแลระบบใช้ PIN ไม่ได้ / บัญชีที่ต้องเปลี่ยนรหัสผ่านก่อนให้ทำให้เสร็จก่อน)
      if (profile.role !== "admin" && !profile.mustChangePassword && !snoozed(profile.id) && !(await hasPin())) {
        setPendingPin({ state, profile, password });
        return;
      }
      enter(state, profile);
    } catch {
      toastError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  function chooseCard(card: PinUser) {
    // ผู้ดูแลระบบใช้ PIN ไม่ได้ และคนที่ยังไม่ตั้ง PIN: ไปใส่รหัสผ่าน (ถ้าเคยเข้าบนเครื่องนี้ มีอีเมลให้แล้ว)
    if (!card.hasPin || card.role === "admin") {
      setFirstTimeName({ name: card.name, admin: card.role === "admin" });
      setEmail(rememberedEmail(card.id));
      setPassword("");
      setError("");
      setMode("email");
      return;
    }
    setFirstTimeName(null);
    setSelected(card);
    setPin("");
    setPinError("");
    setPinLocked(false);
    setMode("pin");
  }

  async function submitPin(value: string) {
    if (!selected || pinBusy) return;
    setPinBusy(true);
    setPinError("");
    try {
      const tokens = await pinLogin(selected.id, value);
      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.setSession(tokens);
      if (sessionError || !data.user) throw new PinError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      const loaded = await loadProfile(supabase, data.user.id);
      if ("error" in loaded) {
        setPinError(loaded.error);
        setPin("");
        return;
      }
      enter(loaded.state, loaded.profile);
    } catch (e) {
      const err = e instanceof PinError ? e : new PinError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setPinError(err.status === 401 && err.attemptsLeft !== undefined ? `${err.message} (เหลืออีก ${err.attemptsLeft} ครั้งก่อนบัญชีถูกล็อก)` : err.message);
      if (err.status === 423 || err.status === 429) setPinLocked(true);
      setPin("");
    } finally {
      setPinBusy(false);
    }
  }

  function onPinChange(value: string) {
    setPin(value);
    if (value.length === PIN_LENGTH) void submitPin(value);
  }

  // ----- หน้าเลือกบัญชี / กรอก PIN -----
  if (mode === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--color-primary)] text-sm text-white/70">กำลังโหลด…</div>;
  }

  if (mode === "cards" || mode === "pin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-primary)] px-4 py-10">
        <div className="w-full max-w-md rounded-3xl bg-[var(--color-bg)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:p-8">
          <div className="text-center">
            <p className="text-xl font-semibold text-[var(--color-primary)]">ISSA Apparel</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">Haute Logic Inventory Management</p>
          </div>

          {mode === "cards" ? (
            <>
              <h1 className="mt-6 text-center text-2xl font-semibold text-[var(--color-on-surface)]">เลือกบัญชีของคุณ</h1>
              <p className="mt-1 text-center text-sm text-[var(--color-on-surface-variant)]">แตะชื่อของคุณ แล้วใส่ PIN {PIN_LENGTH} หลัก (ครั้งแรกเข้าด้วยอีเมลและรหัสผ่านที่ได้รับ แล้วตั้ง PIN)</p>
              <ul className="mt-6 flex max-h-[26rem] flex-col gap-2 overflow-y-auto">
                {cards.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => chooseCard(c)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                    >
                      <Avatar name={c.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[var(--color-on-surface)]">{c.name}</span>
                        <span className="block truncate text-xs text-[var(--color-on-surface-variant)]">
                          {ROLE_LABEL_TH[c.role] ?? c.role}
                          {c.role === "admin" ? (
                            <span className="ml-2 rounded-full bg-[var(--color-surface-container)] px-2 py-0.5 text-[10px] font-medium">เข้าด้วยรหัสผ่าน</span>
                          ) : (
                            !c.hasPin && <span className="ml-2 rounded-full bg-[var(--color-surface-container)] px-2 py-0.5 text-[10px] font-medium">ยังไม่ตั้ง PIN</span>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-on-surface-variant)]" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-center text-xs text-[var(--color-on-surface-variant)]">ไม่พบชื่อของคุณ? เข้าด้วยอีเมลและรหัสผ่านด้านล่าง</p>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setMode("email")}>
                เข้าด้วยอีเมลและรหัสผ่าน
              </Button>
            </>
          ) : (
            selected && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode("cards");
                    setPin("");
                    setPinError("");
                  }}
                  className="mt-4 flex items-center gap-1 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
                >
                  <ChevronLeft className="h-4 w-4" /> เปลี่ยนบัญชี
                </button>
                <div className="mt-2 flex flex-col items-center gap-2 text-center">
                  <Avatar name={selected.name} size={64} />
                  <h1 className="text-xl font-semibold text-[var(--color-on-surface)]">{selected.name}</h1>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{ROLE_LABEL_TH[selected.role] ?? selected.role}</p>
                  <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">ใส่ PIN {PIN_LENGTH} หลัก</p>
                </div>
                <div className="mt-5">
                  <PinPad value={pin} onChange={onPinChange} disabled={pinBusy || pinLocked} error={Boolean(pinError)} />
                </div>
                <div className="mt-4 min-h-[2.5rem] text-center">
                  {pinBusy ? (
                    <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังเข้าสู่ระบบ…</p>
                  ) : (
                    pinError && (
                      <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
                        {pinError}
                      </p>
                    )
                  )}
                </div>
                <button type="button" onClick={() => setMode("email")} className="mt-1 w-full text-center text-sm text-[var(--color-on-surface-variant)] underline">
                  ลืม PIN? เข้าด้วยอีเมลและรหัสผ่าน
                </button>
              </>
            )
          )}
        </div>
      </div>
    );
  }

  // ----- เข้าด้วยอีเมลและรหัสผ่าน -----
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-micro)] md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-[var(--color-primary)] p-10 text-white md:flex">
          <div>
            <p className="text-2xl font-semibold">ISSA Apparel</p>
            <p className="mt-1 text-sm text-white/60">Haute Logic Inventory Management</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <ShieldCheck className="h-5 w-5" /> แยกสต็อกสินค้าและอุปกรณ์ชัดเจน
            </div>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <ShieldCheck className="h-5 w-5" /> ตรวจสอบย้อนหลังได้ทุกการเคลื่อนไหว
            </div>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <ShieldCheck className="h-5 w-5" /> ควบคุมสิทธิ์ผู้ใช้งานตามบทบาท
            </div>
          </div>
          <p className="text-xs text-white/40">© 2569 ISSA Apparel — Haute Logic Inventory System</p>
        </div>

        <div className="flex flex-col justify-center p-8 md:p-10">
          {cards.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFirstTimeName(null);
                setMode("cards");
              }}
              className="mb-4 flex items-center gap-1 self-start text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            >
              <ChevronLeft className="h-4 w-4" /> กลับไปเลือกชื่อ
            </button>
          )}
          <h1 className="text-2xl font-semibold text-[var(--color-on-surface)]">เข้าสู่ระบบ</h1>
          {firstTimeName && (
            <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {firstTimeName.admin
                ? `สวัสดี ${firstTimeName.name} — ผู้ดูแลระบบเข้าด้วยอีเมลและรหัสผ่านเสมอ (ไม่ใช้ PIN)`
                : `สวัสดี ${firstTimeName.name} — ครั้งแรกเข้าด้วยอีเมลและรหัสผ่านที่ได้รับจากผู้ดูแลระบบ แล้วตั้ง PIN ${PIN_LENGTH} หลักของคุณเอง ครั้งต่อไปแตะชื่อแล้วใส่ PIN ได้เลย`}
            </p>
          )}
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">จัดการสต็อกสินค้าและอุปกรณ์ของ ISSA Apparel</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-on-surface)]">อีเมล</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-on-surface)]">รหัสผ่าน</label>
              <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>}
            <Button type="submit" size="lg" className="mt-2 w-full" loading={loading}>
              เข้าสู่ระบบ
            </Button>
          </form>

          <p className="mt-6 text-xs text-[var(--color-on-surface-variant)]">ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อตั้งรหัสผ่านใหม่</p>
        </div>
      </div>

      <PinSetupDialog
        open={pendingPin !== null}
        prompt
        password={pendingPin?.password}
        onClose={() => {
          // ปิดโดยไม่ตั้ง (ไว้ทีหลัง) แล้วเข้าระบบต่อ ถ้าตั้งสำเร็จก็ปิดแบบเดียวกัน
          if (pendingPin) {
            snooze(pendingPin.profile.id);
            enter(pendingPin.state, pendingPin.profile);
            setPendingPin(null);
          }
        }}
      />
    </div>
  );
}
