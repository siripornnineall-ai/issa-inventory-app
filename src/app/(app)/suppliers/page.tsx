"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, Pencil, Truck, Phone, Mail, Store } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { useStore, useActions } from "@/lib/store";
import { useCan } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { SUPPLIER_CATEGORY_LABEL_TH, type Supplier, type SupplierCategory } from "@/lib/types";

export default function SuppliersPage() {
  const state = useStore();
  const { upsertSupplier } = useActions();
  const canWrite = useCan("master.write");
  const suppliers = Object.values(state.suppliers);
  const supplierImages = Object.values(state.supplierImages);

  function logoFor(supplierId: string) {
    const imgs = supplierImages.filter((i) => i.supplierId === supplierId);
    return imgs.find((i) => i.isMain)?.url ?? imgs[0]?.url;
  }

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SupplierCategory | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || (s.contactName ?? "").toLowerCase().includes(q);
      const matchesCategory = category === "all" || s.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [suppliers, search, category]);

  function toggleActive(s: Supplier) {
    try {
      upsertSupplier({ id: s.id, active: !s.active });
      toastSuccess(s.active ? "ปิดการใช้งานร้านค้าเรียบร้อยแล้ว" : "เปิดการใช้งานร้านค้าเรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <>
      <Header
        title="ร้านค้าและซัพพลายเออร์"
        description="จัดการข้อมูลผู้ผลิต โรงงาน และซัพพลายเออร์ทั้งหมดของ ISSA Apparel"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อร้านค้าหรือผู้ติดต่อ..." className="w-72 pl-9" />
          </div>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select value={category} onChange={(e) => setCategory(e.target.value as SupplierCategory | "all")} className="w-64">
            <option value="all">ประเภททั้งหมด</option>
            {Object.entries(SUPPLIER_CATEGORY_LABEL_TH).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {canWrite && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> เพิ่มร้านค้าใหม่
            </Button>
          )}
        </div>

        <Card>
          {filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<Truck className="h-10 w-10" />} title="ไม่พบร้านค้าที่ตรงกับเงื่อนไข" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {filtered.map((s) => {
                  const logo = logoFor(s.id);
                  return (
                    <Link key={s.id} href={`/suppliers/${s.id}`} className="flex items-center gap-3 p-3">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt={s.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">
                          <Store className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-on-surface)]">{s.name}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                          {SUPPLIER_CATEGORY_LABEL_TH[s.category]} · {s.contactName || "-"}
                        </p>
                      </div>
                      <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "ใช้งานอยู่" : "ปิด"}</Badge>
                    </Link>
                  );
                })}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
              <Table>
              <Thead>
                <Tr>
                  <Th></Th>
                  <Th>ชื่อร้านค้า</Th>
                  <Th>ประเภท</Th>
                  <Th>ผู้ติดต่อ</Th>
                  <Th>ช่องทางติดต่อ</Th>
                  <Th>ระยะเวลาผลิต/จัดส่ง</Th>
                  <Th>สถานะ</Th>
                  {canWrite && <Th></Th>}
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((s) => {
                  const logo = logoFor(s.id);
                  return (
                  <Tr key={s.id}>
                    <Td>
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt={s.name} className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">
                          <Store className="h-4 w-4" />
                        </div>
                      )}
                    </Td>
                    <Td className="font-medium">
                      <Link href={`/suppliers/${s.id}`} className="hover:text-[var(--color-primary-container)] hover:underline">
                        {s.name}
                      </Link>
                    </Td>
                    <Td>{SUPPLIER_CATEGORY_LABEL_TH[s.category]}</Td>
                    <Td>{s.contactName || "-"}</Td>
                    <Td className="text-xs text-[var(--color-on-surface-variant)]">
                      {s.phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {s.phone}
                        </p>
                      )}
                      {s.email && (
                        <p className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {s.email}
                        </p>
                      )}
                      {!s.phone && !s.email && "-"}
                    </Td>
                    <Td>{s.leadTimeDays ? `${s.leadTimeDays} วัน` : "-"}</Td>
                    <Td>
                      <button onClick={() => canWrite && toggleActive(s)} disabled={!canWrite}>
                        <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</Badge>
                      </button>
                    </Td>
                    {canWrite && (
                      <Td>
                        <button
                          onClick={() => {
                            setEditing(s);
                            setDialogOpen(true);
                          }}
                          className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Td>
                    )}
                  </Tr>
                  );
                })}
              </Tbody>
            </Table>
              </div>
            </>
          )}
        </Card>
      </PageContainer>

      <SupplierDialog open={dialogOpen} onClose={() => setDialogOpen(false)} existing={editing} />
    </>
  );
}
