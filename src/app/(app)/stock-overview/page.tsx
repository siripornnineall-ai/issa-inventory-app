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
import { ColorSwatch } from "@/components/products/ColorSwatch";
import { useStore } from "@/lib/store";
import { buildStockMatrix, qtyByVariant, type StockMatrix } from "@/lib/utils/stockMatrix";
import { formatNumber } from "@/lib/utils/money";

// ช่องตัวเลขในตารางสต็อก: null = ไม่มีตัวเลือกนี้, 0 = สต็อกหมด (จาง), ติดลบ = พื้นแดง (ขายเกิน/ตัดสต็อกเกินที่มี)
function Cell({ value }: { value: number | null }) {
  if (value === null) return <Td className="px-3 py-2 text-center text-[var(--color-on-surface-variant)]/40">–</Td>;
  if (value < 0) {
    return <Td className="bg-[var(--color-danger-container)] px-3 py-2 text-center font-semibold tabular-nums text-[var(--color-on-danger-container)]">{formatNumber(value)}</Td>;
  }
  if (value === 0) return <Td className="px-3 py-2 text-center tabular-nums text-[var(--color-on-surface-variant)]/50">0</Td>;
  return <Td className="px-3 py-2 text-center font-medium tabular-nums">{formatNumber(value)}</Td>;
}

function MatrixTable({ matrix }: { matrix: StockMatrix }) {
  if (matrix.rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--color-on-surface-variant)]">ไม่มีสีที่มีสต็อกในรุ่นนี้ (ปิดตัวเลือก &quot;ซ่อนสีที่ไม่มีสต็อก&quot; เพื่อดูทุกสี)</p>;
  }
  return (
    <Table className="min-w-max">
      <Thead>
        <Tr className="bg-[var(--color-primary-container)] hover:bg-[var(--color-primary-container)]">
          <Th className="sticky left-0 z-10 bg-[var(--color-primary-container)] px-3 py-2 text-white">สี</Th>
          {matrix.sizes.map((s) => (
            <Th key={s} className="px-3 py-2 text-center normal-case text-white">
              {s}
            </Th>
          ))}
          <Th className="bg-[var(--color-primary)] px-3 py-2 text-center normal-case text-white">รวมต่อสี</Th>
        </Tr>
      </Thead>
      <Tbody>
        {matrix.rows.map((r) => (
          <Tr key={r.color}>
            <Td className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-2 font-medium">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block">
                  <ColorSwatch name={r.color} size={16} />
                </span>
                {r.color}
              </span>
            </Td>
            {matrix.sizes.map((s) => (
              <Cell key={s} value={r.cells[s]} />
            ))}
            <Td className={"bg-[var(--color-info-container)] px-3 py-2 text-center font-semibold tabular-nums " + (r.total < 0 ? "text-[var(--color-danger)]" : "")}>
              {formatNumber(r.total)}
            </Td>
          </Tr>
        ))}
        <Tr className="bg-[var(--color-info-container)] hover:bg-[var(--color-info-container)]">
          <Td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--color-info-container)] px-3 py-2 font-semibold">รวมต่อไซซ์</Td>
          {matrix.sizes.map((s) => (
            <Td key={s} className={"px-3 py-2 text-center font-semibold tabular-nums " + (matrix.colTotals[s] < 0 ? "text-[var(--color-danger)]" : "")}>
              {formatNumber(matrix.colTotals[s])}
            </Td>
          ))}
          <Td className="bg-[var(--color-primary)] px-3 py-2 text-center font-bold tabular-nums text-white">{formatNumber(matrix.grandTotal)}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
}

