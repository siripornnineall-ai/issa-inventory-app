"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Boxes, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { useStore } from "@/lib/store";
import { buildEquipmentOverview, qtyByEquipment, type EquipmentOverviewEntry } from "@/lib/utils/equipmentOverview";
import { EQUIPMENT_TYPE_LABEL_TH } from "@/lib/types";
import { formatNumber } from "@/lib/utils/money";

// ช่องตัวเลข: 0 = หมด (จาง), ติดลบ = พื้นแดง
function Cell({ value, low }: { value: number; low?: boolean }) {
  if (value < 0) {
    return <Td className="bg-[var(--color-danger-container)] px-3 py-2 text-center font-semibold tabular-nums text-[var(--color-on-danger-container)]">{formatNumber(value)}</Td>;
  }
  if (value === 0) return <Td className="px-3 py-2 text-center tabular-nums text-[var(--color-on-surface-variant)]/50">0</Td>;
  return <Td className={"px-3 py-2 text-center font-medium tabular-nums " + (low ? "text-[var(--color-danger)]" : "")}>{formatNumber(value)}</Td>;
}

function OverviewTable({ entry }: { entry: EquipmentOverviewEntry }) {
  return (
    <Table className="min-w-max">
      <Thead>
        <Tr className="bg-[var(--color-primary-container)] hover:bg-[var(--color-primary-container)]">
          <Th className="sticky left-0 z-10 bg-[var(--color-primary-container)] px-3 py-2 text-white"> </Th>
          {entry.hasSizes ? (
            entry.sizes.map((s) => (
              <Th key={s.item.id} className="px-3 py-2 text-center normal-case text-white">
                {s.item.size || "-"}
              </Th>
            ))
          ) : (
            <Th className="px-3 py-2 text-center normal-case text-white">จำนวน</Th>
          )}
          {entry.hasSizes && <Th className="bg-[var(--color-primary)] px-3 py-2 text-center normal-case text-white">รวม</Th>}
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-2 font-medium whitespace-nowrap">คงเหลือ ({entry.group.primary.unit})</Td>
          {entry.sizes.map((s) => (
            <Cell key={s.item.id} value={s.qty} low={s.qty > 0 && s.qty <= s.item.reorderPoint} />
          ))}
          {entry.hasSizes && (
            <Td className={"bg-[var(--color-info-container)] px-3 py-2 text-center font-semibold tabular-nums " + (entry.total < 0 ? "text-[var(--color-danger)]" : "")}>
              {formatNumber(entry.total)}
            </Td>
          )}
        </Tr>
      </Tbody>
    </Table>
  );
}

export default function EquipmentStockOverviewPage() {
  const state = useStore();
  const [search, setSearch] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const warehouses = useMemo(() => Object.values(state.warehouses).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.warehouses]);
  const typeOptions = useMemo(() => {
    const fromRegistry = Object.values(state.equipmentTypeOptions).sort((a, b) => a.sortOrder - b.sortOrder);
    if (fromRegistry.length > 0) return fromRegistry.map((t) => ({ code: t.code, label: t.labelTh }));
    return Object.entries(EQUIPMENT_TYPE_LABEL_TH).map(([code, label]) => ({ code, label }));
  }, [state.equipmentTypeOptions]);
  function typeLabel(code: string) {
    return state.equipmentTypeOptions[code]?.labelTh ?? EQUIPMENT_TYPE_LABEL_TH[code] ?? code;
  }

  const entries = useMemo(
    () => buildEquipmentOverview(Object.values(state.equipment), qtyByEquipment(state, warehouseId || undefined), { type: type || undefined, hideEmpty }),
    [state, warehouseId, type, hideEmpty]
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return entries.filter((e) => e.group.name.toLowerCase().includes(q));
  }, [entries, search]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    []
  );

  function goTo(key: string) {
    const el = document.getElementById("eq-" + key);
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setHighlightKey(key);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightKey(null), 2500);
    setSuggestOpen(false);
    setNotFound(false);
  }

  function submitSearch() {
    if (!search.trim()) return;
    if (matches.length === 0) {
      setNotFound(true);
      setSuggestOpen(false);
      return;
    }
    goTo(matches[0].group.key);
  }

  return (
    <>
      <Header title="สต็อกภาพรวมอุปกรณ์" description="จำนวนคงเหลือของอุปกรณ์แต่ละรายการ แยกตามไซซ์" />
      <PageContainer>
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div ref={searchBoxRef} className="relative sm:col-span-2 lg:col-span-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
                  <Input
                    id="eso-search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSuggestOpen(true);
                      setNotFound(false);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitSearch();
                      } else if (e.key === "Escape") {
                        setSuggestOpen(false);
                      }
                    }}
                    placeholder="ค้นหาอุปกรณ์ แล้วเลื่อนไปที่ตาราง"
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                <Button type="button" onClick={submitSearch} disabled={!search.trim()}>
                  ค้นหา
                </Button>
              </div>
              {suggestOpen && matches.length > 0 && (
                <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
                  {matches.map((m) => (
                    <li key={m.group.key}>
                      <button
                        type="button"
                        onClick={() => goTo(m.group.key)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-surface-container)]"
                      >
                        <span className="min-w-0 truncate font-medium">{m.group.name}</span>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--color-on-surface-variant)]">
                          {formatNumber(m.total)} {m.group.primary.unit}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {notFound && <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">ไม่พบอุปกรณ์ที่ตรงกับ &quot;{search.trim()}&quot;</p>}
            </div>
            <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="ประเภท">
              <option value="">ทุกประเภท</option>
              {typeOptions.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="คลัง">
              <option value="">ทุกคลัง (รวมกัน)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <label htmlFor="eso-hide-empty" className="flex cursor-pointer items-center gap-2 text-sm">
              <input id="eso-hide-empty" type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="h-4 w-4" />
              ซ่อนรายการที่ไม่มีสต็อก
            </label>
          </CardContent>
        </Card>

        {entries.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState icon={<Boxes className="h-10 w-10" />} title="ไม่พบอุปกรณ์" description="ลองเปลี่ยนตัวกรองประเภท หรือปิด “ซ่อนรายการที่ไม่มีสต็อก”" />
            </CardContent>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card
              key={entry.group.key}
              id={"eq-" + entry.group.key}
              className={"scroll-mt-4 transition-shadow duration-500 " + (highlightKey === entry.group.key ? "ring-2 ring-[var(--color-primary-container)]" : "")}
            >
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={"/equipment/" + entry.group.primary.id} className="text-base font-semibold hover:text-[var(--color-primary-container)]">
                      {entry.group.name}
                    </Link>
                    <Badge tone="primary">{typeLabel(entry.group.primary.type)}</Badge>
                    {entry.negativeCells > 0 && <Badge tone="danger">ติดลบ {entry.negativeCells} ช่อง</Badge>}
                  </div>
                  <p className="text-sm text-[var(--color-on-surface-variant)]">
                    รวม <span className="font-bold text-[var(--color-on-surface)]">{formatNumber(entry.total)}</span> {entry.group.primary.unit}
                  </p>
                </div>
                <OverviewTable entry={entry} />
              </CardContent>
            </Card>
          ))
        )}
      </PageContainer>
    </>
  );
}
