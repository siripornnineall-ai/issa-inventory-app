"use client";

import { useIsMobile } from "@/lib/utils/useIsMobile";
import { MobileMatrix, type MxRow } from "@/components/ui/MobileMatrix";
import { ExcelPickButton } from "@/components/ui/ExcelPickButton";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { brandBarStyle } from "@/lib/utils/brandColor";
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
  const allModelItems = useMemo(() => Object.values(state.products).map((p) => ({ id: p.id, label: p.sellingName })).sort((a, b) => a.label.localeCompare(b.label, "th")), [state.products]);
  const firstSale = useMemo(() => firstSaleMs(state), [state]);

  const sheetTitle = (p: Period) => {
    const early = periodRange(p).from < realDataStartMs();
    return `ยอดขายสุทธิ ${periodLabel(p)}${early ? " (ช่วงก่อน 12 ต.ค. 2569 อาจไม่ครบ)" : ""}`;
  };

  // ส่งออกช่วงที่เลือก หรือทุกเดือนย้อนหลัง (หนึ่งชีตต่อเดือน) ใช้ตัวกรองรุ่น/แบรนด์/สีที่ตั้งไว้เหมือนกัน
  function exportExcel(allMonths: boolean, picked: Set<string>) {
    if (!allMonths) {
      const list = filterProducts(salesFor(period)).filter((p) => picked.has(p.productId));
      if (list.length === 0) return;
      downloadWorkbook(`ยอดขาย-${periodFileKey(period)}.xlsx`, [{ name: periodFileKey(period), rows: salesSheetRows(sheetTitle(period), list) }]);
      return;
    }
    const sheets = monthSheets(monthsSince(firstSale), (m) => {
      const p = monthPeriod(m.year, m.month0);
      const list = filterProducts(salesFor(p)).filter((x) => picked.has(x.productId));
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
          <ExcelPickButton label="Excel ช่วงที่เลือก" items={products.map((p) => ({ id: p.productId, label: p.name, hint: `${formatNumber(p.net)} ชิ้น` }))} onExport={(sel) => exportExcel(false, sel)} disabled={products.length === 0} />
          <ExcelPickButton label="Excel ทุกเดือนย้อนหลัง" items={allModelItems} onExport={(sel) => exportExcel(true, sel)} disabled={firstSale === null} title="ไฟล์เดียว หนึ่งชีตต่อเดือน ย้อนหลังตั้งแต่เดือนที่มียอดขายครั้งแรก" />
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
  return { backgroundColor: `color-mix(in srgb, var(--bar, var(--color-primary-container)) ${pct}%, transparent)` };
}

function ProductBlock({ product: p, defaultOpen, prevLabel }: { product: ProductSales; defaultOpen: boolean; prevLabel: string }) {
  const isMobile = useIsMobile();
  const change = changePct(p.net, p.prevNet);
  const brand = useStore((s) => (p.brandId ? s.brands[p.brandId] : undefined));
  return (
    <Card className="overflow-hidden" style={brandBarStyle(brand)}>
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
{isMobile ? (
          <MobileMatrix
            sizes={p.sizes}
            rows={p.colors.map<MxRow>((c) => ({
              key: c.color,
              label: c.color,
              summary: (
                <span className={c.total < 0 ? "font-semibold text-[var(--color-danger)]" : ""}>
                  รวม {formatNumber(c.total)}
                  {c.sharePct !== null && ` · ${c.sharePct}%`}
                </span>
              ),
              cells: Object.fromEntries(
                p.sizes
                  .filter((s) => (c.cells[s] ?? 0) !== 0)
                  .map((s) => {
                    const n = c.cells[s] ?? 0;
                    return [s, { value: formatNumber(n), tone: n < 0 ? "danger-text" : undefined, tint: n > 0 ? cellStyle(n, p.maxCell) : undefined }];
                  })
              ),
            }))}
            footer={{ label: "รวมต่อไซซ์", cells: Object.fromEntries(p.sizes.map((s) => [s, formatNumber(p.sizeTotals[s] ?? 0)])), summary: <>สุทธิ {formatNumber(p.net)}</> }}
          />
        ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bar,var(--color-primary-container))] text-[color:var(--bar-fg,#fff)]">
                <th className="sticky left-0 z-10 bg-[var(--bar,var(--color-primary-container))] px-3 py-2 text-left font-medium">สี</th>
                {p.sizes.map((s) => (
                  <th key={s} className="px-1.5 py-2 text-center sm:px-3 font-medium">
                    {s}
                  </th>
                ))}
                <th className="bg-[var(--bar-strong,var(--color-primary))] text-[color:var(--bar-strong-fg,#fff)] px-1.5 py-2 text-center sm:px-3 font-medium">รวมต่อสี</th>
                <th className="bg-[var(--bar-strong,var(--color-primary))] text-[color:var(--bar-strong-fg,#fff)] px-1.5 py-2 text-center sm:px-3 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {p.colors.map((c) => (
                <tr key={c.color} className="border-b border-[var(--color-border)]">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{c.color}</td>
                  {p.sizes.map((s) => {
                    const n = c.cells[s] ?? 0;
                    return (
                      <td key={s} style={cellStyle(n, p.maxCell)} className={`px-1.5 py-2 text-center sm:px-3 ${n < 0 ? "font-semibold text-[var(--color-danger)]" : n === 0 ? "text-[var(--color-on-surface-variant)]/50" : ""}`}>
                        {formatNumber(n)}
                      </td>
                    );
                  })}
                  <td className={`bg-[var(--color-surface-container)] px-1.5 py-2 text-center sm:px-3 font-semibold ${c.total < 0 ? "text-[var(--color-danger)]" : ""}`}>{formatNumber(c.total)}</td>
                  <td className="px-1.5 py-2 text-center sm:px-3 text-[var(--color-on-surface-variant)]">{c.sharePct === null ? "–" : `${c.sharePct}%`}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-surface-container)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2">รวมต่อไซซ์</td>
                {p.sizes.map((s) => (
                  <td key={s} className={`px-1.5 py-2 text-center sm:px-3 ${(p.sizeTotals[s] ?? 0) < 0 ? "text-[var(--color-danger)]" : ""}`}>
                    {formatNumber(p.sizeTotals[s] ?? 0)}
                  </td>
                ))}
                <td className="px-1.5 py-2 text-center sm:px-3">{formatNumber(p.net)}</td>
                <td className="px-1.5 py-2 text-center sm:px-3">{p.net > 0 ? "100%" : "–"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        )}
      </details>
    </Card>
  );
}
