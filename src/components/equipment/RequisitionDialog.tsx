"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, FormField } from "@/components/ui/Field";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { useStore } from "@/lib/store";
import { toastError, toastSuccess } from "@/lib/toast";

export function RequisitionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <RequisitionDialogForm onClose={onClose} />;
}

function RequisitionDialogForm({ onClose }: { onClose: () => void }) {
  const { createRequisition } = useActions();
  const user = useCurrentUser();
  const equipment = useStore((s) => s.equipment);
  const [equipmentId, setEquipmentId] = useState("");
  const [qty, setQty] = useState(1);
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = equipmentId ? equipment[equipmentId] : undefined;

  function handleSave() {
    if (!user) return;
    if (!equipmentId) {
      toastError("กรุณาเลือกอุปกรณ์ที่ต้องการเบิก");
      return;
    }
    if (qty <= 0) {
      toastError("จำนวนที่ขอเบิกต้องมากกว่า 0");
      return;
    }
    setSaving(true);
    try {
      createRequisition({
        requesterId: user.id,
        requesterName: user.name,
        department: department || undefined,
        equipmentId,
        qtyRequested: qty,
        reason: reason || undefined,
        note: note || undefined,
      });
      toastSuccess("ส่งคำขอเบิกอุปกรณ์เรียบร้อยแล้ว รอการอนุมัติ");
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="สร้างคำขอเบิกอุปกรณ์"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave} loading={saving}>
            ส่งคำขอ
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="อุปกรณ์" required>
          <EquipmentPicker onSelect={setEquipmentId} />
          {selected && (
            <p className="mt-2 text-sm text-[var(--color-on-surface)]">
              เลือกแล้ว: <span className="font-medium">{selected.name}</span> ({selected.code})
            </p>
          )}
        </FormField>
        <FormField label="จำนวนที่ขอเบิก" required>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </FormField>
        <FormField label="แผนก/ฝ่าย">
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="เช่น ฝ่ายผลิต, ฝ่ายคลังสินค้า" />
        </FormField>
        <FormField label="เหตุผลที่ขอเบิก">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ใช้สำหรับแพ็คสินค้ารอบเดือนนี้" />
        </FormField>
        <FormField label="หมายเหตุเพิ่มเติม">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>
    </Dialog>
  );
}
