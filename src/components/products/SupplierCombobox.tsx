"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import type { Supplier } from "@/lib/types";

export function SupplierCombobox({
  suppliers,
  value,
  onChange,
  onCreate,
}: {
  suppliers: Record<string, Supplier>;
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => string;
}) {
  const [query, setQuery] = useState(() => (value ? suppliers[value]?.name ?? "" : ""));
  const [open, setOpen] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => Object.values(suppliers), [suppliers]);

  if (!open && value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value ? suppliers[value]?.name ?? "" : "");
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [list, query]);

  const exactMatch = list.find((s) => s.name.trim().toLowerCase() === query.trim().toLowerCase());

  function selectSupplier(id: string, name: string) {
    onChange(id);
    setQuery(name);
    setOpen(false);
  }

  function clearSelection() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  function createNew() {
    const trimmed = query.trim();
    if (!trimmed) return;
    const id = onCreate(trimmed);
    selectSupplier(id, trimmed);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const match = filtered.find((s) => s.name.toLowerCase() === query.trim().toLowerCase());
            if (match) selectSupplier(match.id, match.name);
            else if (query.trim()) createNew();
          }}
          placeholder="ค้นหาร้าน หรือพิมพ์ชื่อร้านใหม่..."
          className={value ? "pr-8" : undefined}
        />
        {value && (
          <button
            type="button"
            onClick={clearSelection}
            title="ล้างค่า"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
          <button
            type="button"
            onClick={clearSelection}
            className="block w-full px-4 py-2 text-left text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"
          >
            ไม่ระบุ
          </button>
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSupplier(s.id, s.name)}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-container)]"
            >
              {s.name}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createNew}
              className="flex w-full items-center gap-1.5 border-t border-[var(--color-border)] px-4 py-2 text-left text-sm text-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
            >
              <Plus className="h-3.5 w-3.5" /> เพิ่ม &quot;{query.trim()}&quot; เป็นร้านใหม่
            </button>
          )}
        </div>
      )}
    </div>
  );
}
