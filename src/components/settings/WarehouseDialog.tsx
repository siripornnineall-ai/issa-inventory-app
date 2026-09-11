"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormField } from "@/components/ui/Field";
import { useActions } from "@/lib/store";
import type { Warehouse } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";

const TYPE_LABEL: Record<Warehouse["type"], string> = {
  main: "คลังหลัก",
  office: "สำนักงาน",
  store: "หน้าร้าน",
  other: "อื่น ๆ",
};

interface WarehouseDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: Warehouse;
}

export function WarehouseDialog(props: WarehouseDialogProps) {
  if (!props.open) return null;
  return <WarehouseDialogForm {...props} />;
}

function WarehouseDialogForm({ open, onClose, existing }: WarehouseDialogProps) {
  const { upsertWarehouse } = useActions();
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<Warehouse["type"]>(existing?.type ?? "store");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!name.trim()) {
      toastError("กรุณาระบุชื่อคลัง");
      return;
    }
    setSaving(true);
    try {
      upsertWarehouse({ id: existing?.id, name: name.trim(), type, address: address || undefined, active });
      toastSuccess(existing ? "แก้ไขข้อมูลคลังเรียบร้อยแล้ว" : "เพิ่มคลังใหม่เรียบร้อยแล้ว");
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
      title={existing ? "แก้ไขคลัง" : "เพิ่มคลังใหม่"}
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
        <FormField label="ชื่อคลัง" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="ประเภท">
          <Select value={type} onChange={(e) => setType(e.target.value as Warehouse["type"])}>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="ที่อยู่">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
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
