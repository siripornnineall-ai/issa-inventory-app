"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormField } from "@/components/ui/Field";
import { useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { adminCreateUser, adminResetPassword, adminUpdateEmail, generateTempPassword, MIN_PASSWORD_LENGTH } from "@/lib/supabase/adminUsers";
import type { AppUser, UserRole } from "@/lib/types";
import { ROLE_LABEL_TH } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: AppUser;
  // เปิดหน้าต่างเปลี่ยนรหัสผ่านของตัวเอง — แสดงปุ่มในหน้าต่างนี้เฉพาะตอนแก้ไขบัญชีของตัวเอง
  onChangeOwnPassword?: () => void;
}

export function UserDialog(props: UserDialogProps) {
  if (!props.open) return null;
  return <UserDialogForm {...props} />;
}

// ช่องรหัสผ่านชั่วคราว: แสดง/ซ่อนได้ และมีปุ่มสุ่มให้ — ผู้ดูแลระบบต้องจดไปบอกพนักงานเอง ระบบไม่ส่งอีเมลให้
function TempPasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(true);
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        className="font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="shrink-0 rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange(generateTempPassword())}>
        <RefreshCw className="h-3.5 w-3.5" /> สุ่ม
      </Button>
    </div>
  );
}

function UserDialogForm({ open, onClose, existing, onChangeOwnPassword }: UserDialogProps) {
  const { upsertUser, mergeUser } = useActions();
  const currentUser = useCurrentUser();
  const isAdmin = hasPermission(currentUser?.role, "user.admin");
  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState<UserRole>(existing?.role ?? "viewer");
  const [active, setActive] = useState(existing?.active ?? true);
  const [password, setPassword] = useState(() => (existing ? "" : generateTempPassword()));
  const [resetPassword, setResetPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isSelf = existing !== undefined && existing.id === currentUser?.id;
  const canResetOther = isAdmin && existing !== undefined && existing.id !== currentUser?.id;

  async function handleSave() {
    if (!name.trim()) {
      toastError("กรุณาระบุชื่อผู้ใช้งาน");
      return;
    }
    if (!email.trim()) {
      toastError("กรุณาระบุอีเมล");
      return;
    }
    if (!existing && password.length < MIN_PASSWORD_LENGTH) {
      toastError(`รหัสผ่านชั่วคราวต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const emailChanged = isAdmin && email.trim().toLowerCase() !== existing.email.toLowerCase();
        if (emailChanged) {
          // อีเมลคือชื่อที่ใช้เข้าสู่ระบบ ต้องเปลี่ยนที่บัญชีเข้าสู่ระบบจริงผ่านเซิร์ฟเวอร์ก่อน แล้วค่อยอัปเดต state ในเครื่อง
          const savedEmail = await adminUpdateEmail(existing.id, email.trim());
          mergeUser({ ...existing, email: savedEmail });
        }
        upsertUser({ id: existing.id, name: name.trim(), role, active });
        toastSuccess(emailChanged ? "เปลี่ยนอีเมลแล้ว ล็อกอินครั้งถัดไปให้ใช้อีเมลใหม่" : "แก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว");
      } else {
        // ผู้ใช้ใหม่ต้องมีบัญชีเข้าสู่ระบบจริงด้วย จึงสร้างผ่านเซิร์ฟเวอร์ (Edge Function) แล้วค่อยเพิ่มเข้า state ในเครื่อง
        const created = await adminCreateUser({ name: name.trim(), email: email.trim(), role, password });
        mergeUser(created);
        toastSuccess(`เพิ่ม "${created.name}" แล้ว — แจ้งรหัสผ่านชั่วคราวให้เจ้าตัว ระบบจะบังคับให้ตั้งรหัสใหม่เมื่อเข้าครั้งแรก`);
      }
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!existing) return;
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      toastError(`รหัสผ่านชั่วคราวต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    setResetting(true);
    try {
      await adminResetPassword(existing.id, resetPassword);
      mergeUser({ ...existing, mustChangePassword: true });
      toastSuccess(`ตั้งรหัสผ่านใหม่ให้ "${existing.name}" แล้ว — เจ้าตัวต้องตั้งรหัสของตัวเองเมื่อเข้าระบบครั้งถัดไป`);
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave} loading={saving}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <FormField label="ชื่อ-นามสกุล" required>
          <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="อีเมล" required hint={existing ? (isAdmin ? "อีเมลคือชื่อที่ใช้เข้าสู่ระบบ เปลี่ยนแล้วต้องใช้อีเมลใหม่ล็อกอินครั้งถัดไป" : "เฉพาะผู้ดูแลระบบเปลี่ยนอีเมลได้") : "ใช้เป็นชื่อเข้าสู่ระบบ"}>
          <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={existing !== undefined && !isAdmin} />
        </FormField>
        <FormField label="บทบาท">
          <Select id="user-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {Object.entries(ROLE_LABEL_TH).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        {existing ? (
          <FormField label="สถานะการใช้งาน">
            <Select id="user-active" value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
              <option value="1">ใช้งานอยู่</option>
              <option value="0">ปิดการใช้งาน</option>
            </Select>
          </FormField>
        ) : (
          <FormField
            label="รหัสผ่านชั่วคราว"
            required
            hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร — จดไว้แจ้งเจ้าตัว เมื่อเข้าระบบครั้งแรกจะถูกบังคับให้ตั้งรหัสผ่านใหม่เอง`}
          >
            <TempPasswordInput id="user-temp-password" value={password} onChange={setPassword} />
          </FormField>
        )}

        {isSelf && onChangeOwnPassword && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-medium text-[var(--color-on-surface)]">รหัสผ่านของคุณ</p>
            <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">เปลี่ยนรหัสผ่านที่ใช้เข้าสู่ระบบ ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยัน</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                onClose();
                onChangeOwnPassword();
              }}
            >
              เปลี่ยนรหัสผ่าน
            </Button>
          </div>
        )}

        {canResetOther && (
          <div className="mt-2 rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-medium text-[var(--color-on-surface)]">ตั้งรหัสผ่านใหม่ให้ผู้ใช้นี้</p>
            <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
              ใช้เมื่อผู้ใช้ลืมรหัสผ่าน{existing?.mustChangePassword ? " — ตอนนี้บัญชีนี้ยังรอเจ้าตัวตั้งรหัสผ่านใหม่อยู่" : ""}
            </p>
            <div className="mt-3">
              <TempPasswordInput id="user-reset-password" value={resetPassword} onChange={setResetPassword} />
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={handleResetPassword} loading={resetting} disabled={!resetPassword}>
              ตั้งรหัสผ่านใหม่
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
