"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { brandBarStyle } from "@/lib/utils/brandColor";
import { RECOUNT_REAL_START, firstCountMs, recountBetween, recountRealStartMs, recountSheetRows, type ProductRecount } from "@/lib/utils/recountMatrix";
import { monthsSince } from "@/lib/utils/salesMatrix";
import { downloadWorkbook, monthSheets } from "@/lib/utils/excelMonths";
import { monthPeriod, periodFileKey, periodLabel, periodRange, type Period } from "@/lib/utils/period";
import { formatNumber } from "@/lib/utils/money";
import { PeriodPicker } from "./PeriodPicker";
const earlyLabel = new Date(RECOUNT_REAL_START + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));
const diffTone = (n: number) => (n === 0 ? "text-[var(--color-on-surface-variant)]" : n > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]");

export function RecountTab({ brandId, setBrandId }: { brandId: string; setBrandId: (id: string) => void }) {
  const state = useStore();
  const [period, setPeriod] = useState<Period>(() => {
    const d = new Date();
    return monthPeriod(d.getFullYear(), d.getMonth());
  });
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  // ปกติซ่อนการนับก่อนวันที่เริ่มนับจริง (ช่วงตั้งต้นระบบ) เปิดเพื่อดูย้อนหลังได้
  const [includeEarly, setIncludeEarly] = useState(false);

  const label = periodLabel(period);
  const sinceMs = includeEarly ? 0 : recountRealStartMs();
  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const warehouses = useMemo(() => Object.values(state.warehouses).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.warehouses]);
  const recountFor = (p: Period) => recountBetween(state, periodRange(p), { warehouseId: warehouseId || undefined, sinceMs });
  const keep = (p: ProductRecount) => {
    const q = search.trim().toLowerCase();
    return (!brandId || p.brandId === brandId) && (!q || p.name.toLowerCase().includes(q)) && (!onlyDiff || p.diffCells > 0);
  };
  const all = useMemo(() => recountBetween(state, periodRange(period), { warehouseId: warehouseId || undefined, sinceMs }), [state, period, warehouseId, sinceMs]);
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => (!brandId || p.brandId === brandId) && (!q || p.name.toLowerCase().includes(q)) && (!onlyDiff || p.diffCells > 0));
  }, [all, search, brandId, onlyDiff]);

  const counted = products.reduce((s, p) => s + p.counted, 0);
  const system = products.reduce((s, p) => s + p.system, 0);
  const cells = products.reduce((s, p) => s + p.countedCells, 0);
  const diffCells = products.reduce((s, p) => s + p.diffCells, 0);

  const firstCount = useMemo(() => firstCountMs(state, sinceMs), [state, sinceMs]);

  // ส่งออกช่วงที่เลือก หรือทุกเดือนย้อนหลัง (หนึ่งชีตต่อเดือน) ใช้ตัวกรองรุ่น/แบรนด์/คลังและตัวเลือกซ่อนช่วงตั้งต้นที่ตั้งไว้เหมือนกัน
  function exportExcel(allMonths: boolean) {
    if (!allMonths) {
      const list = recountFor(period).filter(keep);
      if (list.length === 0) return;
      downloadWorkbook(`นับสต็อก-${periodFileKey(period)}.xlsx`, [{ name: periodFileKey(period), rows: recountSheetRows(`ผลนับสต็อก ${label}`, list) }]);
      return;
    }
    const sheets = monthSheets(monthsSince(firstCount), (m) => {
      const p = monthPeriod(m.year, m.month0);
      const list = recountFor(p).filter(keep);
      return list.length === 0 ? null : recountSheetRows(`ผลนับสต็อก ${periodLabel(p)}`, list);
    });
    downloadWorkbook("นับสต็อก-ทุกเดือน.xlsx", sheets);
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
        <label htmlFor="rc-early" className="flex cursor-pointer items-center gap-2 text-sm">
          <input id="rc-early" type="checkbox" checked={includeEarly} onChange={(e) => setIncludeEarly(e.target.checked)} className="h-4 w-4" />
          รวมการนับช่วงตั้งต้นระบบ (ก่อน {earlyLabel})
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => exportExcel(false)} disabled={products.length === 0}>
            <Download className="h-4 w-4" /> Excel ช่วงที่เลือก
          </Button>
          <Button variant="ghost" onClick={() => exportExcel(true)} disabled={firstCount === null} title="ไฟล์เดียว หนึ่งชีตต่อเดือน ย้อนหลังตั้งแต่เดือนที่นับสต็อกครั้งแรก">
            <Download className="h-4 w-4" /> Excel ทุกเดือนย้อนหลัง
          </Button>
        </div>
      </div>

      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ผลนับสต็อก{label}:</span> นับแล้ว {formatNumber(products.length)} รุ่น {formatNumber(cells)} ตัวเลือก · นับได้จริง {formatNumber(counted)} ชิ้น · ระบบเดิม (ก่อนนับ){" "}
        {formatNumber(system)} ชิ้น · ต่าง <span className={`font-semibold ${diffTone(counted - system)}`}>{signed(counted - system)}</span> ชิ้น · นับแล้วไม่ตรงกับระบบ {formatNumber(diffCells)} ตัวเลือก
      </p>
      <details className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-on-surface-variant)]" open>
        <summary className="cursor-pointer font-semibold text-[var(--color-on-surface)]">อ่านตารางนี้ยังไง</summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <span className="font-semibold text-[var(--color-on-surface)]">ตัวเลขใหญ่ในช่อง</span> = จำนวนที่นับได้จริงตอนนับ ถ้าไม่ตรงกับระบบ ช่องจะมีสี และมีตัวเล็กใต้เลขบอกว่า &quot;ระบบ N&quot; คือระบบเคยมีกี่ชิ้นก่อนบันทึกผลนับ
          </li>
          <li>
            <span className="rounded bg-[var(--color-success-container)] px-1">สีเขียว</span> = นับเจอมากกว่าที่ระบบมี (เกิน) · <span className="rounded bg-[var(--color-danger-container)] px-1">สีแดง</span> = นับเจอน้อยกว่าที่ระบบมี (ขาด) · ไม่มีสี = ตรงกัน · &quot;–&quot; = เดือนนี้ยังไม่ได้นับตัวเลือกนี้
          </li>
          <li>
            คอลัมน์ขวา: <span className="font-semibold text-[var(--color-on-surface)]">นับได้จริง</span> (รวมของที่นับ) · <span className="font-semibold text-[var(--color-on-surface)]">ระบบเดิม</span> (ยอดในระบบก่อนบันทึกผลนับ) ·{" "}
            <span className="font-semibold text-[var(--color-on-surface)]">ต่าง</span> = นับได้จริง − ระบบเดิม · <span className="font-semibold text-[var(--color-on-surface)]">สต็อกตอนนี้</span> = ยอดในระบบตอนนี้ (หลังบันทึกผลนับ ระบบปรับให้เท่าที่นับแล้ว จึงต่างจากนับได้จริงถ้ามีขายหรือรับของเข้าหลังจากนั้น)
          </li>
          <li>ตัวอย่าง: ช่อง ดำ/S ขึ้น 2 และ &quot;ระบบ 0&quot; แปลว่าตอนนับระบบมี 0 ชิ้น แต่ของจริงนับเจอ 2 ชิ้น ต่าง +2</li>
        </ul>
      </details>

      {products.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={all.length === 0 ? "ช่วงนี้ยังไม่มีการนับสต็อก" : "ไม่พบรุ่นที่ตรงกับตัวกรอง"}
            description={
              all.length === 0
                ? includeEarly
                  ? "นับสต็อกแล้วบันทึกผล ตัวเลขจะมาขึ้นที่นี่ หรือเลือกช่วงเวลาอื่น"
                  : `ตัวเลขจะขึ้นเมื่อมีการนับสต็อกจริงตั้งแต่ ${earlyLabel} เป็นต้นไป (นับที่หน้านับสต็อกแล้วบันทึกผล) หรือติ๊ก "รวมการนับช่วงตั้งต้นระบบ" เพื่อดูรอบก่อนหน้า`
                : "ลองล้างตัวกรองรุ่น/แบรนด์/คลัง"
            }
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
  const brand = useStore((s) => (p.brandId ? s.brands[p.brandId] : undefined));
  return (
    <Card className="overflow-hidden" style={brandBarStyle(brand)}>
      <details open={defaultOpen}>
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-base font-semibold text-[var(--color-on-surface)]">{p.name}</span>
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            นับแล้ว {p.countedCells}/{p.totalCells} ตัวเลือก · นับได้จริง {formatNumber(p.counted)} · ระบบเดิม {formatNumber(p.system)} · ต่าง{" "}
            <span className={`font-semibold ${diffTone(p.diff)}`}>{signed(p.diff)}</span>
            {p.diffCells > 0 && <span className="text-[var(--color-danger)]"> (ไม่ตรง {p.diffCells} ตัวเลือก)</span>}
          </span>
        </summary>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bar,var(--color-primary-container))] text-[color:var(--bar-fg,#fff)]">
                <th className="sticky left-0 z-10 bg-[var(--bar,var(--color-primary-container))] px-3 py-2 text-left font-medium">สี</th>
                {p.sizes.map((s) => (
                  <th key={s} className="px-3 py-2 text-center font-medium">
                    {s}
                  </th>
                ))}
                <th className="bg-[var(--bar-strong,var(--color-primary))] text-[color:var(--bar-strong-fg,#fff)] px-3 py-2 text-center font-medium">นับได้จริง</th>
                <th className="bg-[var(--bar-strong,var(--color-primary))] text-[color:var(--bar-strong-fg,#fff)] px-3 py-2 text-center font-medium">
                  ระบบเดิม<span className="block text-[10px] font-normal opacity-80">ก่อนนับ</span>
                </th>
                <th className="bg-[var(--bar-strong,var(--color-primary))] text-[color:var(--bar-strong-fg,#fff)] px-3 py-2 text-center font-medium">
                  ต่าง<span className="block text-[10px] font-normal opacity-80">นับได้ − ระบบเดิม</span>
                </th>
                <th className="bg-[var(--bar-strong,var(--color-primary))] text-[color:var(--bar-strong-fg,#fff)] px-3 py-2 text-center font-medium">
                  สต็อกตอนนี้<span className="block text-[10px] font-normal opacity-80">หลังขาย/รับของต่อ</span>
                </th>
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
