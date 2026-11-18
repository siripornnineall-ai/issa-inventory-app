"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageMinus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { EquipmentQtyGrid } from "@/components/equipment/EquipmentQtyGrid";
import { useEquipmentGrid } from "@/components/equipment/useEquipmentGrid";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { DuplicateSaveDialog } from "@/components/stock/DuplicateSaveDialog";
import { SaveSuccessCard, type SavedInfo } from "@/components/stock/SaveSuccessCard";
import { findRecentSimilarDoc, useSaveGuard } from "@/lib/utils/saveGuard";
import { MOVEMENT_TYPE_LABEL_TH, STOCK_OUT_REASONS } from "@/lib/types";

const EQUIPMENT_STOCK_OUT_REASONS = STOCK_OUT_REASONS.filter((r) => r !== "sale");

function EquipmentStockOutForm({ onAgain }: { onAgain: () => void }) {
  const state = useStore();
  const { stockOut } = useActions();
  const user = useCurrentUser();
  const router = useRouter();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const [date, setDate] = useState(todayInputValue());
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  const [reasonType, setReasonType] = useState<(typeof EQUIPMENT_STOCK_OUT_REASONS)[number]>("internal_use");
  const [note, setNote] = useState("");
  // ตารางกรอกจำนวนรายไซซ์ (ช่องว่าง = ไม่เบิกไซซ์นั้น)
  const grid = useEquipmentGrid();
  const lines = grid.entries;
  // ล็อกปุ่มบันทึกทันทีที่กด (กันมือถือค้างแล้วบันทึกซ้ำ) และขึ้นหน้ายืนยันเมื่อสำเร็จ
  const guard = useSaveGuard();
  const saving = guard.locked;
  const [saved, setSaved] = useState<SavedInfo | null>(null);

  const dirty = !saved && (lines.length > 0 || note.trim().length > 0);
  useUnsavedChangesGuard(dirty);

  function addGroup(equipmentId: string) {
    if (!grid.addGroup(equipmentId)) toastError("เพิ่มรายการนี้ไว้แล้ว");
  }

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  function handleSubmit() {
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่เบิกออก");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณากรอกจำนวนเบิกออกอย่างน้อย 1 ช่อง");
      return;
    }
    if (!user) return;
    const similar = findRecentSimilarDoc(
      Object.values(state.stockOutDocs)
        .filter((d) => d.itemType === "equipment" && d.actorId === user.id && d.warehouseId === warehouseId && d.reasonType === reasonType)
        .map((d) => ({ no: d.docNo, createdAt: d.createdAt, lines: d.lines })),
      lines.map((l) => ({ itemId: l.equipmentId, qty: l.qty }))
    );
    guard.run(save, similar);
  }

  function save(): "keep" | "release" {
    if (!user) return "release";
    try {
      const { doc } = stockOut({
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
      setSaved({ docNo: doc.docNo, totalQty, lineCount: lines.length });
      return "keep";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "release";
    }
  }

  if (saved) {
    return <SaveSuccessCard title="บันทึกการเบิกอุปกรณ์ออกแล้ว" info={saved} againLabel="เบิกอุปกรณ์ออกต่อ" onAgain={onAgain} backHref="/equipment" backLabel="ไปหน้าอุปกรณ์" />;
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
          <EquipmentPicker warehouseId={warehouseId} onSelect={addGroup} placeholder="ค้นหาอุปกรณ์ด้วยชื่อ แล้วกรอกจำนวนในตารางด้านล่าง..." />
          {grid.groupKeys.length === 0 ? (
            <EmptyState icon={<PackageMinus className="h-10 w-10" />} title="ยังไม่มีรายการอุปกรณ์" description="ค้นหาและเลือกอุปกรณ์ด้านบน จะขึ้นเป็นตารางรายไซซ์ให้กรอกจำนวนที่เบิกได้เลย" />
          ) : (
            <div className="flex flex-col gap-4">
              {grid.groupKeys.map((key) => (
                <EquipmentQtyGrid
                  key={key}
                  groupKey={key}
                  warehouseId={warehouseId}
                  qtys={grid.qtys}
                  onQty={grid.setQty}
                  onRemove={() => grid.removeGroup(key)}
                  qtyLabel="เบิกออก"
                  stockLabel="คงเหลือ"
                  ariaVerb="เบิก"
                  warnOver
                />
              ))}
            </div>
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
      <DuplicateSaveDialog guard={guard} docLabel="ใบเบิกออก" />
    </div>
  );
}

export default function EquipmentStockOutPage() {
  // เปลี่ยน key เพื่อเริ่มฟอร์มใหม่ทั้งหมด (ปุ่ม "เบิกอุปกรณ์ออกต่อ" หลังบันทึกสำเร็จ)
  const [round, setRound] = useState(0);
  return (
    <>
      <Header title="เบิกอุปกรณ์ออก" description="บันทึกการเบิกอุปกรณ์ บรรจุภัณฑ์ หรือของใช้สิ้นเปลืองออกจากคลัง" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.out">
          <EquipmentStockOutForm key={round} onAgain={() => setRound((n) => n + 1)} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
