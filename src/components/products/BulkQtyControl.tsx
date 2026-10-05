"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

// ช่อง "ตั้งจำนวนใบทุกรายการพร้อมกัน": ใส่ตัวเลขครั้งเดียวแล้วกดอัปเดต ทุกไซซ์/ทุกรายการได้จำนวนเท่ากัน
// (หลังจากนั้นยังแก้เป็นรายตัวได้ตามเดิม)
export function BulkQtyControl({ onApply, className }: { onApply: (qty: number) => void; className?: string }) {
  const [value, setValue] = useState(1);

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
        onChange={(e) => setValue(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onApply(value);
          }
        }}
        className="h-9 w-24 px-2 py-1 text-sm"
      />
      <Button type="button" variant="secondary" onClick={() => onApply(value)}>
        อัปเดตทั้งหมด
      </Button>
    </div>
  );
}
