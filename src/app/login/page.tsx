"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { toastError, toastSuccess } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { fetchAppState } from "@/lib/supabase/fetch";

export default function LoginPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const { login } = useActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required />
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

          <p className="mt-6 text-xs text-[var(--color-on-surface-variant)]">ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อตั้งรหัสผ่านใหม่</p>
        </div>
      </div>
    </div>
  );
}