export default function StockOverviewPage() {
  const state = useStore();
  const [search, setSearch] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const warehouses = useMemo(() => Object.values(state.warehouses).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.warehouses]);

  // รายการรุ่นทั้งหมด (กรองด้วยแบรนด์เท่านั้น) — ช่องค้นหาไม่ตัดรุ่นอื่นออก แต่พาเลื่อนไปที่ตารางของรุ่นที่ค้น
  const models = useMemo(() => {
    const qty = qtyByVariant(state, warehouseId || undefined);
    const list = Object.values(state.products)
      .filter((p) => !brandId || p.brandId === brandId)
      .map((p) => {
        const variants = Object.values(state.variants).filter((v) => v.productId === p.id);
        return { product: p, matrix: buildStockMatrix(variants, qty, { hideEmpty }) };
      })
      .filter((m) => m.matrix.sizes.length > 0);
    return list.sort((a, b) => b.matrix.grandTotal - a.matrix.grandTotal || a.product.sellingName.localeCompare(b.product.sellingName, "th"));
  }, [state, brandId, warehouseId, hideEmpty]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return models.filter(({ product: p }) => p.sellingName.toLowerCase().includes(q) || (p.modelCode ?? "").toLowerCase().includes(q));
  }, [models, search]);

  // ปิดรายการแนะนำเมื่อคลิกนอกช่องค้นหา
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

  function goTo(productId: string) {
    const el = document.getElementById("model-" + productId);
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setHighlightId(productId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2500);
    setSuggestOpen(false);
    setNotFound(false);
  }

  // กด Enter หรือปุ่มค้นหา: ไปที่รุ่นแรกที่ตรงคำค้น
  function submitSearch() {
    if (!search.trim()) return;
    if (matches.length === 0) {
      setNotFound(true);
      setSuggestOpen(false);
      return;
    }
    goTo(matches[0].product.id);
  }

  return (
    <>
      <Header title="สต็อกภาพรวม" description="จำนวนคงเหลือของแต่ละรุ่น แยกตามสีและไซซ์" />
      <PageContainer>
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div ref={searchBoxRef} className="relative sm:col-span-2 lg:col-span-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
                  <Input
                    id="so-search"
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
                    placeholder="ค้นหารุ่น แล้วเลื่อนไปที่ตาราง"
                    className="pl-9"
                    role="combobox"
                    aria-expanded={suggestOpen && matches.length > 0}
                    aria-controls="so-suggestions"
                    autoComplete="off"
                  />
                </div>
                <Button type="button" onClick={submitSearch} disabled={!search.trim()}>
                  ค้นหา
                </Button>
              </div>
              {suggestOpen && matches.length > 0 && (
                <ul
                  id="so-suggestions"
                  role="listbox"
                  className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]"
                >
                  {matches.map(({ product, matrix }) => (
                    <li key={product.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => goTo(product.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-surface-container)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{product.sellingName}</span>
                          <span className="block truncate text-xs text-[var(--color-on-surface-variant)]">{product.brandId ? (state.brands[product.brandId]?.name ?? "") : ""}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--color-on-surface-variant)]">{formatNumber(matrix.grandTotal)} ชิ้น</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {notFound && <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">ไม่พบรุ่นที่ตรงกับ &quot;{search.trim()}&quot;</p>}
            </div>
            <Select id="so-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="แบรนด์">
              <option value="">ทุกแบรนด์</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select id="so-warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="คลัง">
              <option value="">ทุกคลัง (รวมกัน)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <label htmlFor="so-hide-empty" className="flex cursor-pointer items-center gap-2 text-sm">
              <input id="so-hide-empty" type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="h-4 w-4" />
              ซ่อนสีที่ไม่มีสต็อก
            </label>
          </CardContent>
        </Card>

        {models.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <EmptyState icon={<Boxes className="h-10 w-10" />} title="ไม่พบรุ่นสินค้า" description="ลองเปลี่ยนตัวกรองแบรนด์" />
            </CardContent>
          </Card>
        ) : (
          models.map(({ product, matrix }) => (
            <Card
              key={product.id}
              id={"model-" + product.id}
              className={"scroll-mt-4 transition-shadow duration-500 " + (highlightId === product.id ? "ring-2 ring-[var(--color-primary-container)]" : "")}
            >
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={"/products/" + product.id} className="text-base font-semibold hover:text-[var(--color-primary-container)]">
                      {product.sellingName}
                    </Link>
                    {product.brandId && state.brands[product.brandId] && <Badge tone="primary">{state.brands[product.brandId].name}</Badge>}
                    {matrix.negativeCells > 0 && <Badge tone="danger">ติดลบ {matrix.negativeCells} ช่อง</Badge>}
                  </div>
                  <p className="text-sm text-[var(--color-on-surface-variant)]">
                    รวม <span className="font-bold text-[var(--color-on-surface)]">{formatNumber(matrix.grandTotal)}</span> ชิ้น
                  </p>
                </div>
                <MatrixTable matrix={matrix} />
              </CardContent>
            </Card>
          ))
        )}
      </PageContainer>
    </>
  );
}
