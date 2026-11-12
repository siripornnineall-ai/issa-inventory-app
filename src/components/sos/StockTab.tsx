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
  const stuck = rows.filter((r) => r.status === "stuck");

  if (stockImports.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีข้อมูลสต็อกในช่วงที่เลือก" description="เลือกสาขา/ช่วงเวลาอื่น หรือนำเข้าไฟล์จาก SOS ก่อน" />
      </Card>
    );
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">สต็อกที่สาขา:</span> {loading ? "กำลังโหลด..." : `${formatNumber(total)} ชิ้น`} ·{" "}
        {stockImports.map((i) => `${branchName(i.branch_id)} ณ ${formatThaiDate(i.stock_as_of ?? i.period_end)}`).join(" · ")}
        {stuck.length > 0 && <span className="font-medium text-[var(--color-danger)]"> · ค้าง {formatNumber(stuck.length)} รุ่น</span>}
        {stock.some((s) => s.qty < 0) && <span className="text-[var(--color-danger)]"> · มีรายการติดลบในไฟล์ของ SOS</span>}
      </p>

      <Card className="overflow-x-auto">
        <div className="px-5 pt-4">
          <h2 className="text-base font-semibold">สถานะรายรุ่น</h2>
          <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">ค้าง = มีของตั้งแต่ 5 ชิ้นแต่ไม่ขายเลยในช่วงที่เลือก · ใกล้หมด = ของเหลือน้อยกว่าที่ขายได้</p>
        </div>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-container)] text-left text-xs">
              <th className="px-5 py-2 font-medium">รุ่น</th>
              <th className="px-3 py-2 text-right font-medium">มีของ</th>
              <th className="px-3 py-2 text-right font-medium">ขายแล้ว</th>
              <th className="px-5 py-2 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model} className="border-t border-[var(--color-border)]">
                <td className="px-5 py-2 font-medium">{r.model}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.stock)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.sold)}</td>
                <td className="px-5 py-2">
                  {r.status === "stuck" && <Badge tone="yellow">ค้าง</Badge>}
                  {r.status === "low" && <Badge tone="danger">ใกล้หมด</Badge>}
                  {r.status === "ok" && <span className="text-xs text-[var(--color-on-surface-variant)]">ปกติ</span>}
                  {r.note && <span className="ml-2 text-xs text-[var(--color-on-surface-variant)]">{r.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

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
