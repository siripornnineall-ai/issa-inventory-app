"use client";

import { useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { toastError, toastSuccess } from "@/lib/toast";
import { applyPriceAdjustment, PRICE_FIELD_LABEL, sizesInRows, type PriceField } from "@/lib/utils/priceAdjust";
import { normalizeLeadingZeros } from "@/lib/utils/numberInput";

interface PriceRow {
  size: string;
  sellingPrice: number;
  purchasePrice: number;
}

// ปรับราคาเป็นกลุ่ม: ใส่จำนวนเงินที่จะเพิ่ม/ลด เลือกไซซ์ที่ต้องการ แล้วกดอัปเดต ใช้กับทุกสีของไซซ์นั้น
export function BulkPriceAdjust<T extends PriceRow>({ rows, onChange }: { rows: T[]; onChange: (rows: T[]) => void }) {
  const [field, setField] = useState<PriceField>("sellingPrice");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const sizes = useMemo(() => sizesInRows(rows), [rows]);
  // เผื่อมีไซซ์ที่ถูกลบออกจากตารางหลังเลือกไว้ ไม่ให้นับไซซ์ที่ไม่มีแล้ว
  const selected = picked.filter((s) => sizes.includes(s));
  const matching = rows.filter((r) => selected.includes(r.size)).length;
  const value = Number(amount);

  function toggle(size: string) {
    setPicked((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  }

  function apply() {
    if (!(value > 0)) {
      toastError("กรุณาใส่จำนวนเงินที่จะปรับ (มากกว่า 0)");
      return;
    }
    if (selected.length === 0) {
      toastError("กรุณาเลือกไซซ์ที่ต้องการปรับอย่างน้อย 1 ไซซ์");
      return;
    }
    const delta = direction === "up" ? value : -value;
    const result = applyPriceAdjustment(rows, { field, delta, sizes: selected });
    if (result.negative.length > 0) {
      toastError(`ลดแล้วราคาจะติดลบ (ไซซ์ ${Array.from(new Set(result.negative.map((n) => n.size))).join(", ")}) ไม่ได้ปรับให้ ลองลดน้อยลง`);
      return;
    }
    onChange(result.rows);
    toastSuccess(`${direction === "up" ? "เพิ่ม" : "ลด"}${PRICE_FIELD_LABEL[field]} ${value} บาท ให้ ${result.changed} ตัวเลือก (ไซซ์ ${selected.join(", ")}) แล้ว`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container)]/40 p-4" role="group" aria-label="ปรับราคาเป็นกลุ่ม">
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-on-surface)]">
        <Coins className="h-4 w-4" /> ปรับราคาเป็นกลุ่ม
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
          ปรับราคา
          <Select value={field} onChange={(e) => setField(e.target.value as PriceField)} aria-label="ราคาที่จะปรับ" className="w-32">
            <option value="sellingPrice">{PRICE_FIELD_LABEL.sellingPrice}</option>
            <option value="purchasePrice">{PRICE_FIELD_LABEL.purchasePrice}</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
          เพิ่ม/ลด
          <Select value={direction} onChange={(e) => setDirection(e.target.value as "up" | "down")} aria-label="เพิ่มหรือลด" className="w-28">
            <option value="up">เพิ่ม (+)</option>
            <option value="down">ลด (−)</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
          จำนวนเงิน (บาท)
          <Input
            type="number"
            min={0}
            value={amount}
            placeholder="เช่น 100"
            aria-label="จำนวนเงินที่จะปรับ"
            onChange={(e) => setAmount(normalizeLeadingZeros(e.target.value))}
            className="w-32"
          />
        </label>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-3 text-xs text-[var(--color-on-surface-variant)]">
          <span>เลือกไซซ์ที่จะปรับ</span>
          <button type="button" onClick={() => setPicked(sizes)} className="font-medium text-[var(--color-primary-container)] hover:underline">
            เลือกทั้งหมด
          </button>
          <button type="button" onClick={() => setPicked([])} className="font-medium text-[var(--color-primary-container)] hover:underline">
            ล้าง
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => {
            const on = selected.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  on ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border)] bg-white text-[var(--color-on-surface-variant)]"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={apply}>
          อัปเดตราคา
        </Button>
        <p className="text-xs text-[var(--color-on-surface-variant)]">
          {selected.length > 0 && value > 0
            ? `จะ${direction === "up" ? "เพิ่ม" : "ลด"}${PRICE_FIELD_LABEL[field]} ${value} บาท ให้ ${matching} ตัวเลือก (ทุกสีของไซซ์ที่เลือก) · ราคาในตารางข้างล่างเปลี่ยนทันที แก้รายตัวต่อได้ แล้วกดบันทึกสินค้าตามปกติ`
            : "ราคาในตารางข้างล่างจะเปลี่ยนทันทีที่กดอัปเดต แก้รายตัวต่อได้ แล้วกดบันทึกสินค้าตามปกติ"}
        </p>
      </div>
    </div>
  );
}
