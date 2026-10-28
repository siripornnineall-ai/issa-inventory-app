"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PIN_LENGTH, PinError, hasPin, pinClear, pinSet, validPinFormat, weakPinReason } from "@/lib/supabase/pinAuth";
import { toastError, toastSuccess } from "@/lib/toast";

// ตั้ง/เปลี่ยน/ลบ PIN เข้าสู่ระบบของตัวเอง
// - prompt: ชวนตั้งหลังเข้าด้วยรหัสผ่านสำเร็จ (รู้รหัสผ่านอยู่แล้วจึงไม่ถามซ้ำ) มีปุ่ม "ไว้ทีหลัง"
// - ปกติ (เมนูโปรไฟล์): ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน และลบ PIN ได้ถ้าเคยตั้งไว้
export function PinSetupDialog({
  open,
  onClose,
  password,
  prompt,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  password?: string;
  prompt?: boolean;
  onSaved?: () => void;
}) {
  if (!open) return null;
  return <PinSetupInner onClose={onClose} knownPassword={password} prompt={prompt} onSaved={onSaved} />;
}

function PinSetupInner({ onClose, knownPassword, prompt, onSaved }: { onClose: () => void; knownPassword?: string; prompt?: boolean; onSaved?: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [alreadySet, setAlreadySet] = useState(false);

  useEffect(() => {
    if (prompt) return;
    let live = true;
    void hasPin().then((v) => live && setAlreadySet(v));
    return () => {
      live = false;
    };
  }, [prompt]);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, PIN_LENGTH);

  async function submit() {
    setError("");
    if (!validPinFormat(pin)) return setError(`PIN ต้องเป็นตัวเลข ${PIN_LENGTH} หลัก`);
    const weak = weakPinReason(pin);
    if (weak) return setError(weak);
    if (pin !== confirm) return setError("PIN ทั้งสองช่องไม่ตรงกัน");
    const pw = knownPassword ?? password;
    if (!pw) return setError("กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน");
    setSaving(true);
    try {
      await pinSet(pin, pw);
      toastSuccess("ตั้ง PIN เรียบร้อยแล้ว คราวหน้าเลือกชื่อตัวเองแล้วใส่ PIN เข้าระบบได้เลย");
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof PinError ? e.message : "ตั้ง PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await pinClear();
      toastSuccess("ลบ PIN แล้ว ต่อไปเข้าด้วยอีเมลและรหัสผ่าน");
      onClose();
    } catch (e) {
      toastError(e instanceof PinError ? e.message : "ลบ PIN ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={prompt ? "ตั้ง PIN เพื่อเข้าระบบเร็วขึ้น" : alreadySet ? "เปลี่ยน PIN เข้าระบบ" : "ตั้ง PIN เข้าระบบ"}
      description={`ครั้งหน้าเลือกชื่อของคุณบนหน้าเข้าสู่ระบบแล้วใส่ PIN ${PIN_LENGTH} หลัก ไม่ต้องพิมพ์อีเมลและรหัสผ่าน`}
      footer={
        <>
          {!prompt && alreadySet && (
            <Button variant="ghost" onClick={remove} loading={saving} className="mr-auto text-[var(--color-danger)]">
              ลบ PIN
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {prompt ? "ไว้ทีหลัง" : "ยกเลิก"}
          </Button>
          <Button onClick={submit} loading={saving}>
            {alreadySet ? "บันทึก PIN ใหม่" : "ตั้ง PIN"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label={`PIN ${PIN_LENGTH} หลัก`} required hint="ห้ามเป็นเลขซ้ำ เลขเรียง หรือเลขที่เดาง่าย เช่น 123456">
          <Input id="pin-new" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={pin} onChange={(e) => setPin(digits(e.target.value))} />
        </FormField>
        <FormField label="ยืนยัน PIN อีกครั้ง" required>
          <Input id="pin-confirm" type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={confirm} onChange={(e) => setConfirm(digits(e.target.value))} />
        </FormField>
        {knownPassword === undefined && (
          <FormField label="รหัสผ่านปัจจุบัน" required hint="กรอกเพื่อยืนยันว่าเป็นคุณจริง">
            <PasswordInput id="pin-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
