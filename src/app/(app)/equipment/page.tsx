"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, PackagePlus, LogIn, LogOut, Download, ImageOff, Wrench } from "lucide-react";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, KpiCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useStore } from "@/lib/store";
import { equipmentStockAcrossWarehouses } from "@/lib/store/selectors";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { useCan, useCanViewCost } from "@/lib/auth/session";
import { EQUIPMENT_TYPE_LABEL_TH, type EquipmentType } from "@/lib/types";

const PAGE_SIZE = 10;

export default function EquipmentPage() {
  const state = useStore();
  const canWrite = useCan("equipment.write");
  const canViewCost = useCanViewCost();
  const equipmentList = Object.values(state.equipment);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<EquipmentType | "all">("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const typeOptions = useMemo(() => {
    const fromRegistry = Object.values(state.equipmentTypeOptions).sort((a, b) => a.sortOrder - b.sortOrder);
    if (fromRegistry.length > 0) return fromRegistry.map((t) => ({ code: t.code, label: t.labelTh }));
    return Object.entries(EQUIPMENT_TYPE_LABEL_TH).map(([code, label]) => ({ code, label }));
  }, [state.equipmentTypeOptions]);
  function typeLabel(code: string) {
    return state.equipmentTypeOptions[code]?.labelTh ?? EQUIPMENT_TYPE_LABEL_TH[code] ?? code;
  }

  const filtered = useMemo(() => {
    return equipmentList.filter((e) => {
      const matchesSearch =
        !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = type === "all" || e.type === type;
      const matchesStatus = status === "all" || e.status === status;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [equipmentList, search, type, status]);

  const totalValue = useMemo(
    () =>
      equipmentList.reduce((sum, e) => {
        const stock = equipmentStockAcrossWarehouses(state, e.id);
        return sum + stock.onHand * e.purchasePricePerUnit;
      }, 0),
    [equipmentList, state]
  );
  const lowStockCount = useMemo(
    () => equipmentList.filter((e) => equipmentStockAcrossWarehouses(state, e.id).onHand <= e.reorderPoint).length,
    [equipmentList, state]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const rows = filtered.map((e) => {
      const stock = equipmentStockAcrossWarehouses(state, e.id);
      return {
        "ชื่ออุปกรณ์": e.name,
        "รหัส": e.code,
        "ประเภท": typeLabel(e.type),
        "หน่วยนับ": e.unit,
        "คงเหลือ": stock.onHand,
        "ราคาต่อหน่วย": e.purchasePricePerUnit,
        "มูลค่าคงเหลือ": stock.onHand * e.purchasePricePerUnit,
        "สถานะ": e.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "อุปกรณ์ทั้งหมด");
    XLSX.writeFile(wb, `อุปกรณ์ทั้งหมด-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <>
      <Header
        title="อุปกรณ์ทั้งหมด"
        description="จัดการรายการอุปกรณ์ บรรจุภัณฑ์ และของใช้สิ้นเปลืองของ ISSA Apparel"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหาตามชื่อหรือรหัส..." className="w-72 pl-9" />
          </div>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap gap-3">
          {canWrite && (
            <Link href="/equipment/new">
              <Button>
                <PackagePlus className="h-4 w-4" /> เพิ่มอุปกรณ์ใหม่
              </Button>
            </Link>
          )}
          <Link href="/equipment/stock-in">
            <Button variant="secondary">
              <LogIn className="h-4 w-4" /> รับอุปกรณ์เข้า
            </Button>
          </Link>
          <Link href="/equipment/stock-out">
            <Button variant="secondary">
              <LogOut className="h-4 w-4" /> เบิกอุปกรณ์ออก
            </Button>
          </Link>
          <Button variant="ghost" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
          <KpiCard label="อุปกรณ์ทั้งหมด" value={formatNumber(equipmentList.length)} unit="รายการ" />
          <KpiCard label="ใกล้หมด / ต้องสั่งเพิ่ม" value={<span className="text-[var(--color-danger)]">{lowStockCount}</span>} unit="รายการ" />
          {canViewCost && <KpiCard label="มูลค่าคงเหลือรวม" value={formatTHB(totalValue, { compact: true })} />}
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
            <SlidersHorizontal className="h-4 w-4" /> ตัวกรองละเอียด
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Select value={type} onChange={(e) => { setType(e.target.value as EquipmentType | "all"); setPage(1); }}>
              <option value="all">ประเภททั้งหมด</option>
              {typeOptions.map(({ code: value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">สถานะทั้งหมด</option>
              <option value="active">ใช้งานอยู่</option>
              <option value="inactive">ปิดการใช้งาน</option>
            </Select>
          </div>
        </Card>

        <Card>
          {paged.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<Wrench className="h-10 w-10" />} title="ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข" description="ลองปรับตัวกรองหรือคำค้นหาใหม่อีกครั้ง" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {paged.map((e) => {
                  const stock = equipmentStockAcrossWarehouses(state, e.id);
                  const mainImage = e.images.find((i) => i.isMain) ?? e.images[0];
                  const low = stock.onHand <= e.reorderPoint;
                  return (
                    <Link key={e.id} href={`/equipment/${e.id}`} className="flex items-center gap-3 p-3">
                      {mainImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mainImage.url} alt={e.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-container)]">
                          <ImageOff className="h-5 w-5 text-[var(--color-on-surface-variant)]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--color-on-surface)]">{e.name}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{e.code} · {typeLabel(e.type)}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <span className={low ? "font-semibold text-[var(--color-danger)]" : "font-medium text-[var(--color-on-surface)]"}>
                            คงเหลือ {formatNumber(stock.onHand)} {e.unit}
                          </span>
                          {canViewCost && <span className="font-medium text-[var(--color-on-surface)]">{formatTHB(e.purchasePricePerUnit)}</span>}
                        </div>
                      </div>
                      <Badge tone={e.status === "active" ? "success" : "neutral"}>{e.status === "active" ? "ใช้งานอยู่" : "ปิด"}</Badge>
                    </Link>
                  );
                })}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>รูป</Th>
                      <Th>ชื่ออุปกรณ์</Th>
                      <Th>รหัส</Th>
                      <Th>ประเภท</Th>
                      <Th>คงเหลือ</Th>
                      {canViewCost && <Th>ราคาต่อหน่วย</Th>}
                      <Th>สถานะ</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map((e) => {
                      const stock = equipmentStockAcrossWarehouses(state, e.id);
                      const mainImage = e.images.find((i) => i.isMain) ?? e.images[0];
                      const low = stock.onHand <= e.reorderPoint;
                      return (
                        <Tr key={e.id} className="cursor-pointer">
                          <Td>
                            <Link href={`/equipment/${e.id}`}>
                              {mainImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mainImage.url} alt={e.name} className="h-12 w-12 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-surface-container)]">
                                  <ImageOff className="h-5 w-5 text-[var(--color-on-surface-variant)]" />
                                </div>
                              )}
                            </Link>
                          </Td>
                          <Td>
                            <Link href={`/equipment/${e.id}`} className="font-medium text-[var(--color-on-surface)] hover:text-[var(--color-primary-container)]">
                              {e.name}
                            </Link>
                          </Td>
                          <Td className="font-mono text-xs">{e.code}</Td>
                          <Td>{typeLabel(e.type)}</Td>
                          <Td>
                            <span className={low ? "font-semibold text-[var(--color-danger)]" : "font-semibold"}>{formatNumber(stock.onHand)}</span> {e.unit}
                          </Td>
                          {canViewCost && <Td>{formatTHB(e.purchasePricePerUnit)}</Td>}
                          <Td>
                            <Badge tone={e.status === "active" ? "success" : "neutral"}>{e.status === "active" ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</Badge>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </Card>
      </PageContainer>
    </>
  );
}
