"use client";

import { FormField, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { LabelCalibration, LabelCodeType, LabelPaper } from "@/lib/utils/labelCalibration";
import { isBarcode, rollSizeMm } from "@/lib/utils/labelPrintCss";

interface Choice<K extends string> {
  key: K;
  title: string;
  hint: string;
}

// ปุ่มเลือก 1 ใน 2 แบบเดียวกันทั้ง "รหัสบนป้าย" และ "กระดาษที่ใช้พิมพ์"
function ChoiceGroup<K extends string>({ label, choices, value, onPick }: { label: string; choices: Choice<K>[]; value: K; onPick: (key: K) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={label}>
      {choices.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(p.key)}
            className={`flex flex-col items-start rounded-xl border px-4 py-2.5 text-left ${
              active
                ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary-container)]"
                : "border-[var(--color-border)] text-[var(--color-on-surface)] hover:border-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
            }`}
          >
            <span className="text-sm font-medium">
              {active ? "✓ " : ""}
              {p.title}
            </span>
            <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">{p.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LabelCalibrationPanel({
  calibration,
  onChange,
  onReset,
}: {
  calibration: LabelCalibration;
  onChange: (next: Partial<LabelCalibration>) => void;
  onReset: () => void;
}) {
  const isRoll = calibration.paper === "roll";
  const barcode = isBarcode(calibration);
  const roll = rollSizeMm(calibration);

  function field(key: keyof LabelCalibration, label: string, id: string) {
    return (
      <FormField label={label}>
        <Input
          id={id}
          type="number"
          value={calibration[key] as number}
          onChange={(e) => onChange({ [key]: Number(e.target.value) || 0 } as Partial<LabelCalibration>)}
        />
      </FormField>
    );
  }

  const codes: Choice<LabelCodeType>[] = [
    { key: "barcode", title: "บาร์โค้ด (Code 128)", hint: "รหัส SKU ของตัวเลือกนั้น ใช้กับเครื่องยิงบาร์โค้ด" },
    { key: "qr", title: "QR รหัสเฉพาะทุกใบ", hint: "สแกนด้วยกล้องมือถือในแอป ตรวจสแกนซ้ำรายชิ้นได้" },
  ];

  const papers: Choice<LabelPaper>[] = [
    { key: "a4-sheet", title: "แผ่น A4", hint: "สติกเกอร์ตัดดวงไว้ติดบน A4 หลายดวงต่อแผ่น" },
    { key: "roll", title: `ม้วนสติกเกอร์ ${roll.w}×${roll.h} มม.`, hint: "เครื่องพิมพ์ฉลาก/ความร้อน 1 ดวงต่อ 1 ใบ" },
  ];

  return (
    <div className="mb-6 flex flex-col gap-3 print:hidden">
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--color-on-surface)]">รหัสบนป้าย</p>
        <ChoiceGroup label="รหัสบนป้าย" choices={codes} value={calibration.codeType ?? "barcode"} onPick={(codeType) => onChange({ codeType })} />
        {barcode && (
          <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
            SKU ยาวเกิน 13 ตัวอักษรจะทำให้แท่งบาร์โค้ดบางลงบนป้าย 50 มม. และสแกนยากขึ้นบนเครื่องพิมพ์ 203 dpi ส่วน SKU ที่มีภาษาไทยทำบาร์โค้ดไม่ได้ ระบบจะพิมพ์ใบนั้นเป็น QR แทน
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--color-on-surface)]">กระดาษที่ใช้พิมพ์</p>
        <ChoiceGroup label="กระดาษที่ใช้พิมพ์" choices={papers} value={calibration.paper} onPick={(paper) => onChange({ paper })} />
        {isRoll && (
          <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
            ในหน้าต่างพิมพ์ของเบราว์เซอร์: เลือกเครื่องพิมพ์ฉลาก ตั้งขนาดกระดาษเป็น {roll.w}×{roll.h} มม. ขอบกระดาษ (Margins) เป็น &quot;ไม่มี&quot; และมาตราส่วน (Scale) 100%
          </p>
        )}
      </div>

      <details className="rounded-xl border border-[var(--color-border)] p-4">
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-on-surface)]">
          ตั้งค่าตำแหน่งพิมพ์ (ถ้าป้ายไม่ตรงช่องสติกเกอร์ ปรับตรงนี้แล้วลองพิมพ์ใหม่ ระบบจำค่าไว้ให้อัตโนมัติ)
        </summary>
        {isRoll ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {field("rollWidthMm", "กว้างต่อดวง (มม.)", "cal-roll-width")}
            {field("rollHeightMm", "สูงต่อดวง (มม.)", "cal-roll-height")}
            {field("rollOffsetXMm", "เลื่อนไปขวา (มม.) ค่าลบ = ซ้าย", "cal-roll-offset-x")}
            {field("rollOffsetYMm", "เลื่อนลง (มม.) ค่าลบ = ขึ้น", "cal-roll-offset-y")}
            {field("rollTextScalePct", "ขนาดตัวอักษร (%) 100 = ปกติ", "cal-roll-text-scale")}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {field("columns", "จำนวนคอลัมน์", "cal-columns")}
            {field("cellWidthMm", "กว้างต่อดวง (มม.)", "cal-cell-width")}
            {field("cellHeightMm", "สูงต่อดวง (มม.)", "cal-cell-height")}
            {field("colGapMm", "ห่างแนวนอน (มม.)", "cal-col-gap")}
            {field("rowGapMm", "ห่างแนวตั้ง (มม.)", "cal-row-gap")}
            {field("marginTopMm", "ขอบบนกระดาษ (มม.)", "cal-margin-top")}
            {field("marginLeftMm", "ขอบซ้ายกระดาษ (มม.)", "cal-margin-left")}
          </div>
        )}
        <Button variant="ghost" size="sm" className="mt-3" onClick={onReset} type="button">
          รีเซ็ตเป็นค่าเริ่มต้น
        </Button>
      </details>
    </div>
  );
}
