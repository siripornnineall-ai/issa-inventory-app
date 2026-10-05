"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Phone, Mail, MessageCircle, MapPin, ImageOff, Package } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { useStore, useActions } from "@/lib/store";
import { useCan } from "@/lib/auth/session";
import { formatThaiDate } from "@/lib/utils/date";
import { toastError, toastSuccess } from "@/lib/toast";
import { PRODUCT_STATUS_LABEL_TH, SUPPLIER_CATEGORY_LABEL_TH } from "@/lib/types";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const state = useStore();
  const { removeSupplier } = useActions();
  const canWrite = useCan("master.write");

  const supplier = state.suppliers[params.id];
  const images = useMemo(
    () =>
      Object.values(state.supplierImages)
        .filter((i) => i.supplierId === params.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [state.supplierImages, params.id]
  );
  const sourcedProducts = useMemo(
    () => Object.values(state.products).filter((p) => p.sourceSupplierId === params.id),
    [state.products, params.id]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!supplier) {
    return (
      <>
        <Header title="ไม่พบร้านค้า" />
        <PageContainer>
          <EmptyState
            title="ไม่พบร้านค้า/ซัพพลายเออร์นี้ในระบบ"
            description="ร้านค้านี้อาจถูกลบไปแล้ว"
            action={
              <Link href="/suppliers">
                <Button>กลับไปหน้าร้านค้าทั้งหมด</Button>
              </Link>
            }
          />
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <Header
        title={supplier.name}
        description={`${SUPPLIER_CATEGORY_LABEL_TH[supplier.category]} · เพิ่มเมื่อ ${formatThaiDate(supplier.createdAt)}`}
        actions={
          canWrite && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> แก้ไขข้อมูล
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> ลบร้านค้า
              </Button>
            </div>
          )
        }
      />
      <PageContainer>
        <Badge tone={supplier.active ? "success" : "neutral"}>{supplier.active ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</Badge>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>โลโก้ / รูปภาพ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {images.length === 0 && (
                <div className="col-span-2 flex h-32 items-center justify-center rounded-xl bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">
                  <ImageOff className="h-6 w-6" />
                </div>
              )}
              {images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.url} alt={supplier.name} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลร้านค้า</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-0 sm:gap-x-6">
              <Info label="ประเภท" value={SUPPLIER_CATEGORY_LABEL_TH[supplier.category]} />
              <Info label="ผู้ติดต่อ" value={supplier.contactName || "-"} />
              <Info
                label="เบอร์โทรศัพท์"
                value={supplier.phone || "-"}
                icon={<Phone className="h-3.5 w-3.5" />}
              />
              <Info label="Line ID" value={supplier.line || "-"} icon={<MessageCircle className="h-3.5 w-3.5" />} />
              <Info label="อีเมล" value={supplier.email || "-"} icon={<Mail className="h-3.5 w-3.5" />} />
              <Info label="เลขประจำตัวผู้เสียภาษี" value={supplier.taxId || "-"} />
              <Info label="เงื่อนไขการชำระเงิน" value={supplier.paymentTerms || "-"} />
              <Info label="ระยะเวลาผลิต/จัดส่ง" value={supplier.leadTimeDays ? `${supplier.leadTimeDays} วัน` : "-"} />
              <Info label="ที่อยู่" value={supplier.address || "-"} icon={<MapPin className="h-3.5 w-3.5" />} full />
              <Info label="หมายเหตุ" value={supplier.note || "-"} full />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>รุ่นสินค้าที่รับมาจากร้านนี้</CardTitle>
            {canWrite && (
              <Link href="/products/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" /> เพิ่มรุ่นสินค้า
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {sourcedProducts.length === 0 ? (
              <EmptyState icon={<Package className="h-8 w-8" />} title="ยังไม่มีรุ่นสินค้าที่รับมาจากร้านนี้" />
            ) : (
              <>
                {/* การ์ดสำหรับจอมือถือ */}
                <div className="divide-y divide-[var(--color-border)] sm:hidden">
                  {sourcedProducts.map((p) => (
                    <Link key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.sellingName}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                          {p.category} · {p.sourcePurchasePrice ? `${p.sourcePurchasePrice.toLocaleString("th-TH")} บาท` : "-"}
                        </p>
                      </div>
                      <Badge tone={p.status === "active" ? "success" : "neutral"}>{PRODUCT_STATUS_LABEL_TH[p.status]}</Badge>
                    </Link>
                  ))}
                </div>

                {/* ตารางสำหรับจอกว้าง */}
                <div className="hidden sm:block">
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>ชื่อรุ่นที่ใช้ขาย</Th>
                        <Th>หมวดหมู่</Th>
                        <Th>ราคาซื้อ</Th>
                        <Th>สถานะ</Th>
                        <Th></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sourcedProducts.map((p) => (
                        <Tr key={p.id}>
                          <Td className="font-medium">{p.sellingName}</Td>
                          <Td>{p.category}</Td>
                          <Td>{p.sourcePurchasePrice ? `${p.sourcePurchasePrice.toLocaleString("th-TH")} บาท` : "-"}</Td>
                          <Td>
                            <Badge tone={p.status === "active" ? "success" : "neutral"}>{PRODUCT_STATUS_LABEL_TH[p.status]}</Badge>
                          </Td>
                          <Td>
                            <Link href={`/products/${p.id}`} className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]">
                              ดูรายละเอียด
                            </Link>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageContainer>

      <SupplierDialog open={editOpen} onClose={() => setEditOpen(false)} existing={supplier} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        danger
        title="ลบร้านค้า/ซัพพลายเออร์นี้?"
        description="ข้อมูลสินค้าที่เคยรับมาจากร้านนี้จะยังคงอยู่ แต่จะไม่ผูกกับร้านนี้อีกต่อไป"
        onConfirm={() => {
          try {
            removeSupplier(supplier.id);
            toastSuccess("ลบร้านค้าเรียบร้อยแล้ว");
            router.replace("/suppliers");
          } catch (e) {
            toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
          } finally {
            setDeleteOpen(false);
          }
        }}
      />
    </>
  );
}

function Info({ label, value, full, icon }: { label: string; value: string; full?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-xs text-[var(--color-on-surface-variant)]">{label}</p>
      <p className="flex items-center gap-1 text-sm font-medium text-[var(--color-on-surface)]">
        {icon}
        {value}
      </p>
    </div>
  );
}
