"use client";

import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useStore } from "@/lib/store";
import { getStockLevel } from "@/lib/store/engine";
import { equipmentGroupKey, groupEquipment } from "@/lib/utils/equipmentGroups";
import { formatNumber, formatTHB } from "@/lib/utils/money";

// ตารางกรอกจำนวนรับเข้าของอุปกรณ์หนึ่งกลุ่มชื่อ (เช่น เลเบิ้ล Issa): หนึ่งคอลัมน์ต่อไซซ์ แถวบนบอกคงเหลือตอนนี้ แถวล่างให้กรอกจำนวนที่รับ (ว่าง = ไม่รับ)
// กด Enter ไปช่องถัดไป ราคาต่อหน่วยตั้งต่อกลุ่ม (ใช้กับทุกไซซ์ในกลุ่ม)
export function EquipmentStockInGrid({
  groupKey,
  warehouseId,
  qtys,
  unitCost,
  onQty,
  onCost,
  onRemove,
}: {
  groupKey: string; // equipmentGroupKey: อุปกรณ์มีไซซ์รวมกลุ่มตามชื่อ ไม่มีไซซ์เป็นกลุ่มของตัวเอง
  warehouseId: string;
  qtys: Record<string, number>;
  unitCost: number;
  onQty: (equipmentId: string, qty: number | undefined) => void;
  onCost: (cost: number) => void;
  onRemove: () => void;
}) {
  const equipment = useStore((s) => s.equipment);
  const stock = useStore((s) => s.equipmentStock);
  const items = groupEquipment(Object.values(equipment).filter((e) => e.status === "active" && equipmentGroupKey(e) === groupKey))[0]?.items ?? [];
  if (items.length === 0) return null;
  const name = items[0].name;
  const unit = items[0].unit;
  const total = items.reduce((t, e) => t + (qtys[e.id] ?? 0), 0);

  function nextOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(e.currentTarget.closest("table")?.querySelectorAll<HTMLInputElement>("input[data-receive-cell]") ?? []);
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  }

  return (
    <Card className="p-4" aria-label={name}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">
          {name} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">หน่วย: {unit}</span>
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            ราคาต่อหน่วย
            <input
              type="number"
              min={0}
              aria-label={`ราคาต่อหน่วย ${name}`}
              value={unitCost}
              onChange={(e) => onCost(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 w-24 rounded-lg border border-[var(--color-border)] bg-white px-2 text-right text-sm"
            />
          </label>
          <button type="button" onClick={onRemove} className="text-[var(--color-danger)]" aria-label={`เอา ${name} ออก`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-primary-container)] text-white">
              <th className="w-28 px-3 py-2 text-left font-medium">&nbsp;</th>
              {items.map((e) => (
                <th key={e.id} className="w-20 px-1 py-2 text-center font-medium">
                  {e.size ?? "จำนวน"}
                </th>
              ))}
              <th className="w-20 bg-[var(--color-primary)] px-2 py-2 text-center font-medium">รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-on-surface-variant)]">
              <td className="px-3 py-2 text-xs">คงเหลือตอนนี้</td>
              {items.map((e) => (
                <td key={e.id} className="px-1 py-2 text-center text-xs">
                  {formatNumber(warehouseId ? getStockLevel(stock, e.id, warehouseId).qtyOnHand : 0)}
                </td>
              ))}
              <td className="px-2 py-2" />
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium">รับเข้า ({unit})</td>
              {items.map((e) => (
                <td key={e.id} className="px-1 py-1.5 text-center">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    data-receive-cell
                    aria-label={`รับ ${name}${e.size ? ` ${e.size}` : ""}`}
                    value={qtys[e.id] ?? ""}
                    placeholder="–"
                    onChange={(ev) => {
                      const raw = ev.target.value;
                      onQty(e.id, raw === "" ? undefined : Math.max(0, Math.floor(Number(raw)) || 0));
                    }}
                    onKeyDown={nextOnEnter}
                    className="h-9 w-16 rounded-lg border border-[var(--color-border)] bg-white px-1 text-center text-sm font-semibold focus:border-[var(--color-primary-container)] focus:outline-none"
                  />
                </td>
              ))}
              <td className="bg-[var(--color-surface-container)] px-2 py-2 text-center font-semibold">{formatNumber(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {total > 0 && <p className="mt-2 text-right text-sm text-[var(--color-on-surface-variant)]">มูลค่า {formatTHB(total * unitCost)}</p>}
    </Card>
  );
}
