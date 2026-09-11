"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { ROLE_LABEL_TH } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { toastError, toastSuccess } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { fetchAppState } from "@/lib/supabase/fetch";

const DEMO_PASSWORD = "issa2024";

const DEMO_ACCOUNTS = [
  { email: "admin@issa.demo", role: "admin" as const },
  { email: "manager@issa.demo", role: "manager" as const },
  { email: "warehouse@issa.demo", role: "warehouse" as const },
  { email: "sales@issa.demo", role: "sales" as const },
  { email: "viewer@issa.demo", role: "viewer" as const },
];

export default function LoginPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const { login } = useActions();
  const [email, setEmail] = useState("admin@issa.demo");
  const [password, setPassword] = useState("issa2024");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

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

      const state = await fetchAppState(supabase);
      const profile = state.users[data.user.id];
      if (!profile) {
        setError("ไม่พบข้อมูลผู้ใช้งานนี้ในระบบ");
        await supabase.auth.signOut();
        return;
      }
      if (!profile.active) {
        setError("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
        await supabase.auth.signOut();
        return;
      }

      useStore.getState().actions.hydrate(state);
      login(profile.id);
      toastSuccess(`ยินดีต้อนรับ ${profile.name}`);
      router.replace("/dashboard");
    } catch {
      toastError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-2xl font-semibold text-[var(--color-on-surface)]">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">จัดการสต็อกสินค้าและอุปกรณ์ของ ISSA Apparel</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-on-surface)]">อีเมล</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@issa.demo" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-on-surface)]">รหัสผ่าน</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>}
            <Button type="submit" size="lg" className="mt-2 w-full" loading={loading}>
              เข้าสู่ระบบ
            </Button>
          </form>

          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--color-on-surface-variant)]">
              <span className="uppercase">บัญชีทดลองใช้ — รหัสผ่าน:</span> <span className="font-mono normal-case">{DEMO_PASSWORD}</span>
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex flex-col rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-xs hover:border-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
                >
                  <span className="font-medium text-[var(--color-on-surface)]">{ROLE_LABEL_TH[a.role]}</span>
                  <span className="text-[var(--color-on-surface-variant)]">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
