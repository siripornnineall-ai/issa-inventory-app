"use client";

import { useState } from "react";
import { Download, ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";

export interface ExcelPickItem {
  id: string;
  label: string;
  hint?: string;
}

// ปุ่มโหลด Excel สองแบบ: กดปุ่มหลัก = โหลดทั้งหมด / กด "เลือก…" = ติ๊กเลือกว่าจะเอารุ่น/รายการไหนลงไฟล์ (ตั้งต้นติ๊กทุกอัน) กดโหลดแล้วส่ง id ที่เลือกกลับไปให้หน้านั้นกรองเอง
export function ExcelPickButton({
  label = "Excel",
  items,
  onExport,
  disabled,
  variant = "ghost",
  title,
  itemsLabel = "รุ่น",
}: {
  label?: string;
  items: ExcelPickItem[];
  onExport: (selected: Set<string>) => void;
  disabled?: boolean;
  variant?: "ghost" | "secondary";
  title?: string;
  itemsLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  function openDialog() {
    setSelected(new Set(items.map((i) => i.id)));
    setQ("");
    setOpen(true);
  }
  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(needle)) : items;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <Button variant={variant} onClick={() => onExport(new Set(items.map((i) => i.id)))} disabled={disabled} title={title}>
          <Download className="h-4 w-4" /> {label}
        </Button>
        <Button variant={variant} onClick={openDialog} disabled={disabled} aria-label={`เลือก${itemsLabel}ก่อนโหลด`} title={`เลือก${itemsLabel}ที่จะโหลด: ${label}`}>
          <ListChecks className="h-4 w-4" /> เลือก{itemsLabel}
        </Button>
      </span>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`เลือก${itemsLabel}ที่จะโหลด Excel`}
        description={`ติ๊กเฉพาะ${itemsLabel}ที่ต้องการลงไฟล์ (ตั้งต้นเลือกทั้งหมด)`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              disabled={selected.size === 0}
              onClick={() => {
                onExport(selected);
                setOpen(false);
              }}
            >
              <Download className="h-4 w-4" /> โหลด ({selected.size}/{items.length})
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`ค้นหา${itemsLabel}`} aria-label={`ค้นหา${itemsLabel}ที่จะโหลด`} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMany(shown.map((i) => i.id), true)}>
              เลือกทั้งหมด{needle ? "ที่ค้นเจอ" : ""}
            </Button>
            <Button variant="ghost" onClick={() => setMany(shown.map((i) => i.id), false)}>
              ล้างที่เลือก
            </Button>
          </div>
          <ul className="max-h-[50vh] divide-y divide-[var(--color-border)] overflow-y-auto rounded-xl border border-[var(--color-border)]">
            {shown.map((i) => (
              <li key={i.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="flex-1">{i.label}</span>
                  {i.hint && <span className="text-xs text-[var(--color-on-surface-variant)]">{i.hint}</span>}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--color-on-surface-variant)]">ไม่พบ{itemsLabel}ที่ค้นหา</li>}
          </ul>
        </div>
      </Dialog>
    </>
  );
}
