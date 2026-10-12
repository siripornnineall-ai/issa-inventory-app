"use client";

import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/utils/money";

// แถบค้างด้านล่างจอ: บอกว่ามีของที่สแกนไว้แต่ยังไม่ได้บันทึก พร้อมปุ่มบันทึก กันลืมกดแล้วของหาย
export function PendingSaveBar({
  totalQty,
  lineCount,
  saveLabel,
  onSave,
  saving,
}: {
  totalQty: number;
  lineCount: number;
  saveLabel: string;
  onSave: () => void;
  saving: boolean;
}) {
  if (lineCount === 0) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(36,54,56,0.08)] backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-semibold text-[var(--color-warning)]">ยังไม่ได้บันทึก</span> · {formatNumber(totalQty)} ชิ้น ({lineCount} รายการ)
        </p>
        <Button onClick={onSave} loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
