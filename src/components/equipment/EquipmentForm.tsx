"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { useStore, useActions } from "@/lib/store";
import type { Equipment, EquipmentType, EquipmentUnit, ProductImage } from "@/lib/types";
import { EQUIPMENT_TYPE_LABEL_TH } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";

const UNIT_OPTIONS: EquipmentUnit[] = ["ชิ้น", "ใบ", "ตัว", "ม้วน", "กล่อง", "แพ็ก", "คู่", "ชุด", "เมตร", "กิโลกรัม"];

export function EquipmentForm({ existing }: { existing?: Equipment }) {
  const router = useRouter();
  const suppliers = useStore((s) => s.suppliers);
  const equipmentTypeOptions = useStore((s) => s.equipmentTypeOptions);
  const { createEquipment, updateEquipment, upsertEquipmentType } = useActions();
  const isEdit = Boolean(existing);

  const typeOptions = useMemo(() => {
    const fromRegistry = Object.values(equipmentTypeOptions).sort((a, b) => a.sortOrder - b.sortOrder);
    if (fromRegistry.length > 0) return fromRegistry.map((t) => ({ code: t.code, label: t.labelTh }));
    return Object.entries(EQUIPMENT_TYPE_LABEL_TH).map(([code, label]) => ({ code, label }));
  }, [equipmentTypeOptions]);

  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<EquipmentType>(existing?.type ?? "packaging");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeCode, setNewTypeCode] = useState("");
  const [addingType, setAddingType] = useState(false);

  function handleAddType() {
    if (!newTypeLabel.trim()) {
      toastError("กรุณาระบุชื่อประเภทอุปกรณ์");
      return;
    }
    setAddingType(true);
    try {
      const savedCode = upsertEquipmentType(newTypeCode, newTypeLabel);
      setType(savedCode);
      setNewTypeLabel("");
      setNewTypeCode("");
      toastSuccess("เพิ่มประเภทอุปกรณ์ใหม่เรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setAddingType(false);
    }
  }
  const [description, setDescription] = useState(existing?.description ?? "");
  const [images, setImages] = useState<ProductImage[]>(existing?.images ?? []);
  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? "");
  const [purchasePricePerUnit, setPurchasePricePerUnit] = useState(existing?.purchasePricePerUnit ?? 0);
  const [unit, setUnit] = useState<EquipmentUnit>(existing?.unit ?? "ชิ้น");
  const [reorderPoint, setReorderPoint] = useState(existing?.reorderPoint ?? 10);
  const [reorderQty, setReorderQty] = useState(existing?.reorderQty ?? 50);
  const [storageLocation, setStorageLocation] = useState(existing?.storageLocation ?? "");
  const [status, setStatus] = useState<Equipment["status"]>(existing?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useUnsavedChangesGuard(!submitted && (name.trim().length > 0 || images.length > 0));

  function validate(): string | null {
    if (!name.trim()) return "กรุณาระบุชื่ออุปกรณ์";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toastError(err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        description: description || undefined,
        images,
        supplierId: supplierId || undefined,
        purchasePricePerUnit,
        unit,
        reorderPoint,
        reorderQty,
        storageLocation: storageLocation || undefined,
        status,
      };
      if (isEdit && existing) {
        updateEquipment(existing.id, payload);
        setSubmitted(true);
        toastSuccess("บันทึกการแก้ไขอุปกรณ์เรียบร้อยแล้ว");
        router.replace(`/equipment/${existing.id}`);
      } else {
        const id = createEquipment(payload);
        setSubmitted(true);
        toastSuccess("เพิ่มอุปกรณ์ใหม่เรียบร้อยแล้ว");
        router.replace(`/equipment/${id}`);
      }
    } catch (e2) {
      toastError(e2 instanceof Error ? e2.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลอุปกรณ์</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:gap-4">
          <FormField label="ชื่ออุปกรณ์" required className="col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="ประเภท" className="col-span-2">
            <Select value={type} onChange={(e) => setType(e.target.value as EquipmentType)}>
              {typeOptions.map(({ code: value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex gap-2">
              <Input
                value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)}
                placeholder="เพิ่มประเภทใหม่ เช่น ถุงใส"
                className="flex-1"
              />
              <Input
                value={newTypeCode}
                onChange={(e) => setNewTypeCode(e.target.value)}
                placeholder="รหัส (ไม่บังคับ)"
                className="w-32"
              />
              <Button type="button" variant="secondary" onClick={handleAddType} loading={addingType}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </FormField>
          <FormField label="หน่วยนับ">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as EquipmentUnit)}>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="ผู้ผลิต / ซัพพลายเออร์">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {Object.values(suppliers).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="ราคาต่อหน่วย (บาท)">
            <Input type="number" min={0} step="0.01" value={purchasePricePerUnit} onChange={(e) => setPurchasePricePerUnit(Number(e.target.value))} />
          </FormField>
          <FormField label="จุดแจ้งเตือนใกล้หมด">
            <Input type="number" min={0} value={reorderPoint} onChange={(e) => setReorderPoint(Number(e.target.value))} />
          </FormField>
          <FormField label="จำนวนที่ควรสั่งซื้อเพิ่ม">
            <Input type="number" min={0} value={reorderQty} onChange={(e) => setReorderQty(Number(e.target.value))} />
          </FormField>
          <FormField label="ตำแหน่งจัดเก็บ">
            <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
          </FormField>
          <FormField label="สถานะ">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Equipment["status"])}>
              <option value="active">ใช้งานอยู่</option>
              <option value="inactive">ปิดการใช้งาน</option>
            </Select>
          </FormField>
          <FormField label="รายละเอียด" className="col-span-2">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="col-span-2">
            <ImageUploader images={images} onChange={setImages} kind="selling" label="รูปภาพอุปกรณ์" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-8">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          ยกเลิก
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? "บันทึกการแก้ไข" : "บันทึกอุปกรณ์ใหม่"}
        </Button>
      </div>
    </form>
  );
}
