"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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
  const [brandId, setBrandId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);

  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const warehouses = useMemo(() => Object.values(state.warehouses).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.warehouses]);

  const models = useMemo(() => {
    const qty = qtyByVariant(state, warehouseId || undefined);
    const q = search.trim().toLowerCase();
    const list = Object.values(state.products)
      .filter((p) => !brandId || p.brandId === brandId)
      .filter((p) => !q || p.sellingName.toLowerCase().includes(q) || (p.modelCode ?? "").toLowerCase().includes(q))
      .map((p) => {
        const variants = Object.values(state.variants).filter((v) => v.productId === p.id);
        return { product: p, matrix: buildStockMatrix(variants, qty, { hideEmpty }), colorCount: new Set(variants.map((v) => v.color)).size };
      })
      .filter((m) => m.matrix.sizes.length > 0);
    return list.sort((a, b) => b.matrix.grandTotal - a.matrix.grandTotal || a.product.sellingName.localeCompare(b.product.sellingName, "th"));
  }, [state, search, brandId, warehouseId, hideEmpty]);

  const grandTotal = models.reduce((sum, m) => sum + m.matrix.grandTotal, 0);
  const negativeTotal = models.reduce((sum, m) => sum + m.matrix.negativeCells, 0);

  return (
    <>
      <Header title="สต็อกภาพรวม" description="จำนวนคงเหลือของแต่ละรุ่น แยกตามสีและไซซ์" />
      <PageContainer>
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
              <Input id="so-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อรุ่นหรือรหัสรุ่น" className="pl-9" />
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
              <EmptyState icon={<Boxes className="h-10 w-10" />} title="ไม่พบรุ่นสินค้า" description="ลองเปลี่ยนคำค้นหาหรือตัวกรองแบรนด์" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* สรุปรายรุ่น: กดชื่อรุ่นเพื่อเลื่อนไปตารางของรุ่นนั้น */}
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                  <p className="text-sm font-semibold">สรุปแต่ละรุ่น</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    {formatNumber(models.length)} รุ่น · รวม <span className="font-semibold text-[var(--color-on-surface)]">{formatNumber(grandTotal)}</span> ชิ้น
                    {negativeTotal > 0 && <span className="ml-2 font-semibold text-[var(--color-danger)]">ติดลบ {formatNumber(negativeTotal)} ช่อง</span>}
                  </p>
                </div>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>รุ่น</Th>
                      <Th>แบรนด์</Th>
                      <Th className="text-right">จำนวนสี</Th>
                      <Th className="text-right">รวมคงเหลือ (ชิ้น)</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {models.map(({ product, matrix, colorCount }) => (
                      <Tr key={product.id}>
                        <Td className="font-medium">
                          <a href={"#model-" + product.id} className="hover:text-[var(--color-primary-container)] hover:underline">
                            {product.sellingName}
                          </a>
                        </Td>
                        <Td className="text-[var(--color-on-surface-variant)]">{product.brandId ? (state.brands[product.brandId]?.name ?? "-") : "-"}</Td>
                        <Td className="text-right tabular-nums">{formatNumber(colorCount)}</Td>
                        <Td className={"text-right font-semibold tabular-nums " + (matrix.grandTotal < 0 ? "text-[var(--color-danger)]" : "")}>{formatNumber(matrix.grandTotal)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardContent>
            </Card>

            {models.map(({ product, matrix }) => (
              <Card key={product.id} id={"model-" + product.id} className="scroll-mt-4">
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
            ))}
          </>
        )}
      </PageContainer>
    </>
  );
}
