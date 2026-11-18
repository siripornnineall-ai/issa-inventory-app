"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/Field";

export interface ModelOption {
  id: string;
  name: string;
  brand?: string;
  shape?: string;
  code?: string;
}

// ช่องเลือกรุ่นแบบพิมพ์ค้นหาได้ (แทนรายการยาวให้เลื่อนหา): พิมพ์ชื่อรุ่น / แบรนด์ / ทรง / รหัสรุ่น แล้วเลือกจากรายการที่เหลือ
// ลูกศรขึ้น-ลงเลื่อนรายการ Enter เลือก Esc ปิด กดกากบาทเพื่อเปลี่ยนรุ่น
export function ProductModelPicker({
  options,
  value,
  onChange,
  placeholder = "พิมพ์ค้นหารุ่น...",
  "aria-label": ariaLabel = "เลือกรุ่น",
}: {
  options: ModelOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const selected = options.find((o) => o.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const label = (o: ModelOption) => (o.brand ? `${o.name} · ${o.brand}` : o.name);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => [o.name, o.brand, o.shape, o.code].some((x) => x?.toLowerCase().includes(q)));
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(o: ModelOption) {
    onChange(o.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          value={open ? query : selected ? label(selected) : ""}
          placeholder={selected && open ? label(selected) : placeholder}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              if (open && results[active]) {
                e.preventDefault();
                pick(results[active]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          className="pl-9 pr-9"
        />
        {selected && (
          <button
            type="button"
            aria-label="เปลี่ยนรุ่น"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-on-surface-variant)]">ไม่พบรุ่นที่ตรงกับ &quot;{query}&quot;</p>
          ) : (
            results.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={o.id === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${i === active ? "bg-[var(--color-surface-container)]" : ""} ${o.id === value ? "font-semibold" : ""}`}
              >
                <span>{o.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-on-surface-variant)]">{[o.brand, o.shape].filter(Boolean).join(" · ")}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
