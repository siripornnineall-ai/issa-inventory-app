"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { getStockLevel } from "@/lib/store/engine";
import { Input } from "@/components/ui/Field";
import { formatNumber } from "@/lib/utils/money";

export function EquipmentPicker({
  warehouseId,
  onSelect,
  placeholder = "ค้นหาอุปกรณ์ด้วยชื่อ...",
}: {
  warehouseId?: string;
  onSelect: (equipmentId: string) => void;
  placeholder?: string;
}) {
  const state = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(state.equipment)
      .filter((e) => e.status === "active")
      .filter((e) => equipmentLabel(e).toLowerCase().includes(q))
      .slice(0, 20);
  }, [query, state.equipment]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
          {results.map((equipment) => {
            const stock = warehouseId ? getStockLevel(state.equipmentStock, equipment.id, warehouseId) : undefined;
            return (
              <button
                key={equipment.id}
                type="button"
                onClick={() => {
                  onSelect(equipment.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-surface-container)]"
              >
                <span>
                  <span className="block font-medium text-[var(--color-on-surface)]">{equipmentLabel(equipment)}</span>
                </span>
                {stock && (
                  <span className="shrink-0 text-xs font-medium text-[var(--color-on-surface-variant)]">
                    คงเหลือ {formatNumber(stock.qtyOnHand)} {equipment.unit}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-on-surface-variant)] shadow-[var(--shadow-micro)]">
          ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา
        </div>
      )}
    </div>
  );
}
