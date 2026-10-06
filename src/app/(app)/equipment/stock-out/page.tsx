"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PackageMinus } from "lucide-react";
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
import { formatNumber } from "@/lib/utils/money";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { MOVEMENT_TYPE_LABEL_TH, STOCK_OUT_REASONS } from "@/lib/types";

const EQUIPMENT_STOCK_OUT_REASONS = STOCK_OUT_REASONS.filter((r) => r !== "sale");

interface Line {
  key: string;
  equipmentId: string;
  qty: number;
}

function EquipmentStockOutForm() {
  const state = useStore();
  const { stockOut } = useActions();
  const user = useCurrentUser();
  const router = useRouter();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const [date, setDate] = useState(todayInputValue());
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  const [reasonType, setReasonType] = useState<(typeof EQUIPMENT_STOCK_OUT_REASONS)[number]>("internal_use");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const dirty = lines.length > 0 || note.trim().length > 0;
  useUnsavedChangesGuard(dirty);

  function addLine(equipmentId: string) {
    if (lines.some((l) => l.equipmentId === equipmentId)) {
      toastError("เพิ่มรายการนี้ไว้แล้ว");
      return;
    }
    setLines((prev) => [...prev, { key: equipmentId, equipmentId, qty: 1 }]);
  }

  function updateLine(key: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const totalQty = lines.reduce((s, l) => s + (l.qty || 0), 0);

  function handleSubmit() {
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่เบิกออก");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณาเพิ่มรายการอุปกรณ์อย่างน้อย 1 รายการ");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      stockOut({
        itemType: "equipment",
        date: dateInputToISO(date),
        warehouseId,
        reasonType,
        actorId: user.id,
        actorName: user.name,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.equipmentId, qty: l.qty })),
      });
      toastSuccess("บันทึกการเบิกอุปกรณ์ออกเรียบร้อยแล้ว");
      router.replace("/equipment");
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
          <CardTitle>ข้อมูลการเบิกออก</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="วันที่เบิกออก" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="คลังต้นทาง" required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="เหตุผลการเบิกออก" required>
            <Select value={reasonType} onChange={(e) => setReasonType(e.target.value as (typeof EQUIPMENT_STOCK_OUT_REASONS)[number])}>
              {EQUIPMENT_STOCK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {MOVEMENT_TYPE_LABEL_TH[r]}
                </option>
              ))}
            </Select>
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
            <EmptyState icon={<PackageMinus className="h-10 w-10" />} title="ยังไม่มีรายการอุปกรณ์" description="ค้นหาและเลือกอุปกรณ์ด้านบนเพื่อเพิ่มลงในรายการเบิกออก" />
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="flex flex-col gap-2 sm:hidden">
                {lines.map((l) => {
                  const equipment = state.equipment[l.equipmentId];
                  const onHand = warehouseId ? state.equipmentStock[`${l.equipmentId}::${warehouseId}`]?.qtyOnHand ?? 0 : 0;
                  const insufficient = l.qty > onHand;
                  return (
                    <div key={l.key} className="rounded-lg border border-[var(--color-border)] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{equipmentLabel(equipment)}</p>
                          <p className={`text-xs ${insufficient ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-on-surface-variant)]"}`}>
                            คงเหลือ {formatNumber(onHand)} {equipment?.unit}
                          </p>
                        </div>
                        <button onClick={() => removeLine(l.key)} className="shrink-0 text-[var(--color-danger)]" aria-label="ลบรายการ">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5">
                        <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">จำนวน</label>
                        <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(l.key, Number(e.target.value))} className="h-8 w-24 px-2 py-1 text-sm" />
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
                      <Th>คงเหลือ</Th>
                      <Th>จำนวน</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {lines.map((l) => {
                      const equipment = state.equipment[l.equipmentId];
                      const onHand = warehouseId ? state.equipmentStock[`${l.equipmentId}::${warehouseId}`]?.qtyOnHand ?? 0 : 0;
                      const insufficient = l.qty > onHand;
                      return (
                        <Tr key={l.key}>
                          <Td>
                            <p className="font-medium">{equipmentLabel(equipment)}</p>
                          </Td>
                          <Td className={insufficient ? "font-semibold text-[var(--color-danger)]" : ""}>
                            {formatNumber(onHand)} {equipment?.unit}
                          </Td>
                          <Td>
                            <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(l.key, Number(e.target.value))} className="w-24" />
                          </Td>
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
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.replace("/equipment")}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          บันทึกการเบิกออก
        </Button>
      </div>
    </div>
  );
}

export default function EquipmentStockOutPage() {
  return (
    <>
      <Header title="เบิกอุปกรณ์ออก" description="บันทึกการเบิกอุปกรณ์ บรรจุภัณฑ์ หรือของใช้สิ้นเปลืองออกจากคลัง" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.out">
          <EquipmentStockOutForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
