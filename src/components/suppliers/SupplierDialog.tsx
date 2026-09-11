"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { useStore, useActions } from "@/lib/store";
import type { ProductImage, Supplier, SupplierCategory } from "@/lib/types";
import { SUPPLIER_CATEGORY_LABEL_TH } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";

interface SupplierDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: Supplier;
}

export function SupplierDialog(props: SupplierDialogProps) {
  if (!props.open) return null;
  return <SupplierDialogForm {...props} />;
}

function SupplierDialogForm({ open, onClose, existing }: SupplierDialogProps) {
  const { upsertSupplier, setSupplierImages } = useActions();
  const allSupplierImages = useStore((s) => s.supplierImages);
  const [images, setImages] = useState<ProductImage[]>(() =>
    Object.values(allSupplierImages)
      .filter((img) => img.supplierId === existing?.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ id: img.id, url: img.url, isMain: img.isMain, sortOrder: img.sortOrder, kind: "source" as const }))
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState<SupplierCategory>(existing?.category ?? "fabric_mill");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [line, setLine] = useState(existing?.line ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [taxId, setTaxId] = useState(existing?.taxId ?? "");
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(existing?.leadTimeDays ?? 0);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!name.trim()) {
      toastError("กรุณาระบุชื่อร้านค้า/ซัพพลายเออร์");
      return;
    }
    setSaving(true);
    try {
      const supplierId = existing?.id ?? crypto.randomUUID();
      upsertSupplier({
        id: supplierId,
        name: name.trim(),
        category,
        contactName: contactName || undefined,
        phone: phone || undefined,
        line: line || undefined,
        email: email || undefined,
        address: address || undefined,
        taxId: taxId || undefined,
        paymentTerms: paymentTerms || undefined,
        leadTimeDays: leadTimeDays || undefined,
        note: note || undefined,
        active: existing?.active ?? true,
      });
      setSupplierImages(
        supplierId,
        images.map((img) => ({ id: img.id, url: img.url, isMain: img.isMain, sortOrder: img.sortOrder }))
      );
      toastSuccess(existing ? "แก้ไขข้อมูลร้านค้าเรียบร้อยแล้ว" : "เพิ่มร้านค้าใหม่เรียบร้อยแล้ว");
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
      title={existing ? "แก้ไขร้านค้า / ซัพพลายเออร์" : "เพิ่มร้านค้า / ซัพพลายเออร์ใหม่"}
      size="lg"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="ชื่อร้านค้า / ซัพพลายเออร์" required className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="ประเภท">
          <Select value={category} onChange={(e) => setCategory(e.target.value as SupplierCategory)}>
            {Object.entries(SUPPLIER_CATEGORY_LABEL_TH).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="ชื่อผู้ติดต่อ">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </FormField>
        <FormField label="เบอร์โทรศัพท์">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Line ID">
          <Input value={line} onChange={(e) => setLine(e.target.value)} />
        </FormField>
        <FormField label="อีเมล">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="เลขประจำตัวผู้เสียภาษี">
          <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        </FormField>
        <FormField label="เงื่อนไขการชำระเงิน">
          <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="เช่น เครดิต 30 วัน" />
        </FormField>
        <FormField label="ระยะเวลาผลิต/จัดส่ง (วัน)">
          <Input type="number" min={0} value={leadTimeDays} onChange={(e) => setLeadTimeDays(Number(e.target.value))} />
        </FormField>
        <FormField label="ที่อยู่" className="sm:col-span-2">
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormField>
        <FormField label="หมายเหตุ" className="sm:col-span-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <div className="sm:col-span-2">
          <ImageUploader
            images={images}
            onChange={setImages}
            kind="source"
            label="โลโก้ / รูปภาพร้านค้า"
            hint="รูปแรกหรือรูปที่ตั้งเป็นหลักจะใช้เป็นโลโก้แสดงในรายการร้านค้า"
          />
        </div>
      </div>
    </Dialog>
  );
}
