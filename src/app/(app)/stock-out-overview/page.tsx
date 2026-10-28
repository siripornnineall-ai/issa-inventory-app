"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { REAL_DATA_START, changePct, monthRange, monthlySales, salesSheetRows, shiftMonth, type ProductSales } from "@/lib/utils/salesMatrix";
import { formatNumber } from "@/lib/utils/money";

const monthLabel = (year: number, month0: number) => new Date(year, month0, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

function rangeLabel(year: number, month0: number) {
  const last = new Date(year, month0 + 1, 0).getDate();
  const m = new Date(year, month0, 1).toLocaleDateString("th-TH", { month: "short" });
  return `1–${last} ${m}`;
}

export default function StockOutOverviewPage() {
  const state = useStore();
  const today = new Date();
  const [ym, setYm] = useState({ year: today.getFullYear(), month0: today.getMonth() });
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  const isCurrent = ym.year === today.getFullYear() && ym.month0 === today.getMonth();
  const label = monthLabel(ym.year, ym.month0);
  const beforeRealData = monthRange(ym.year, ym.month0).from < new Date(REAL_DATA_START).getTime();

  const all = useMemo(() => monthlySales(state, ym.year, ym.month0, { includeEmptyColors: showEmpty }), [state, ym, showEmpty]);
  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => (!brandId || p.brandId === brandId) && (!q || p.name.toLowerCase().includes(q)));
  }, [all, search, brandId]);
  const totalNet = products.reduce((s, p) => s + p.net, 0);

  function go(delta: number) {
    setYm((cur) => shiftMonth(cur.year, cur.month0, delta));
  }

  function exportExcel() {
    if (products.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet(salesSheetRows(`ยอดขายสุทธิ ${label}`, products));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ยอดขาย");
    XLSX.writeFile(wb, `ยอดขาย-${ym.year}-${String(ym.month0 + 1).padStart(2, "0")}.xlsx`);
  }

  return (
    <>
      <Header title="สต็อกออกภาพรวม" description="ยอดขายสุทธิรายเดือนแยกตามรุ่น สี และไซซ์ (จำนวนชิ้น)" />
      <PageContainer>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1" role="group" aria-label="เลือกเดือน">
            <button type="button" onClick={() => go(-1)} aria-label="เดือนก่อน" className="rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[9.5rem] px-2 text-center text-sm font-semibold text-[var(--color-on-surface)]">{label}</span>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={isCurrent}
              aria-label="เดือนถัดไป"
              className="rounded-lg p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {!isCurrent && (
            <Button variant="ghost" size="sm" onClick={() => setYm({ year: today.getFullYear(), month0: today.getMonth() })}>
              เดือนนี้
            </Button>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหารุ่น" aria-label="ค้นหารุ่น" className="w-56 pl-9" />
          </div>
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="แบรนด์" className="w-44">
            <option value="">ทุกแบรนด์</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <label htmlFor="so-empty" className="flex cursor-pointer items-center gap-2 text-sm">
            <input id="so-empty" type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="h-4 w-4" />
            แสดงสีที่ไม่มียอด
          </label>
          <Button variant="ghost" onClick={exportExcel} disabled={products.length === 0} className="ml-auto">
            <Download className="h-4 w-4" /> ส่งออก Excel
          </Button>
        </div>

        <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
          <span className="font-semibold text-[var(--color-on-surface)]">
            ยอดขายสุทธิเดือน {label} ({rangeLabel(ym.year, ym.month0)}):
          </span>{" "}
          {formatNumber(totalNet)} ชิ้น จาก {products.length} รุ่น · นับออเดอร์ที่ไม่ถูกยกเลิกตามวันที่ขาย และหักของคืน (ตีกลับ / คืน / เปลี่ยน) ตามวันที่รับคืนเข้าคลัง
        </p>

        {beforeRealData && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            เดือนนี้มีช่วงก่อนวันที่ระบบเริ่มบันทึกการขายจริง (12 ต.ค. 2569) ข้อมูลช่วงนั้นเป็นข้อมูลทดสอบหรือยังบันทึกไม่ครบ ตัวเลขอาจไม่ตรงกับยอดขายจริง
          </p>
        )}

        {products.length === 0 ? (
          <Card className="p-8">
            <EmptyState title="ไม่มียอดขายในเดือนนี้" description="ลองเลือกเดือนอื่น หรือล้างตัวกรองรุ่น/แบรนด์" />
          </Card>
        ) : (
          products.map((p, i) => <ProductBlock key={p.productId} product={p} defaultOpen={i < 3} />)
        )}
      </PageContainer>
    </>
  );
}

function cellStyle(value: number, max: number): React.CSSProperties | undefined {
  if (value <= 0 || max <= 0) return undefined;
  const pct = Math.round(8 + 32 * Math.min(1, value / max));
  return { backgroundColor: `color-mix(in srgb, var(--color-primary-container) ${pct}%, transparent)` };
}

function ProductBlock({ product: p, defaultOpen }: { product: ProductSales; defaultOpen: boolean }) {
  const change = changePct(p.net, p.prevNet);
  return (
    <Card className="overflow-hidden">
      <details open={defaultOpen}>
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-base font-semibold text-[var(--color-on-surface)]">{p.name}</span>
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            ขาย {formatNumber(p.sold)} − คืน {formatNumber(p.returned)} = <span className="font-semibold text-[var(--color-on-surface)]">สุทธิ {formatNumber(p.net)} ชิ้น</span>
            {p.prevNet > 0 && (
              <>
                {" "}
                · เดือนก่อน {formatNumber(p.prevNet)}
                {change !== null && <span className={change >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}> ({change >= 0 ? "▲" : "▼"} {Math.abs(change)}%)</span>}
              </>
            )}
          </span>
        </summary>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-primary-container)] text-white">
                <th className="sticky left-0 z-10 bg-[var(--color-primary-container)] px-3 py-2 text-left font-medium">สี</th>
                {p.sizes.map((s) => (
                  <th key={s} className="px-3 py-2 text-center font-medium">
                    {s}
                  </th>
                ))}
                <th className="bg-[var(--color-primary)] px-3 py-2 text-center font-medium">รวมต่อสี</th>
                <th className="bg-[var(--color-primary)] px-3 py-2 text-center font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {p.colors.map((c) => (
                <tr key={c.color} className="border-b border-[var(--color-border)]">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{c.color}</td>
                  {p.sizes.map((s) => {
                    const n = c.cells[s] ?? 0;
                    return (
                      <td key={s} style={cellStyle(n, p.maxCell)} className={`px-3 py-2 text-center ${n < 0 ? "font-semibold text-[var(--color-danger)]" : n === 0 ? "text-[var(--color-on-surface-variant)]/50" : ""}`}>
                        {formatNumber(n)}
                      </td>
                    );
                  })}
                  <td className={`bg-[var(--color-surface-container)] px-3 py-2 text-center font-semibold ${c.total < 0 ? "text-[var(--color-danger)]" : ""}`}>{formatNumber(c.total)}</td>
                  <td className="px-3 py-2 text-center text-[var(--color-on-surface-variant)]">{c.sharePct === null ? "–" : `${c.sharePct}%`}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-surface-container)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2">รวมต่อไซซ์</td>
                {p.sizes.map((s) => (
                  <td key={s} className={`px-3 py-2 text-center ${(p.sizeTotals[s] ?? 0) < 0 ? "text-[var(--color-danger)]" : ""}`}>
                    {formatNumber(p.sizeTotals[s] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">{formatNumber(p.net)}</td>
                <td className="px-3 py-2 text-center">{p.net > 0 ? "100%" : "–"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
