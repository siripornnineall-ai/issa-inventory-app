"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "./Field";

export function NameCombobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "ค้นหา หรือพิมพ์ชื่อใหม่...",
}: {
  options: { id: string; name: string }[];
  value: string;
  onChange: (name: string) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!open && value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value);
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
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = options.find((o) => o.name.trim().toLowerCase() === query.trim().toLowerCase());

  function select(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  function createNew() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onCreate?.(trimmed);
    select(trimmed);
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
            const match = filtered.find((o) => o.name.toLowerCase() === query.trim().toLowerCase());
            if (match) select(match.name);
            else if (query.trim()) createNew();
          }}
          placeholder={placeholder}
          className={value ? "pr-8" : undefined}
        />
        {value && (
          <button type="button" onClick={clear} title="ล้างค่า" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
          <button type="button" onClick={clear} className="block w-full px-4 py-2 text-left text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]">
            ไม่ระบุ
          </button>
          {filtered.map((o) => (
            <button key={o.id} type="button" onClick={() => select(o.name)} className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-container)]">
              {o.name}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createNew}
              className="flex w-full items-center gap-1.5 border-t border-[var(--color-border)] px-4 py-2 text-left text-sm text-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
            >
              <Plus className="h-3.5 w-3.5" /> เพิ่ม &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
