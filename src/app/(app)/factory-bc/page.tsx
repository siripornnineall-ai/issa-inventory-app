"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { useCan } from "@/lib/auth/session";
import { brandBarStyle } from "@/lib/utils/brandColor";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { formatNumber } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";
import { wipBatches, wipMatrices, wipSheetRows, type WipMatrix } from "@/lib/utils/factoryWipView";

function cellStyle(value: number, max: number): React.CSSProperties | undefined {
  if (value <= 0 || max <= 0) return undefined;
  const pct = Math.round(8 + 32 * Math.min(1, value / max));
  return { backgroundColor: `color-mix(in srgb, var(--bar, var(--color-primary-container)) ${pct}%, transparent)` };
}

function ModelBlock({ m }: { m: WipMatrix }) {
  const brand = useStore((s) => (m.brandId ? s.brands[m.brandId] : undefined));
  return (
    <Card className="overflow-hidden" style={brandBarStyle(brand)}>
      <details open>
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-base font-semibold text-[var(--color-on-surface)]">{m.name}</span>
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            ยังไม่เย็บ <span className={`font-semibold ${m.total < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-on-surface)]"}`}>{formatNumber(m.total)} ชิ้น</span>
            {m.negativeCells > 0 && <span className="text-[var(--color-danger)]"> · ติดลบ {m.negativeCells} ช่อง</span>}
          </span>
        </summary>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bar,var(--color-primary-container))] text-[color:var(--bar-fg,#fff)]">
                <th className="sticky left-0 z-10 bg-[var(--bar,var(--color-primary-container))] px-3 py-2 text-left font-medium">สี</th>
                {m.sizes.map((s) => (
                  <th key={s} className="px-3 py-2 text-center font-medium">
                    {s}
                  </th>
                ))}
                <th className="bg-[var(--bar-strong,var(--color-primary))] px-3 py-2 text-center font-medium text-[color:var(--bar-strong-fg,#fff)]">รวมต่อสี</th>
              </tr>
            </thead>
            <tbody>
              {m.colors.map((c) => (
                <tr key={c.color} className="border-b border-[var(--color-border)]">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{c.color}</td>
                  {m.sizes.map((s) => {
                    const n = c.cells[s];
                    return (
                      <td key={s} style={n === undefined ? undefined : cellStyle(n, m.maxCell)} className={`px-3 py-2 text-center ${n !== undefined && n < 0 ? "font-semibold text-[var(--color-danger)]" : !n ? "text-[var(--color-on-surface-variant)]/50" : ""}`}>
                        {n === undefined ? "–" : formatNumber(n)}
                      </td>
                    );
                  })}
                  <td className={`bg-[var(--color-surface-container)] px-3 py-2 text-center font-semibold ${c.total < 0 ? "text-[var(--color-danger)]" : ""}`}>{formatNumber(c.total)}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-surface-container)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2">รวมต่อไซซ์</td>
                {m.sizes.map((s) => (
                  <td key={s} className={`px-3 py-2 text-center ${(m.sizeTotals[s] ?? 0) < 0 ? "text-[var(--color-danger)]" : ""}`}>
                    {formatNumber(m.sizeTotals[s] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">{formatNumber(m.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function FactoryContent() {
  const state = useStore();
  const canRecord = useCan("stock.in");
  const [brandId, setBrandId] = useState("");
  const [search, setSearch] = useState("");
  const [historyLimit, setHistoryLimit] = useState(10);

  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const matrices = useMemo(() => wipMatrices(state, { brandId, search }), [state, brandId, search]);
  const batches = useMemo(() => wipBatches(state), [state]);
  const total = matrices.reduce((s, m) => s + m.total, 0);
  const negative = matrices.reduce((s, m) => s + m.negativeCells, 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => downloadWorkbook("โรงงาน-BC-ยังไม่เย็บ.xlsx", [{ name: "ยังไม่เย็บ", rows: wipSheetRows(state, matrices) }])} disabled={matrices.length === 0}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          {canRecord && (
            <Link href="/factory-bc/record">
              <Button>
                <Plus className="h-4 w-4" /> บันทึกตัวที่ยังไม่เย็บ
              </Button>
            </Link>
          )}
        </div>
      </div>

      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ยังไม่เย็บรวม:</span> {formatNumber(total)} ชิ้น จาก {matrices.length} รุ่น · ตัวที่ตัดเป็นชิ้นแล้วแต่ยังไม่ได้เย็บ ไม่รวมในสต็อกสินค้า ขายไม่ได้ ตอนเย็บเสร็จให้รับเข้าที่หน้า &quot;รับสินค้าเข้า&quot; แล้วเลือก &quot;เย็บเสร็จจากโรงงาน BC&quot; ยอดนี้จะลดลงให้เอง
      </p>
      {negative > 0 && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          มี {formatNumber(negative)} ช่องที่ยอดติดลบ แปลว่ารับเข้า &quot;เย็บเสร็จ&quot; มากกว่าที่บันทึกว่าตัดไว้ ควรบันทึก &quot;ตัดเข้า&quot; หรือ &quot;ปรับยอด&quot; ให้ตรงกับของจริง
        </p>
      )}

      {matrices.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="ยังไม่มีตัวที่ยังไม่เย็บ"
            description={canRecord ? "กด \"บันทึกตัวที่ยังไม่เย็บ\" เพื่อกรอกยอดตั้งต้น (นับตัวที่ตัดไว้แต่ยังไม่เย็บทั้งหมดที่โรงงาน)" : "ยังไม่มีการบันทึกจากโรงงาน BC"}
          />
        </Card>
      ) : (
        matrices.map((m) => <ModelBlock key={m.productId} m={m} />)
      )}

      <Card className="p-5">
        <h2 className="text-base font-semibold">ประวัติการบันทึก</h2>
        {batches.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีการบันทึก</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--color-border)] text-sm">
            {batches.slice(0, historyLimit).map((b) => (
              <li key={b.batchId} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {b.kindLabel} · {b.products.slice(0, 3).join(", ")}
                    {b.products.length > 3 && ` +${b.products.length - 3} รุ่น`}
                  </p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    {formatThaiDate(b.date)} · {b.actorName} · {formatNumber(b.cells)} ช่อง{b.note ? ` · ${b.note}` : ""}
                  </p>
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${b.pieces < 0 ? "text-[var(--color-danger)]" : ""}`}>
                  {b.pieces > 0 ? "+" : ""}
                  {formatNumber(b.pieces)} ชิ้น
                </p>
              </li>
            ))}
          </ul>
        )}
        {batches.length > historyLimit && (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => setHistoryLimit(historyLimit + 20)}>
              แสดงเพิ่ม
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

export default function FactoryBcPage() {
  return (
    <>
      <Header title="โรงงาน BC" description="ตัวที่ตัดเป็นชิ้นแล้วแต่ยังไม่ได้เย็บ แยกตามรุ่น สี และไซซ์ (ไม่รวมในสต็อกสินค้า)" />
      <PageContainer className="max-w-6xl">
        <RequireAccess perm="view.products">
          <div className="flex flex-col gap-5">
            <FactoryContent />
          </div>
        </RequireAccess>
      </PageContainer>
    </>
  );
}
