"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { EquipmentStockInGrid } from "@/components/equipment/EquipmentStockInGrid";
import { equipmentGroupKey } from "@/lib/utils/equipmentGroups";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { DuplicateSaveDialog } from "@/components/stock/DuplicateSaveDialog";
import { SaveSuccessCard, type SavedInfo } from "@/components/stock/SaveSuccessCard";
import { findRecentSimilarDoc, useSaveGuard } from "@/lib/utils/saveGuard";

function EquipmentStockInForm({ onAgain }: { onAgain: () => void }) {
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
  // ตารางกรอกจำนวนรายไซซ์: เลือกอุปกรณ์ทีละกลุ่ม (ชื่อเดียวกันแต่ละไซซ์รวมเป็นกลุ่ม) แล้วกรอกจำนวนในช่องของแต่ละไซซ์ (ว่าง = ไม่รับ)
  const [groupKeys, setGroupKeys] = useState<string[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [costs, setCosts] = useState<Record<string, number>>({}); // ราคาต่อหน่วยตามกลุ่ม (groupKey)
  // ล็อกปุ่มบันทึกทันทีที่กด (กันมือถือค้างแล้วบันทึกซ้ำ) และขึ้นหน้ายืนยันเมื่อสำเร็จ
  const guard = useSaveGuard();
  const saving = guard.locked;
  const [saved, setSaved] = useState<SavedInfo | null>(null);

  // รายการที่จะบันทึก = ช่องที่กรอกจำนวนมากกว่า 0 (ราคาต่อหน่วยตามกลุ่มชื่อ)
  const lines = useMemo(
    () =>
      Object.entries(qtys)
        .filter(([, qty]) => qty > 0)
        .map(([equipmentId, qty]) => {
          const e = state.equipment[equipmentId];
          return { equipmentId, qty, unitCost: (e ? costs[equipmentGroupKey(e)] : undefined) ?? e?.purchasePricePerUnit ?? 0 };
        }),
    [qtys, costs, state.equipment]
  );

  const dirty = !saved && (lines.length > 0 || note.trim().length > 0 || poNumber.trim().length > 0);
  useUnsavedChangesGuard(dirty);

  const groupItems = (key: string) => Object.values(state.equipment).filter((e) => e.status === "active" && equipmentGroupKey(e) === key);

  function addGroup(equipmentId: string) {
    const equipment = state.equipment[equipmentId];
    if (!equipment) return;
    const key = equipmentGroupKey(equipment);
    if (groupKeys.includes(key)) {
      toastError("เพิ่มรายการนี้ไว้แล้ว");
      return;
    }
    setGroupKeys((prev) => [...prev, key]);
    setCosts((prev) => ({ ...prev, [key]: equipment.purchasePricePerUnit ?? 0 }));
  }

  function removeGroup(key: string) {
    const ids = new Set(groupItems(key).map((e) => e.id));
    setGroupKeys((prev) => prev.filter((k) => k !== key));
    setQtys((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !ids.has(id))));
  }

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalCost = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  function handleSubmit() {
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่รับอุปกรณ์เข้า");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณากรอกจำนวนรับเข้าอย่างน้อย 1 ช่อง");
      return;
    }
    if (!user) return;
    const similar = findRecentSimilarDoc(
      Object.values(state.stockInDocs)
        .filter((d) => d.itemType === "equipment" && d.receivedBy === user.id && d.warehouseId === warehouseId)
        .map((d) => ({ no: d.docNo, createdAt: d.createdAt, lines: d.lines })),
      lines.map((l) => ({ itemId: l.equipmentId, qty: l.qty }))
    );
    guard.run(save, similar);
  }

  function save(): "keep" | "release" {
    if (!user) return "release";
    try {
      const doc = stockIn({
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
      setSaved({ docNo: doc.docNo, totalQty, lineCount: lines.length });
      return "keep";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "release";
    }
  }

  if (saved) {
    return <SaveSuccessCard title="บันทึกการรับอุปกรณ์เข้าแล้ว" info={saved} againLabel="รับอุปกรณ์เข้าต่อ" onAgain={onAgain} backHref="/equipment" backLabel="ไปหน้าอุปกรณ์" />;
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
          <EquipmentPicker warehouseId={warehouseId} onSelect={addGroup} placeholder="ค้นหาอุปกรณ์ด้วยชื่อ แล้วกรอกจำนวนในตารางด้านล่าง..." />
          {groupKeys.length === 0 ? (
            <EmptyState icon={<PackagePlus className="h-10 w-10" />} title="ยังไม่มีรายการอุปกรณ์" description="ค้นหาและเลือกอุปกรณ์ด้านบน จะขึ้นเป็นตารางรายไซซ์ให้กรอกจำนวนที่รับได้เลย" />
          ) : (
            <div className="flex flex-col gap-4">
              {groupKeys.map((key) => (
                <EquipmentStockInGrid
                  key={key}
                  groupKey={key}
                  warehouseId={warehouseId}
                  qtys={qtys}
                  unitCost={costs[key] ?? 0}
                  onQty={(id, qty) =>
                    setQtys((prev) => {
                      const next = { ...prev };
                      if (qty === undefined) delete next[id];
                      else next[id] = qty;
                      return next;
                    })
                  }
                  onCost={(cost) => setCosts((prev) => ({ ...prev, [key]: cost }))}
                  onRemove={() => removeGroup(key)}
                />
              ))}
            </div>
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
        <Button variant="secondary" onClick={() => router.replace("/equipment")}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          บันทึกการรับเข้า
        </Button>
      </div>
      <DuplicateSaveDialog guard={guard} docLabel="ใบรับเข้า" />
    </div>
  );
}

export default function EquipmentStockInPage() {
  // เปลี่ยน key เพื่อเริ่มฟอร์มใหม่ทั้งหมด (ปุ่ม "รับอุปกรณ์เข้าต่อ" หลังบันทึกสำเร็จ)
  const [round, setRound] = useState(0);
  return (
    <>
      <Header title="รับอุปกรณ์เข้า" description="บันทึกการรับอุปกรณ์ บรรจุภัณฑ์ หรือของใช้สิ้นเปลืองเข้าคลัง" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="equipment.write">
          <EquipmentStockInForm key={round} onAgain={() => setRound((n) => n + 1)} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
