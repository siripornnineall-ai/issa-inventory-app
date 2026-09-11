"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PackagePlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";

interface Line {
  key: string;
  equipmentId: string;
  qty: number;
  unitCost: number;
}

function EquipmentStockInForm() {
  const state = useStore();
  const { stockIn } = useActions();
  const user = useCurrentUser();
  const router = useRouter();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const [date, setDate] = useState(todayInputValue());
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const dirty = lines.length > 0 || note.trim().length > 0 || poNumber.trim().length > 0;
  useUnsavedChangesGuard(dirty);

  function addLine(equipmentId: string) {
    if (lines.some((l) => l.equipmentId === equipmentId)) {
      toastError("เพิ่มรายการนี้ไว้แล้ว");
      return;
    }
    const equipment = state.equipment[equipmentId];
    setLines((prev) => [...prev, { key: equipmentId, equipmentId, qty: 1, unitCost: equipment?.purchasePricePerUnit ?? 0 }]);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const totalQty = lines.reduce((s, l) => s + (l.qty || 0), 0);
  const totalCost = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitCost || 0), 0);

  function handleSubmit() {
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่รับอุปกรณ์เข้า");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณาเพิ่มรายการอุปกรณ์อย่างน้อย 1 รายการ");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      stockIn({
        itemType: "equipment",
        date: dateInputToISO(date),
        warehouseId,
        supplierId: supplierId || undefined,
        poNumber: poNumber || undefined,
        billNumber: billNumber || undefined,
        receivedBy: user.id,
        receivedByName: user.name,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.equipmentId, qty: l.qty, unitCost: l.unitCost })),
      });
      toastSuccess("บันทึกการรับอุปกรณ์เข้าเรียบร้อยแล้ว");
      router.push("/equipment");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการรับเข้า</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="วันที่รับเข้า" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="คลังปลายทาง" required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="ผู้ผลิต / ซัพพลายเออร์">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {Object.values(state.suppliers).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="เลขที่ PO">
            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
          </FormField>
          <FormField label="เลขที่บิล / ใบส่งของ">
            <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
          </FormField>
          <FormField label="หมายเหตุ" className="col-span-2 lg:col-span-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการอุปกรณ์</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EquipmentPicker warehouseId={warehouseId} onSelect={addLine} />
          {lines.length === 0 ? (
            <EmptyState icon={<PackagePlus className="h-10 w-10" />} title="ยังไม่มีรายการอุปกรณ์" description="ค้นหาและเลือกอุปกรณ์ด้านบนเพื่อเพิ่มลงในรายการรับเข้า" />
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="flex flex-col gap-2 sm:hidden">
                {lines.map((l) => {
                  const equipment = state.equipment[l.equipmentId];
                  return (
                    <div key={l.key} className="rounded-lg border border-[var(--color-border)] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{equipment?.name}</p>
                          <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{equipment?.code}</p>
                        </div>
                        <button onClick={() => removeLine(l.key)} className="shrink-0 text-[var(--color-danger)]" aria-label="ลบรายการ">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-end gap-1.5">
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">จำนวน</label>
                          <Input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                            className="h-8 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">ราคาต่อหน่วย</label>
                          <Input
                            type="number"
                            min={0}
                            value={l.unitCost}
                            onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                            className="h-8 px-2 py-1 text-sm"
                          />
                        </div>
                        <p className="h-8 shrink-0 pl-1 pt-1.5 text-sm font-semibold">{formatTHB(l.qty * l.unitCost)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>อุปกรณ์</Th>
                      <Th>จำนวน</Th>
                      <Th>ราคาต่อหน่วย</Th>
                      <Th>รวม</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {lines.map((l) => {
                      const equipment = state.equipment[l.equipmentId];
                      return (
                        <Tr key={l.key}>
                          <Td>
                            <p className="font-medium">{equipment?.name}</p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">{equipment?.code}</p>
                          </Td>
                          <Td>
                            <Input
                              type="number"
                              min={1}
                              value={l.qty}
                              onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                              className="w-24"
                            />
                          </Td>
                          <Td>
                            <Input
                              type="number"
                              min={0}
                              value={l.unitCost}
                              onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                              className="w-28"
                            />
                          </Td>
                          <Td>{formatTHB(l.qty * l.unitCost)}</Td>
                          <Td>
                            <button onClick={() => removeLine(l.key)} className="text-[var(--color-danger)]" aria-label="ลบรายการ">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
          {lines.length > 0 && (
            <div className="flex items-center justify-end gap-6 border-t border-[var(--color-border)] pt-4 text-sm">
              <span>
                จำนวนรวม: <span className="font-semibold">{formatNumber(totalQty)}</span>
              </span>
              <span>
                มูลค่ารวม: <span className="font-semibold">{formatTHB(totalCost)}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.push("/equipment")}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          บันทึกการรับเข้า
        </Button>
      </div>
    </div>
  );
}

export default function EquipmentStockInPage() {
  return (
    <>
      <Header title="รับอุปกรณ์เข้า" description="บันทึกการรับอุปกรณ์ บรรจุภัณฑ์ หรือของใช้สิ้นเปลืองเข้าคลัง" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="equipment.write">
          <EquipmentStockInForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
