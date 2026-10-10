"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { WarehouseDialog } from "@/components/settings/WarehouseDialog";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { warehouseRemovalBlocker } from "@/lib/store/engine";
import { SingleImageUploader } from "@/components/ui/SingleImageUploader";
import { FitCoversCard } from "@/components/settings/FitCoversCard";
import { StockAuditCard } from "@/components/settings/StockAuditCard";
import { useStore, useActions } from "@/lib/store";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Warehouse } from "@/lib/types";

const TYPE_LABEL: Record<Warehouse["type"], string> = {
  main: "คลังหลัก",
  office: "สำนักงาน",
  store: "หน้าร้าน",
  other: "อื่น ๆ",
};

export default function SettingsPage() {
  const state = useStore();
  const { upsertWarehouse, removeWarehouse, updateCompanyInfo, updateStorefrontSettings, upsertBrand } = useActions();
  const warehouses = Object.values(state.warehouses);
  const brands = Object.values(state.brands);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | undefined>(undefined);
  const [deleting, setDeleting] = useState<Warehouse | undefined>(undefined);

  const [companyName, setCompanyName] = useState(state.companyInfo.name);
  const [companyAddress, setCompanyAddress] = useState(state.companyInfo.address ?? "");
  const [companyPhone, setCompanyPhone] = useState(state.companyInfo.phone ?? "");
  const [companyTaxId, setCompanyTaxId] = useState(state.companyInfo.taxId ?? "");

  const [announcementText, setAnnouncementText] = useState(state.storefrontSettings.announcementText);
  const [heroHeadingLine1, setHeroHeadingLine1] = useState(state.storefrontSettings.heroHeadingLine1);
  const [heroHeadingLine2, setHeroHeadingLine2] = useState(state.storefrontSettings.heroHeadingLine2);
  const [heroTagline, setHeroTagline] = useState(state.storefrontSettings.heroTagline);
  const [promoHeadingLine1, setPromoHeadingLine1] = useState(state.storefrontSettings.promoHeadingLine1);
  const [promoHeadingLine2, setPromoHeadingLine2] = useState(state.storefrontSettings.promoHeadingLine2);
  const [promoSubtext, setPromoSubtext] = useState(state.storefrontSettings.promoSubtext);
  const [contactPhone, setContactPhone] = useState(state.storefrontSettings.contactPhone);
  const [socialLine, setSocialLine] = useState(state.storefrontSettings.socialLine);
  const [socialFacebook, setSocialFacebook] = useState(state.storefrontSettings.socialFacebook);
  const [socialInstagram, setSocialInstagram] = useState(state.storefrontSettings.socialInstagram);
  const [socialTiktok, setSocialTiktok] = useState(state.storefrontSettings.socialTiktok);
  const [heroImageUrl, setHeroImageUrl] = useState(state.storefrontSettings.heroImageUrl);
  const [promoImageUrl, setPromoImageUrl] = useState(state.storefrontSettings.promoImageUrl);

  // กดถังขยะ: ถ้าลบไม่ได้ (มีสินค้า/ประวัติ/เหลือคลังเดียว) บอกเหตุผลทันที ถ้าลบได้ค่อยเปิดหน้าต่างยืนยัน
  function askDelete(w: Warehouse) {
    const blocker = warehouseRemovalBlocker(state, w.id);
    if (blocker) {
      toastError(blocker);
      return;
    }
    setDeleting(w);
  }

  function confirmDelete() {
    if (!deleting) return;
    try {
      removeWarehouse(deleting.id);
      toastSuccess('ลบคลัง "' + deleting.name + '" เรียบร้อยแล้ว');
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setDeleting(undefined);
    }
  }

  function toggleActive(w: Warehouse) {
    upsertWarehouse({ id: w.id, active: !w.active });
    toastSuccess(w.active ? "ปิดการใช้งานคลังเรียบร้อยแล้ว" : "เปิดการใช้งานคลังเรียบร้อยแล้ว");
  }

  function saveCompanyInfo() {
    updateCompanyInfo({
      name: companyName.trim() || "ISSA Apparel",
      address: companyAddress.trim() || undefined,
      phone: companyPhone.trim() || undefined,
      taxId: companyTaxId.trim() || undefined,
    });
    toastSuccess("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว");
  }

  function saveStorefrontSettings() {
    updateStorefrontSettings({
      announcementText: announcementText.trim(),
      heroHeadingLine1: heroHeadingLine1.trim(),
      heroHeadingLine2: heroHeadingLine2.trim(),
      heroTagline: heroTagline.trim(),
      promoHeadingLine1: promoHeadingLine1.trim(),
      promoHeadingLine2: promoHeadingLine2.trim(),
      promoSubtext: promoSubtext.trim(),
      contactPhone: contactPhone.trim(),
      socialLine: socialLine.trim(),
      socialFacebook: socialFacebook.trim(),
      socialInstagram: socialInstagram.trim(),
      socialTiktok: socialTiktok.trim(),
      heroImageUrl,
      promoImageUrl,
    });
    toastSuccess("บันทึกข้อความหน้าเว็บเรียบร้อยแล้ว — จะขึ้นเว็บภายในไม่เกิน 1 นาที");
  }

  return (
    <>
      <Header title="ตั้งค่า" description="จัดการคลังสินค้าและข้อมูลระบบของ ISSA Apparel" />
      <PageContainer className="max-w-4xl">
        <RequireAccess perm="master.write">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลบริษัท</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">ใช้แสดงบนหัวเอกสารใบสั่งซื้อ (PO) และใบแจ้งหนี้ที่ระบบสร้างให้อัตโนมัติ</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:gap-4">
              <FormField label="ชื่อบริษัท/ร้าน">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </FormField>
              <FormField label="เบอร์โทร">
                <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
              </FormField>
              <FormField label="ที่อยู่" className="col-span-2">
                <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
              </FormField>
              <FormField label="เลขผู้เสียภาษี (ถ้ามี)" hint="เว้นว่างได้หากยังไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม">
                <Input value={companyTaxId} onChange={(e) => setCompanyTaxId(e.target.value)} />
              </FormField>
              <div className="col-span-2 flex items-end">
                <Button onClick={saveCompanyInfo}>บันทึกข้อมูลบริษัท</Button>
              </div>
            </CardContent>
          </Card>
        </RequireAccess>

        <RequireAccess perm="master.write">
          <Card>
            <CardHeader>
              <CardTitle>โลโก้แบรนด์</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">ใช้แสดงบนป้าย QR ของสินค้าแต่ละแบรนด์ตอนพิมพ์ป้าย</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-0">
              {brands.map((b) => (
                <SingleImageUploader
                  key={b.id}
                  label={b.name}
                  value={b.logoUrl ?? ""}
                  onChange={(url) => {
                    upsertBrand({ id: b.id, logoUrl: url });
                    toastSuccess(`บันทึกโลโก้ ${b.name} เรียบร้อยแล้ว`);
                  }}
                  bucket="brand-logos"
                  folder={b.id}
                  hint="แนะนำรูปสี่เหลี่ยมจัตุรัส พื้นหลังทึบ PNG/JPG ไม่เกิน 5MB"
                />
              ))}
            </CardContent>
          </Card>
        </RequireAccess>

        <RequireAccess perm="settings.write">
          <Card>
            <CardHeader>
              <CardTitle>เว็บไซต์หน้าร้าน (ISSA Apparel Storefront)</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                ข้อความบนหน้าแรกของเว็บลูกค้า — แก้แล้วขึ้นเว็บเองภายในไม่เกิน 1 นาที ไม่ต้องแจ้งใคร
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 pt-0">
              <FormField label="ข้อความแบนเนอร์บนสุด" hint="เช่น เงื่อนไขส่งฟรี, โปรโมชันสั้น ๆ">
                <Input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} />
              </FormField>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FormField label="พาดหัวหน้าแรก บรรทัดที่ 1">
                  <Input value={heroHeadingLine1} onChange={(e) => setHeroHeadingLine1(e.target.value)} />
                </FormField>
                <FormField label="พาดหัวหน้าแรก บรรทัดที่ 2">
                  <Input value={heroHeadingLine2} onChange={(e) => setHeroHeadingLine2(e.target.value)} />
                </FormField>
              </div>
              <FormField label="คำโปรยใต้พาดหัว">
                <Input value={heroTagline} onChange={(e) => setHeroTagline(e.target.value)} />
              </FormField>
              <SingleImageUploader
                label="รูปแบนเนอร์ใหญ่หน้าแรก"
                value={heroImageUrl}
                onChange={setHeroImageUrl}
                folder="hero"
              />

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FormField label="หัวข้อแบนเนอร์โปรโมชัน บรรทัดที่ 1">
                  <Input value={promoHeadingLine1} onChange={(e) => setPromoHeadingLine1(e.target.value)} />
                </FormField>
                <FormField label="หัวข้อแบนเนอร์โปรโมชัน บรรทัดที่ 2">
                  <Input value={promoHeadingLine2} onChange={(e) => setPromoHeadingLine2(e.target.value)} />
                </FormField>
              </div>
              <FormField label="คำอธิบายแบนเนอร์โปรโมชัน">
                <Input value={promoSubtext} onChange={(e) => setPromoSubtext(e.target.value)} />
              </FormField>
              <SingleImageUploader
                label="รูปแบนเนอร์โปรโมชัน"
                value={promoImageUrl}
                onChange={setPromoImageUrl}
                folder="promo"
              />

              <div className="mt-2 border-t border-[var(--color-outline-variant)] pt-4">
                <p className="mb-3 text-sm font-medium text-[var(--color-on-surface)]">
                  ช่องทางติดต่อ (แสดงที่หน้า Contact และท้ายเว็บ)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <FormField label="เบอร์โทรศัพท์ร้าน">
                    <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                  </FormField>
                  <FormField label="ลิงก์ LINE" hint="เช่น https://line.me/ti/p/xxxxx">
                    <Input value={socialLine} onChange={(e) => setSocialLine(e.target.value)} />
                  </FormField>
                  <FormField label="ลิงก์ Facebook">
                    <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} />
                  </FormField>
                  <FormField label="ลิงก์ Instagram">
                    <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} />
                  </FormField>
                  <FormField label="ลิงก์ TikTok">
                    <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} />
                  </FormField>
                </div>
              </div>

              <div className="flex items-end">
                <Button onClick={saveStorefrontSettings}>บันทึกข้อความหน้าเว็บ</Button>
              </div>
            </CardContent>
          </Card>
        </RequireAccess>

        <RequireAccess perm="settings.write">
          <FitCoversCard />
        </RequireAccess>

        <RequireAccess perm="master.write">
          <StockAuditCard />
        </RequireAccess>

        <RequireAccess perm="master.write">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>คลังสินค้า</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">รายชื่อคลัง สำนักงาน และหน้าร้านทั้งหมดที่ใช้บันทึกสต็อก</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(undefined);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> เพิ่มคลังใหม่
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {warehouses.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <WarehouseIcon className="h-4 w-4 shrink-0 text-[var(--color-on-surface-variant)]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{w.name}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{TYPE_LABEL[w.type]}{w.address ? ` · ${w.address}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => toggleActive(w)}>
                        <Badge tone={w.active ? "success" : "neutral"}>{w.active ? "ใช้งานอยู่" : "ปิด"}</Badge>
                      </button>
                      <button
                        onClick={() => {
                          setEditing(w);
                          setDialogOpen(true);
                        }}
                        className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => askDelete(w)}
                        aria-label={"ลบคลัง " + w.name}
                        title="ลบคลัง"
                        className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>ชื่อคลัง</Th>
                      <Th>ประเภท</Th>
                      <Th>ที่อยู่</Th>
                      <Th>สถานะ</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {warehouses.map((w) => (
                      <Tr key={w.id}>
                        <Td className="font-medium">
                          <span className="flex items-center gap-2">
                            <WarehouseIcon className="h-4 w-4 text-[var(--color-on-surface-variant)]" /> {w.name}
                          </span>
                        </Td>
                        <Td>{TYPE_LABEL[w.type]}</Td>
                        <Td className="text-xs text-[var(--color-on-surface-variant)]">{w.address || "-"}</Td>
                        <Td>
                          <button onClick={() => toggleActive(w)}>
                            <Badge tone={w.active ? "success" : "neutral"}>{w.active ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</Badge>
                          </button>
                        </Td>
                        <Td>
                          <button
                            onClick={() => {
                              setEditing(w);
                              setDialogOpen(true);
                            }}
                            className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => askDelete(w)}
                            aria-label={"ลบคลัง " + w.name}
                            title="ลบคลัง"
                            className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </RequireAccess>
      </PageContainer>

      <WarehouseDialog open={dialogOpen} onClose={() => setDialogOpen(false)} existing={editing} />

      <ConfirmDialog
        open={deleting !== undefined}
        onClose={() => setDeleting(undefined)}
        danger
        title={'ลบคลัง "' + (deleting?.name ?? "") + '"?'}
        description="คลังนี้ยังไม่มีสินค้าและไม่เคยมีประวัติการทำรายการ ลบแล้วกู้คืนไม่ได้ ถ้าแค่เลิกใช้ชั่วคราวให้ปิดการใช้งานแทน"
        confirmLabel="ลบคลัง"
        onConfirm={confirmDelete}
      />
    </>
  );
}
