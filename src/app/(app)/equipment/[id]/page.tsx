"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, LogIn, LogOut, ArrowLeftRight, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { equipmentSiblings } from "@/lib/utils/equipmentGroups";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore, useActions } from "@/lib/store";
import { equipmentStockAcrossWarehouses } from "@/lib/store/selectors";
import { formatTHB, formatNumber } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";
import { useCan, useCanViewCost } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { EQUIPMENT_TYPE_LABEL_TH } from "@/lib/types";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const state = useStore();
  const { removeEquipment, createEquipment } = useActions();
  const [newSize, setNewSize] = useState("");
  const canWrite = useCan("equipment.write");
  const canViewCost = useCanViewCost();

  const equipment = state.equipment[params.id];
  const warehouses = Object.values(state.warehouses);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const typeLabel = equipment ? state.equipmentTypeOptions[equipment.type]?.labelTh ?? EQUIPMENT_TYPE_LABEL_TH[equipment.type] ?? equipment.type : "";

  if (!equipment) {
    return (
      <>
        <Header title="ไม่พบอุปกรณ์" />
        <PageContainer>
          <EmptyState title="ไม่พบอุปกรณ์นี้ในระบบ" description="อุปกรณ์นี้อาจถูกลบไปแล้ว" action={<Link href="/equipment"><Button>กลับไปหน้าอุปกรณ์ทั้งหมด</Button></Link>} />
        </PageContainer>
      </>
    );
  }

  const stock = equipmentStockAcrossWarehouses(state, equipment.id);
  const siblings = equipmentSiblings(Object.values(state.equipment), equipment);

  function addSize() {
    const s = newSize.trim();
    if (!s) {
      toastError("กรุณาระบุไซซ์ที่จะเพิ่ม");
      return;
    }
    if (siblings.some((x) => (x.size ?? "").toLowerCase() === s.toLowerCase())) {
      toastError(`มีไซซ์ "${s}" อยู่แล้ว`);
      return;
    }
    try {
      // สร้างรายการไซซ์ใหม่ชื่อเดียวกัน ข้อมูลอื่นคัดลอกจากไซซ์ที่กำลังดู ระบบรวมเป็นกลุ่มเดียวกันให้เองจากชื่อ+ไซซ์
      createEquipment({
        name: equipment.name,
        size: s,
        type: equipment.type,
        description: equipment.description,
        images: equipment.images,
        supplierId: equipment.supplierId,
        purchasePricePerUnit: equipment.purchasePricePerUnit,
        unit: equipment.unit,
        reorderPoint: equipment.reorderPoint,
        reorderQty: equipment.reorderQty,
        storageLocation: equipment.storageLocation,
        status: equipment.status,
      });
      setNewSize("");
      toastSuccess(`เพิ่มไซซ์ ${s} เรียบร้อยแล้ว`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <>
      <Header
        title={equipmentLabel(equipment)}
        description={`${typeLabel} · เพิ่มเมื่อ ${formatThaiDate(equipment.createdAt)}`}
        actions={
          canWrite && (
            <div className="flex gap-2">
              <Link href={`/equipment/${equipment.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="h-4 w-4" /> แก้ไขข้อมูล
                </Button>
              </Link>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> ลบอุปกรณ์
              </Button>
            </div>
          )
        }
      />
      <PageContainer>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/equipment/stock-in?equipmentId=${equipment.id}`}>
            <Button variant="secondary">
              <LogIn className="h-4 w-4" /> รับเข้า
            </Button>
          </Link>
          <Link href={`/equipment/stock-out?equipmentId=${equipment.id}`}>
            <Button variant="secondary">
              <LogOut className="h-4 w-4" /> เบิกออก
            </Button>
          </Link>
          <Link href={`/equipment/transfer?equipmentId=${equipment.id}`}>
            <Button variant="secondary">
              <ArrowLeftRight className="h-4 w-4" /> โอนย้าย
            </Button>
          </Link>
          <Badge tone={equipment.status === "active" ? "success" : "neutral"}>{equipment.status === "active" ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>รูปภาพ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {equipment.images.length === 0 && (
                <div className="col-span-2 flex h-32 items-center justify-center rounded-xl bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">
                  <ImageOff className="h-6 w-6" />
                </div>
              )}
              {equipment.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.url} alt={equipment.name} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลอุปกรณ์</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-0 sm:gap-x-6">
              <Info label="ชื่ออุปกรณ์" value={equipment.name} />
              {equipment.size && <Info label="ไซซ์" value={equipment.size} />}
              <Info label="ประเภท" value={typeLabel} />
              <Info label="หน่วยนับ" value={equipment.unit} />
              {canViewCost && <Info label="ราคาต่อหน่วย" value={formatTHB(equipment.purchasePricePerUnit)} />}
              <Info label="ผู้ผลิต / ซัพพลายเออร์" value={state.suppliers[equipment.supplierId ?? ""]?.name ?? "-"} />
              <Info label="ตำแหน่งจัดเก็บ" value={equipment.storageLocation || "-"} />
              <Info label="จุดแจ้งเตือนใกล้หมด" value={`${formatNumber(equipment.reorderPoint)} ${equipment.unit}`} />
              <Info label="รายละเอียด" value={equipment.description || "-"} full />
            </CardContent>
          </Card>
        </div>

        {(siblings.length > 1 || equipment.size) && (
          <Card>
            <CardHeader>
              <CardTitle>ไซซ์ของอุปกรณ์นี้ ({siblings.length} ไซซ์)</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">แต่ละไซซ์นับสต็อกแยกกัน กดที่ไซซ์เพื่อดูหรือแก้ไขรายละเอียดของไซซ์นั้น</p>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <Thead>
                  <Tr>
                    <Th>ไซซ์</Th>
                    <Th>คงเหลือ</Th>
                    {canViewCost && <Th>ราคาต่อหน่วย</Th>}
                    <Th>จุดแจ้งเตือน</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {siblings.map((s) => {
                    const onHand = equipmentStockAcrossWarehouses(state, s.id).onHand;
                    const isCurrent = s.id === equipment.id;
                    return (
                      <Tr key={s.id} className={isCurrent ? "bg-[var(--color-surface-container)]" : undefined}>
                        <Td>
                          {isCurrent ? (
                            <span className="font-semibold">{s.size || "-"} (กำลังดูอยู่)</span>
                          ) : (
                            <Link href={`/equipment/${s.id}`} className="font-medium text-[var(--color-primary-container)] hover:underline">
                              {s.size || "-"}
                            </Link>
                          )}
                        </Td>
                        <Td>
                          <span className={onHand <= s.reorderPoint ? "font-semibold text-[var(--color-danger)]" : "font-semibold"}>{formatNumber(onHand)}</span> {s.unit}
                        </Td>
                        {canViewCost && <Td>{formatTHB(s.purchasePricePerUnit)}</Td>}
                        <Td>{formatNumber(s.reorderPoint)}</Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
              {canWrite && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSize();
                      }
                    }}
                    placeholder="เพิ่มไซซ์ เช่น XL, 5x3 ซม."
                    className="h-9 w-56 px-2 py-1 text-sm"
                  />
                  <Button type="button" variant="secondary" onClick={addSize}>
                    <Plus className="h-4 w-4" /> เพิ่มไซซ์
                  </Button>
                  <span className="text-xs text-[var(--color-on-surface-variant)]">ข้อมูลอื่นเหมือนไซซ์ที่กำลังดู เริ่มสต็อก 0</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>สต็อกคงเหลือแยกตามคลัง</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* การ์ดสำหรับจอมือถือ */}
            <div className="grid grid-cols-2 gap-3 sm:hidden">
              {warehouses.map((w) => (
                <div key={w.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{w.name}</p>
                  <p className="text-sm font-semibold text-[var(--color-on-surface)]">{formatNumber(stock.byWarehouse[w.id] ?? 0)}</p>
                </div>
              ))}
              <div className="col-span-2 rounded-lg bg-[var(--color-surface-container)] p-2.5">
                <p className="text-xs text-[var(--color-on-surface-variant)]">รวมทั้งหมด</p>
                <p className={stock.onHand <= equipment.reorderPoint ? "font-semibold text-[var(--color-danger)]" : "font-semibold"}>
                  {formatNumber(stock.onHand)} {equipment.unit}
                </p>
              </div>
            </div>

            {/* ตารางสำหรับจอกว้าง */}
            <div className="hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    {warehouses.map((w) => (
                      <Th key={w.id}>{w.name}</Th>
                    ))}
                    <Th>รวมทั้งหมด</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    {warehouses.map((w) => (
                      <Td key={w.id}>{formatNumber(stock.byWarehouse[w.id] ?? 0)}</Td>
                    ))}
                    <Td className={stock.onHand <= equipment.reorderPoint ? "font-semibold text-[var(--color-danger)]" : "font-semibold"}>
                      {formatNumber(stock.onHand)} {equipment.unit}
                    </Td>
                  </Tr>
                </Tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </PageContainer>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        danger
        title="ลบอุปกรณ์นี้?"
        description="หากมีสต็อกคงเหลืออยู่ ระบบจะไม่อนุญาตให้ลบ"
        onConfirm={() => {
          try {
            removeEquipment(equipment.id);
            toastSuccess("ลบอุปกรณ์เรียบร้อยแล้ว");
            router.replace("/equipment");
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

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-xs text-[var(--color-on-surface-variant)]">{label}</p>
      <p className="text-sm font-medium text-[var(--color-on-surface)]">{value}</p>
    </div>
  );
}
