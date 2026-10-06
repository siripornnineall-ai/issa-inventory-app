"use client";

import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/supabase/adminUsers";
import { useStore, useActions } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";

// เปลี่ยนรหัสผ่านของ "ตัวเอง" มี 2 โหมด:
// - ปกติ (เมนูโปรไฟล์ → เปลี่ยนรหัสผ่าน): ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตนก่อน
// - บังคับ (forced): ผู้ดูแลระบบเพิ่งสร้างบัญชี/ตั้งรหัสให้ เพิ่งล็อกอินด้วยรหัสชั่วคราวมา จึงไม่ถามรหัสเดิมซ้ำ
function useChangePassword(forced: boolean, onDone: () => void) {
  const user = useCurrentUser();
  const { mergeUser } = useActions();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user) return;
    setError("");
    if (!forced && !current) return setError("กรุณากรอกรหัสผ่านปัจจุบัน");
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
    if (next !== confirm) return setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    if (!forced && next === current) return setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน");

    setSaving(true);
    try {
      const supabase = createClient();
      if (!forced) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
        if (verifyErr) {
          setError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
          return;
        }
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) {
        const same = /different|same/i.test(updateErr.message);
        setError(same ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" : `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${updateErr.message}`);
        return;
      }
      if (user.mustChangePassword) {
        const { error: flagErr } = await supabase.rpc("clear_must_change_password");
        if (flagErr) {
          setError(`เปลี่ยนรหัสผ่านแล้ว แต่บันทึกสถานะไม่สำเร็จ: ${flagErr.message}`);
          return;
        }
        mergeUser({ ...user, mustChangePassword: undefined });
      }
      toastSuccess("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
      onDone();
    } catch {
      toastError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <div className="grid grid-cols-1 gap-4">
      {!forced && (
        <FormField label="รหัสผ่านปัจจุบัน" required>
          <PasswordInput id="cp-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FormField>
      )}
      <FormField label="รหัสผ่านใหม่" required hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}>
        <PasswordInput id="cp-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </FormField>
      <FormField label="ยืนยันรหัสผ่านใหม่" required>
        <PasswordInput id="cp-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      {error && <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>}
    </div>
  );

  return { fields, submit, saving };
}

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <ChangePasswordDialogInner onClose={onClose} />;
}

function ChangePasswordDialogInner({ onClose }: { onClose: () => void }) {
  const { fields, submit, saving } = useChangePassword(false, onClose);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="เปลี่ยนรหัสผ่าน"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit} loading={saving}>
            บันทึกรหัสผ่านใหม่
          </Button>
        </>
      }
    >
      {fields}
    </Dialog>
  );
}

// หน้าจอเต็มที่ AppShell แสดงแทนทั้งระบบ เมื่อบัญชีถูกตั้งธง mustChangePassword — ออกได้ทางเดียวคือตั้งรหัสใหม่หรือออกจากระบบ
export function ForcePasswordChange() {
  const user = useCurrentUser();
  const router = useRouter();
  const { logout } = useActions();
  const { fields, submit, saving } = useChangePassword(true, () => {});

  async function signOut() {
    await createClient().auth.signOut();
    useStore.getState().actions.hydrate(emptyState());
    logout();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-[var(--shadow-micro)]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-container)] text-[var(--color-primary-container)]">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-[var(--color-on-surface)]">ตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน</h1>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          สวัสดี {user?.name} — รหัสผ่านที่ได้รับจากผู้ดูแลระบบเป็นรหัสชั่วคราว กรุณาตั้งรหัสผ่านของคุณเองเพื่อความปลอดภัย
        </p>
        <div className="mt-6">{fields}</div>
        <Button type="submit" size="lg" className="mt-6 w-full" loading={saving}>
          บันทึกและเข้าใช้งาน
        </Button>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
        >
          <LogOut className="h-4 w-4" /> ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
