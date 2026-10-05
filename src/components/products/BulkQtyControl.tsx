"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

// ช่อง "ตั้งจำนวนใบทุกรายการพร้อมกัน": ใส่ตัวเลขครั้งเดียวแล้วกดอัปเดต ทุกไซซ์/ทุกรายการได้จำนวนเท่ากัน
// (หลังจากนั้นยังแก้เป็นรายตัวได้ตามเดิม) กดแล้วปุ่มเปลี่ยนเป็นสีเขียว "อัปเดตแล้ว" เพื่อให้รู้ว่าได้ผลแล้ว
// จนกว่าจะแก้ตัวเลขในช่องนี้ใหม่ ปุ่มจึงกลับเป็นปกติ
export function BulkQtyControl({ onApply, className }: { onApply: (qty: number) => void; className?: string }) {
  const [value, setValue] = useState(1);
  const [appliedValue, setAppliedValue] = useState<number | null>(null);
  const applied = appliedValue === value;

  function apply() {
    onApply(value);
    setAppliedValue(value);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <label htmlFor="bulk-qty" className="text-sm font-medium">
        ตั้งจำนวนใบทุกรายการพร้อมกัน
      </label>
      <Input
        id="bulk-qty"
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          setValue(Math.max(0, Math.floor(Number(e.target.value)) || 0));
          setAppliedValue(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
        className="h-9 w-24 px-2 py-1 text-sm"
      />
      <Button
        type="button"
        variant={applied ? "primary" : "secondary"}
        onClick={apply}
        data-applied={applied ? "true" : "false"}
        className={applied ? "bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]" : undefined}
      >
        {applied && <Check className="h-4 w-4" />}
        {applied ? "อัปเดตแล้ว" : "อัปเดตทั้งหมด"}
      </Button>
    </div>
  );
}
