"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import { useMemo, useState } from "react";
import { Trash2, ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { TransferStatusBadge } from "@/components/ui/Badge";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser, useCan } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO, formatThaiDateTime } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import type { Transfer } from "@/lib/types";

interface Line {
  key: string;
  equipmentId: string;
  qty: number;
}

function CreateEquipmentTransferForm() {
  const state = useStore();
  const { createTransfer } = useActions();
  const user = useCurrentUser();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const [date, setDate] = useState(todayInputValue());
  const [fromWarehouseId, setFromWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(activeWarehouses[1]?.id ?? "");
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
    if (!fromWarehouseId || !toWarehouseId) {
      toastError("กรุณาเลือกคลังต้นทางและปลายทาง");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      toastError("คลังต้นทางและปลายทางต้องไม่ใช่แห่งเดียวกัน");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณาเพิ่มรายการอุปกรณ์อย่างน้อย 1 รายการ");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      createTransfer({
        itemType: "equipment",
        date: dateInputToISO(date),
        fromWarehouseId,
        toWarehouseId,
        senderId: user.id,
        senderName: user.name,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.equipmentId, qty: l.qty })),
      });
      toastSuccess("สร้างรายการโอนย้ายเรียบร้อยแล้ว");
      setLines([]);
      setNote("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>สร้างรายการโอนย้ายใหม่</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="วันที่โอนย้าย" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="คลังต้นทาง" required>
            <Select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="คลังปลายทาง" required>
            <Select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="หมายเหตุ" className="col-span-2 lg:col-span-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
          </FormField>
        </div>

        <EquipmentPicker warehouseId={fromWarehouseId} onSelect={addLine} />

        {lines.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight className="h-10 w-10" />} title="ยังไม่มีรายการอุปกรณ์" description="ค้นหาและเลือกอุปกรณ์ด้านบนเพื่อเพิ่มลงในรายการโอนย้าย" />
        ) : (
          <>
            {/* การ์ดสำหรับจอมือถือ */}
            <div className="flex flex-col gap-2 sm:hidden">
              {lines.map((l) => {
                const equipment = state.equipment[l.equipmentId];
                const onHand = fromWarehouseId ? state.equipmentStock[`${l.equipmentId}::${fromWarehouseId}`]?.qtyOnHand ?? 0 : 0;
                const insufficient = l.qty > onHand;
                return (
                  <div key={l.key} className="rounded-lg border border-[var(--color-border)] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{equipmentLabel(equipment)}</p>
                        <p className={`text-xs ${insufficient ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-on-surface-variant)]"}`}>
                          คงเหลือที่ต้นทาง {formatNumber(onHand)} {equipment?.unit}
                        </p>
                      </div>
                      <button onClick={() => removeLine(l.key)} className="shrink-0 text-[var(--color-danger)]" aria-label="ลบรายการ">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5">
                      <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">จำนวนที่โอน</label>
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
                    <Th>คงเหลือที่ต้นทาง</Th>
                    <Th>จำนวนที่โอน</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {lines.map((l) => {
                    const equipment = state.equipment[l.equipmentId];
                    const onHand = fromWarehouseId ? state.equipmentStock[`${l.equipmentId}::${fromWarehouseId}`]?.qtyOnHand ?? 0 : 0;
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

        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving}>
            สร้างรายการโอนย้าย
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TransferListRow({ transfer, layout }: { transfer: Transfer; layout: "table" | "card" }) {
  const state = useStore();
  const { receiveTransfer, cancelTransfer } = useActions();
  const user = useCurrentUser();
  const canTransfer = useCan("stock.transfer");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);

  const totalQty = transfer.lines.reduce((s, l) => s + l.qty, 0);
  const fromName = state.warehouses[transfer.fromWarehouseId]?.name ?? "-";
  const toName = state.warehouses[transfer.toWarehouseId]?.name ?? "-";
  const pending = transfer.status === "pending" || transfer.status === "shipping";

  function handleReceive() {
    if (!user) return;
    setBusy(true);
    try {
      receiveTransfer(transfer.id, user.id, user.name);
      toastSuccess("ยืนยันรับอุปกรณ์เรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!user) return;
    setBusy(true);
    try {
      cancelTransfer(transfer.id, cancelReason || undefined, user.id, user.name);
      toastSuccess("ยกเลิกรายการโอนย้ายเรียบร้อยแล้ว");
      setCancelOpen(false);
      setCancelReason("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const actions = canTransfer && pending && (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={handleReceive} loading={busy}>
        <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยันรับ
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>
        <XCircle className="h-3.5 w-3.5" /> ยกเลิก
      </Button>
    </div>
  );

  const cancelDialog = (
    <Dialog
      open={cancelOpen}
      onClose={() => setCancelOpen(false)}
      title="ยกเลิกรายการโอนย้าย"
      description="สต็อกที่หักไว้จากคลังต้นทางจะถูกคืนกลับ"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="danger" onClick={handleCancel} loading={busy}>
            ยืนยันยกเลิก
          </Button>
        </>
      }
    >
      <FormField label="เหตุผลการยกเลิก">
        <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
      </FormField>
    </Dialog>
  );

  if (layout === "card") {
    return (
      <div className="rounded-lg border border-[var(--color-border)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{transfer.transferNo}</p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(transfer.date)}</p>
          </div>
          <TransferStatusBadge status={transfer.status} />
        </div>
        <p className="mt-1.5 truncate text-sm text-[var(--color-on-surface)]">
          {fromName} <span className="text-[var(--color-on-surface-variant)]">→</span> {toName}
        </p>
        <p className="text-xs text-[var(--color-on-surface-variant)]">
          {transfer.lines.length} รายการ / {formatNumber(totalQty)} ชิ้น
        </p>
        {actions && <div className="mt-2">{actions}</div>}
        {cancelDialog}
      </div>
    );
  }

  return (
    <Tr>
      <Td className="font-medium">{transfer.transferNo}</Td>
      <Td className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(transfer.date)}</Td>
      <Td>
        {fromName} <span className="text-[var(--color-on-surface-variant)]">→</span> {toName}
      </Td>
      <Td>
        {transfer.lines.length} รายการ / {formatNumber(totalQty)} ชิ้น
      </Td>
      <Td>
        <TransferStatusBadge status={transfer.status} />
      </Td>
      <Td>
        {actions}
        {cancelDialog}
      </Td>
    </Tr>
  );
}

function EquipmentTransferList() {
  const state = useStore();
  const transfers = useMemo(
    () =>
      Object.values(state.transfers)
        .filter((t) => t.itemType === "equipment")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.transfers]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติรายการโอนย้าย</CardTitle>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight className="h-10 w-10" />} title="ยังไม่มีรายการโอนย้าย" />
        ) : (
          <>
            {/* การ์ดสำหรับจอมือถือ */}
            <div className="flex flex-col gap-2 sm:hidden">
              {transfers.map((t) => (
                <TransferListRow key={t.id} transfer={t} layout="card" />
              ))}
            </div>

            {/* ตารางสำหรับจอกว้าง */}
            <div className="hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    <Th>เลขที่</Th>
                    <Th>วันที่</Th>
                    <Th>ต้นทาง → ปลายทาง</Th>
                    <Th>รายการ</Th>
                    <Th>สถานะ</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {transfers.map((t) => (
                    <TransferListRow key={t.id} transfer={t} layout="table" />
                  ))}
                </Tbody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function EquipmentTransferPage() {
  return (
    <>
      <Header title="โอนย้ายอุปกรณ์" description="สร้างรายการโอนย้ายอุปกรณ์ระหว่างคลัง และยืนยันการรับอุปกรณ์ปลายทาง" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.transfer">
          <div className="flex flex-col gap-6">
            <CreateEquipmentTransferForm />
            <EquipmentTransferList />
          </div>
        </RequireAccess>
      </PageContainer>
    </>
  );
}
