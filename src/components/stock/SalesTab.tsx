"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { REAL_DATA_START, changePct, firstSaleMs, monthsSince, salesBetween, salesSheetRows, type ProductSales } from "@/lib/utils/salesMatrix";
import { downloadWorkbook, monthSheets } from "@/lib/utils/excelMonths";
import { fullMonthOf, monthPeriod, periodFileKey, periodLabel, periodRange, previousRange, type Period } from "@/lib/utils/period";
import { formatNumber } from "@/lib/utils/money";
import { PeriodPicker } from "./PeriodPicker";

const realDataStartMs = () => new Date(REAL_DATA_START).getTime();

export function SalesTab({ brandId, setBrandId }: { brandId: string; setBrandId: (id: string) => void }) {
  const state = useStore();
  const [period, setPeriod] = useState<Period>(() => {
    const d = new Date();
    return monthPeriod(d.getFullYear(), d.getMonth());
  });
  const [search, setSearch] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  const label = periodLabel(period);
  const isMonth = fullMonthOf(period) !== null;
  const beforeRealData = periodRange(period).from < realDataStartMs();

  const salesFor = (p: Period) => salesBetween(state, periodRange(p), previousRange(p), { includeEmptyColors: showEmpty });
  const filterProducts = (list: ProductSales[]) => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => (!brandId || p.brandId === brandId) && (!q || p.name.toLowerCase().includes(q)));
  };

  const all = useMemo(() => salesBetween(state, periodRange(period), previousRange(period), { includeEmptyColors: showEmpty }), [state, period, showEmpty]);
  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => (!brandId || p.brandId === brandId) && (!q || p.name.toLowerCase().includes(q)));
  }, [all, search, brandId]);
  const totalNet = products.reduce((s, p) => s + p.net, 0);
  const firstSale = useMemo(() => firstSaleMs(state), [state]);

  const sheetTitle = (p: Period) => {
    const early = periodRange(p).from < realDataStartMs();
    return `ยอดขายสุทธิ ${periodLabel(p)}${early ? " (ช่วงก่อน 12 ต.ค. 2569 อาจไม่ครบ)" : ""}`;
  };

  // ส่งออกช่วงที่เลือก หรือทุกเดือนย้อนหลัง (หนึ่งชีตต่อเดือน) ใช้ตัวกรองรุ่น/แบรนด์/สีที่ตั้งไว้เหมือนกัน
  function exportExcel(allMonths: boolean) {
    if (!allMonths) {
      const list = filterProducts(salesFor(period));
      if (list.length === 0) return;
      downloadWorkbook(`ยอดขาย-${periodFileKey(period)}.xlsx`, [{ name: periodFileKey(period), rows: salesSheetRows(sheetTitle(period), list) }]);
      return;
    }
    const sheets = monthSheets(monthsSince(firstSale), (m) => {
      const p = monthPeriod(m.year, m.month0);
      const list = filterProducts(salesFor(p));
      return list.length === 0 ? null : salesSheetRows(sheetTitle(p), list);
    });
    downloadWorkbook("ยอดขาย-ทุกเดือน.xlsx", sheets);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => exportExcel(false)} disabled={products.length === 0}>
            <Download className="h-4 w-4" /> Excel ช่วงที่เลือก
          </Button>
          <Button variant="ghost" onClick={() => exportExcel(true)} disabled={firstSale === null} title="ไฟล์เดียว หนึ่งชีตต่อเดือน ย้อนหลังตั้งแต่เดือนที่มียอดขายครั้งแรก">
            <Download className="h-4 w-4" /> Excel ทุกเดือนย้อนหลัง
          </Button>
        </div>
      </div>

      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ยอดขายสุทธิ{label}:</span> {formatNumber(totalNet)} ชิ้น จาก {products.length} รุ่น · นับออเดอร์ที่ไม่ถูกยกเลิกตามวันที่ขาย และหักของคืน (ตีกลับ / คืน / เปลี่ยน) ตามวันที่รับคืนเข้าคลัง
      </p>

      {beforeRealData && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ช่วงที่เลือกมีวันก่อนที่ระบบเริ่มบันทึกการขายจริง (12 ต.ค. 2569) ข้อมูลช่วงนั้นเป็นข้อมูลทดสอบหรือยังบันทึกไม่ครบ ตัวเลขอาจไม่ตรงกับยอดขายจริง
        </p>
      )}

      {products.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="ไม่มียอดขายในช่วงนี้" description="ลองเลือกช่วงเวลาอื่น หรือล้างตัวกรองรุ่น/แบรนด์" />
        </Card>
      ) : (
        products.map((p, i) => <ProductBlock key={p.productId} product={p} defaultOpen={i < 3} prevLabel={isMonth ? "เดือนก่อน" : "ช่วงก่อนหน้า"} />)
      )}
    </>
  );
}
function cellStyle(value: number, max: number): React.CSSProperties | undefined {
  if (value <= 0 || max <= 0) return undefined;
  const pct = Math.round(8 + 32 * Math.min(1, value / max));
  return { backgroundColor: `color-mix(in srgb, var(--color-primary-container) ${pct}%, transparent)` };
}

function ProductBlock({ product: p, defaultOpen, prevLabel }: { product: ProductSales; defaultOpen: boolean; prevLabel: string }) {
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
                · {prevLabel} {formatNumber(p.prevNet)}
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
