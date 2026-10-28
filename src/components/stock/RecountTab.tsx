"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { monthlyRecount, recountSheetRows, type ProductRecount } from "@/lib/utils/recountMatrix";
import { formatNumber } from "@/lib/utils/money";
import { MonthPicker, monthLabel, type YearMonth } from "./MonthPicker";

const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));
const diffTone = (n: number) => (n === 0 ? "text-[var(--color-on-surface-variant)]" : n > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]");

export function RecountTab({ brandId, setBrandId }: { brandId: string; setBrandId: (id: string) => void }) {
  const state = useStore();
  const [ym, setYm] = useState<YearMonth>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);

  const label = monthLabel(ym.year, ym.month0);
  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const warehouses = useMemo(() => Object.values(state.warehouses).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.warehouses]);
  const all = useMemo(() => monthlyRecount(state, ym.year, ym.month0, { warehouseId: warehouseId || undefined }), [state, ym, warehouseId]);
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => (!brandId || p.brandId === brandId) && (!q || p.name.toLowerCase().includes(q)) && (!onlyDiff || p.diffCells > 0));
  }, [all, search, brandId, onlyDiff]);

  const counted = products.reduce((s, p) => s + p.counted, 0);
  const system = products.reduce((s, p) => s + p.system, 0);
  const cells = products.reduce((s, p) => s + p.countedCells, 0);
  const diffCells = products.reduce((s, p) => s + p.diffCells, 0);

  function exportExcel() {
    if (products.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet(recountSheetRows(`ผลนับสต็อก ${label}`, products));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "นับสต็อก");
    XLSX.writeFile(wb, `นับสต็อก-${ym.year}-${String(ym.month0 + 1).padStart(2, "0")}.xlsx`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker value={ym} onChange={setYm} />
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
        <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="คลัง" className="w-44">
          <option value="">ทุกคลัง (รวมกัน)</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
        <label htmlFor="rc-only-diff" className="flex cursor-pointer items-center gap-2 text-sm">
          <input id="rc-only-diff" type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="h-4 w-4" />
          เฉพาะรุ่นที่ไม่ตรงกับระบบ
        </label>
        <Button variant="ghost" onClick={exportExcel} disabled={products.length === 0} className="ml-auto">
          <Download className="h-4 w-4" /> ส่งออก Excel
        </Button>
      </div>

      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ผลนับสต็อกเดือน {label}:</span> นับแล้ว {formatNumber(products.length)} รุ่น {formatNumber(cells)} ตัวเลือก · นับได้ {formatNumber(counted)} ชิ้น · ระบบก่อนนับ{" "}
        {formatNumber(system)} ชิ้น · ผลต่าง <span className={`font-semibold ${diffTone(counted - system)}`}>{signed(counted - system)}</span> · ไม่ตรงกับระบบ {formatNumber(diffCells)} ตัวเลือก
        <span className="block text-xs">ช่องสีแดง = นับได้น้อยกว่าระบบ (ขาด) · ช่องสีเขียว = นับได้มากกว่าระบบ (เกิน) · ตัวเลขเล็กในช่อง = ยอดในระบบก่อนบันทึกผลนับ · &quot;ตอนนี้&quot; = สต็อกปัจจุบัน (รวมรายการที่เคลื่อนไหวหลังนับ)</span>
      </p>

      {products.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={all.length === 0 ? "เดือนนี้ยังไม่มีการนับสต็อก" : "ไม่พบรุ่นที่ตรงกับตัวกรอง"}
            description={all.length === 0 ? "นับสต็อกแล้วบันทึกผล ตัวเลขจะมาขึ้นที่นี่ หรือเลือกเดือนอื่นที่เคยนับ" : "ลองล้างตัวกรองรุ่น/แบรนด์/คลัง"}
            action={
              all.length === 0 ? (
                <Link href="/stock-count" className="text-sm font-medium text-[var(--color-primary-container)] underline">
                  ไปหน้านับสต็อก
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        products.map((p, i) => <RecountBlock key={p.productId} product={p} defaultOpen={i < 3} />)
      )}
    </>
  );
}

function RecountBlock({ product: p, defaultOpen }: { product: ProductRecount; defaultOpen: boolean }) {
  return (
    <Card className="overflow-hidden">
      <details open={defaultOpen}>
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-base font-semibold text-[var(--color-on-surface)]">{p.name}</span>
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            นับแล้ว {p.countedCells}/{p.totalCells} ตัวเลือก · นับได้ {formatNumber(p.counted)} · ระบบก่อนนับ {formatNumber(p.system)} · ผลต่าง{" "}
            <span className={`font-semibold ${diffTone(p.diff)}`}>{signed(p.diff)}</span>
            {p.diffCells > 0 && <span className="text-[var(--color-danger)]"> (ไม่ตรง {p.diffCells} ตัวเลือก)</span>}
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
                <th className="bg-[var(--color-primary)] px-3 py-2 text-center font-medium">นับได้</th>
                <th className="bg-[var(--color-primary)] px-3 py-2 text-center font-medium">ระบบก่อนนับ</th>
                <th className="bg-[var(--color-primary)] px-3 py-2 text-center font-medium">ผลต่าง</th>
                <th className="bg-[var(--color-primary)] px-3 py-2 text-center font-medium">ตอนนี้</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.color} className="border-b border-[var(--color-border)]">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{r.color}</td>
                  {p.sizes.map((s) => {
                    const c = r.cells[s];
                    if (!c) return <td key={s} className="px-3 py-2 text-center text-[var(--color-on-surface-variant)]/40">–</td>;
                    const bg = c.diff < 0 ? "bg-[var(--color-danger-container)]" : c.diff > 0 ? "bg-[var(--color-success-container)]" : "";
                    return (
                      <td key={s} className={`px-3 py-1.5 text-center tabular-nums ${bg}`} title={c.diff === 0 ? "ตรงกับระบบ" : `ระบบ ${c.system} → นับได้ ${c.counted} (${signed(c.diff)})`}>
                        <span className="block font-medium">{formatNumber(c.counted)}</span>
                        {c.diff !== 0 && <span className={`block text-[10px] leading-none ${diffTone(c.diff)}`}>ระบบ {formatNumber(c.system)}</span>}
                      </td>
                    );
                  })}
                  <td className="bg-[var(--color-surface-container)] px-3 py-2 text-center font-semibold tabular-nums">{r.countedCells > 0 ? formatNumber(r.counted) : "–"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{r.countedCells > 0 ? formatNumber(r.system) : "–"}</td>
                  <td className={`px-3 py-2 text-center font-semibold tabular-nums ${r.countedCells > 0 ? diffTone(r.diff) : ""}`}>{r.countedCells > 0 ? signed(r.diff) : "–"}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-[var(--color-on-surface-variant)]">{formatNumber(r.now)}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-surface-container)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2">รวม</td>
                {p.sizes.map((s) => (
                  <td key={s} className="px-3 py-2" />
                ))}
                <td className="px-3 py-2 text-center tabular-nums">{formatNumber(p.counted)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{formatNumber(p.system)}</td>
                <td className={`px-3 py-2 text-center tabular-nums ${diffTone(p.diff)}`}>{signed(p.diff)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{formatNumber(p.now)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
