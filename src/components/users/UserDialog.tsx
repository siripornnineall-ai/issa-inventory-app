"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormField } from "@/components/ui/Field";
import { useActions } from "@/lib/store";
import type { AppUser, UserRole } from "@/lib/types";
import { ROLE_LABEL_TH } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: AppUser;
}

export function UserDialog(props: UserDialogProps) {
  if (!props.open) return null;
  return <UserDialogForm {...props} />;
}

function UserDialogForm({ open, onClose, existing }: UserDialogProps) {
  const { upsertUser } = useActions();
  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState<UserRole>(existing?.role ?? "viewer");
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!name.trim()) {
      toastError("กรุณาระบุชื่อผู้ใช้งาน");
      return;
    }
    if (!email.trim()) {
      toastError("กรุณาระบุอีเมล");
      return;
    }
    setSaving(true);
    try {
      upsertUser({ id: existing?.id, name: name.trim(), email: email.trim(), role, active });
      toastSuccess(existing ? "แก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว" : "เพิ่มผู้ใช้งานใหม่เรียบร้อยแล้ว");
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
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
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="อีเมล" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="บทบาท">
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {Object.entries(ROLE_LABEL_TH).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="สถานะการใช้งาน">
          <Select value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
            <option value="1">ใช้งานอยู่</option>
            <option value="0">ปิดการใช้งาน</option>
          </Select>
        </FormField>
      </div>
    </Dialog>
  );
}
