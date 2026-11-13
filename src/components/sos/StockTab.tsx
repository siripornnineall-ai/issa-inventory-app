"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSosLines } from "./useSosLines";
import { stockMatrices, type SosBranch, type SosImportRow } from "@/lib/utils/sosAnalysis";
import { latestImportPerBranch, sellThrough } from "@/lib/utils/sosView";
import { compareSizes } from "@/lib/utils/sizes";
import { useStore } from "@/lib/store";
import { formatThaiDate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

// สต็อก: "มีอะไรอยู่ที่สาขา" ใช้สต็อกจากไฟล์งวดล่าสุดของแต่ละสาขาในช่วงที่เลือก
// มีสถานะรายรุ่น (ค้าง / ใกล้หมด / ปกติ) เทียบกับยอดขายในช่วงเดียวกัน และตารางสี × ไซซ์
export function StockTab({ branches, selectedImports }: { branches: SosBranch[]; selectedImports: SosImportRow[] }) {
  const state = useStore();
  const stockImports = useMemo(() => latestImportPerBranch(selectedImports), [selectedImports]);
  const { stock, loading: l1, error: e1 } = useSosLines(stockImports.map((i) => i.id));
  const { sales, loading: l2, error: e2 } = useSosLines(selectedImports.map((i) => i.id));
  const loading = l1 || l2;
  const error = e1 ?? e2;

  const stockLines = useMemo(() => stock.map((s) => ({ branch_id: s.branch_id, variant_id: s.variant_id, description: s.description, sos_code: s.sos_code, qty: s.qty, net: null })), [stock]);
  const saleLines = useMemo(() => sales.filter((s) => s.section === "main").map((s) => ({ branch_id: s.branch_id, variant_id: s.variant_id, description: s.description, sos_code: s.sos_code, qty: s.qty, net: s.net })), [sales]);
  const rows = useMemo(() => sellThrough(state, saleLines, stockLines), [state, saleLines, stockLines]);
  const { matrices, other } = useMemo(() => stockMatrices(stock.map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })), compareSizes), [stock]);
  const total = stock.reduce((s, l) => s + l.qty, 0);

  if (stockImports.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีข้อมูลสต็อกในช่วงที่เลือก" description="เลือกสาขา/ช่วงเวลาอื่น หรือนำเข้าไฟล์จาก SOS ก่อน" />
      </Card>
    );
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const stuckCount = rows.filter((r) => r.status === "stuck").length;
  const lowCount = rows.filter((r) => r.status === "low").length;
  const hasNegative = stock.some((s) => s.qty < 0);

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status">
        <Card className="p-4">
          <p className="text-xs text-[var(--color-on-surface-variant)]">สต็อกที่สาขา</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{loading ? "..." : formatNumber(total)} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">ชิ้น</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-on-surface-variant)]">จำนวนรุ่น</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(rows.filter((r) => r.stock > 0).length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-on-surface-variant)]">ค้าง (ไม่ขายเลย)</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${stuckCount > 0 ? "text-[var(--color-yellow)]" : ""}`}>{formatNumber(stuckCount)} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">รุ่น</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-on-surface-variant)]">ใกล้หมด</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${lowCount > 0 ? "text-[var(--color-danger)]" : ""}`}>{formatNumber(lowCount)} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">รุ่น</span></p>
        </Card>
      </div>
      {hasNegative && <p className="px-1 text-xs text-[var(--color-danger)]">มีรายการติดลบในไฟล์ของ SOS (ข้อมูลฝั่ง SOS คลาดเคลื่อน)</p>}

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-primary-container)] text-white">
              <th className="px-4 py-2.5 text-left font-medium">รุ่น</th>
              {stockImports.map((i) => (
                <th key={i.branch_id} className="px-3 py-2.5 text-right font-medium">
                  {branchName(i.branch_id)}
                  <span className="block text-[10px] font-normal opacity-80">ณ {formatThaiDate(i.stock_as_of ?? i.period_end)}</span>
                </th>
              ))}
              <th className="bg-[var(--color-primary)] px-3 py-2.5 text-right font-medium">รวมมีของ</th>
              <th className="px-3 py-2.5 text-right font-medium">ขายแล้ว</th>
              <th className="px-4 py-2.5 text-left font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model} className="border-b border-[var(--color-border)]" title={r.note || undefined}>
                <td className="px-4 py-2 font-medium">{r.model}</td>
                {stockImports.map((i) => (
                  <td key={i.branch_id} className={`px-3 py-2 text-right tabular-nums ${r.stockByBranch[i.branch_id] ? "" : "text-[var(--color-on-surface-variant)]/50"}`}>
                    {r.stockByBranch[i.branch_id] ? formatNumber(r.stockByBranch[i.branch_id]) : "–"}
                  </td>
                ))}
                <td className="bg-[var(--color-surface-container)] px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(r.stock)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sold ? formatNumber(r.sold) : <span className="text-[var(--color-on-surface-variant)]/50">–</span>}</td>
                <td className="px-4 py-2">
                  {r.status === "stuck" && <Badge tone="yellow">ค้าง</Badge>}
                  {r.status === "low" && <Badge tone="danger">ใกล้หมด</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-on-surface-variant)]">
          ค้าง = มีของตั้งแต่ 5 ชิ้นแต่ไม่ขายเลยในช่วงที่เลือก · ใกล้หมด = ของเหลือน้อยกว่าที่ขายได้ · เลื่อนเมาส์ที่แถวเพื่อดูรายละเอียด · ขายแล้วนับเฉพาะส่วนปกติของรายงาน
        </p>
      </Card>

      <h2 className="px-1 text-sm font-semibold">สี / ไซซ์ รายรุ่น <span className="font-normal text-[var(--color-on-surface-variant)]">(กดที่รุ่นเพื่อดู รวมทุกสาขาที่เลือก)</span></h2>
      {matrices.map((m) => (
        <Card key={m.model} className="overflow-hidden">
          <details>
            <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-5 py-3">
              <span className="text-base font-semibold">{m.model}</span>
              <span className="text-sm text-[var(--color-on-surface-variant)]">{formatNumber(m.total)} ชิ้น · กดเพื่อดูสี/ไซซ์</span>
            </summary>
            <div className="overflow-x-auto px-5 pb-4">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--color-primary-container)] text-white">
                    <th className="px-3 py-2 text-left font-medium">สี</th>
                    {m.sizes.map((s) => (
                      <th key={s} className="px-3 py-2 text-center font-medium">
                        {s}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {m.colors.map((c) => (
                    <tr key={c.color} className="border-b border-[var(--color-border)]">
                      <td className="px-3 py-2 font-medium">{c.color}</td>
                      {m.sizes.map((s) => (
                        <td key={s} className={`px-3 py-2 text-center ${(c.cells[s] ?? 0) < 0 ? "font-semibold text-[var(--color-danger)]" : !c.cells[s] ? "text-[var(--color-on-surface-variant)]/50" : ""}`}>
                          {c.cells[s] === undefined ? "–" : formatNumber(c.cells[s])}
                        </td>
                      ))}
                      <td className="bg-[var(--color-surface-container)] px-3 py-2 text-center font-semibold">{formatNumber(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      ))}
      {other.length > 0 && (
        <Card className="p-5">
          <h2 className="text-base font-semibold">รายการอื่น (อ่านสี/ไซซ์ไม่ได้ เช่น เสื้อ เข็มขัด สีอื่น)</h2>
          <ul className="mt-2 divide-y divide-[var(--color-border)] text-sm">
            {other.map((o) => (
              <li key={o.code} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{o.description}</span>
                <span className="shrink-0 tabular-nums">{formatNumber(o.qty)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
