"use client";

import { FormField, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { LabelCalibration } from "@/lib/utils/labelCalibration";

export function LabelCalibrationPanel({
  calibration,
  onChange,
  onReset,
}: {
  calibration: LabelCalibration;
  onChange: (next: Partial<LabelCalibration>) => void;
  onReset: () => void;
}) {
  function field(key: keyof LabelCalibration, label: string) {
    return (
      <FormField label={label}>
        <Input
          type="number"
          value={calibration[key]}
          onChange={(e) => onChange({ [key]: Number(e.target.value) || 0 } as Partial<LabelCalibration>)}
        />
      </FormField>
    );
  }

  return (
    <details className="mb-6 rounded-xl border border-[var(--color-border)] p-4 print:hidden">
      <summary className="cursor-pointer text-sm font-medium text-[var(--color-on-surface)]">
        ตั้งค่าตำแหน่งพิมพ์ (ถ้าป้ายไม่ตรงช่องสติกเกอร์ ปรับตรงนี้แล้วลองพิมพ์ใหม่ — ระบบจำค่าไว้ให้อัตโนมัติ)
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("columns", "จำนวนคอลัมน์")}
        {field("cellWidthMm", "กว้างต่อดวง (มม.)")}
        {field("cellHeightMm", "สูงต่อดวง (มม.)")}
        {field("colGapMm", "ห่างแนวนอน (มม.)")}
        {field("rowGapMm", "ห่างแนวตั้ง (มม.)")}
        {field("marginTopMm", "ขอบบนกระดาษ (มม.)")}
        {field("marginLeftMm", "ขอบซ้ายกระดาษ (มม.)")}
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={onReset} type="button">
        รีเซ็ตเป็นค่าเริ่มต้น
      </Button>
    </details>
  );
}
