"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSosLines } from "./useSosLines";
import { stockMatrices, type SosBranch, type SosImportRow } from "@/lib/utils/sosAnalysis";
import { compareSizes } from "@/lib/utils/sizes";
import { formatThaiDate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

// สต็อกที่สาขา ณ วันที่ในรายงาน (ตามไฟล์ที่นำเข้า) เป็นตารางสี x ไซซ์ต่อรุ่น
export function StockTab({ branches, imports }: { branches: SosBranch[]; imports: SosImportRow[] }) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const branchImports = useMemo(() => imports.filter((i) => i.branch_id === branchId).sort((a, b) => b.period_start.localeCompare(a.period_start)), [imports, branchId]);
  const [importId, setImportId] = useState("");
  const activeImport = branchImports.find((i) => i.id === importId) ?? branchImports[0];
  const { stock, loading, error } = useSosLines(activeImport ? [activeImport.id] : []);
  const { matrices, other } = useMemo(() => stockMatrices(stock.map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })), compareSizes), [stock]);
  const total = stock.reduce((s, l) => s + l.qty, 0);

  if (branches.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีสาขา" description="นำเข้าไฟล์จาก SOS ที่แท็บ นำเข้าไฟล์ ก่อน" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); setImportId(""); }} aria-label="สาขา" className="w-56">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select value={activeImport?.id ?? ""} onChange={(e) => setImportId(e.target.value)} aria-label="งวด" className="w-64">
          {branchImports.map((i) => (
            <option key={i.id} value={i.id}>
              สต็อก ณ {i.stock_as_of ? formatThaiDate(i.stock_as_of) : formatThaiDate(i.period_end)}
            </option>
          ))}
        </Select>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      {!activeImport ? (
        <Card className="p-8">
          <EmptyState title="สาขานี้ยังไม่มีข้อมูลสต็อก" />
        </Card>
      ) : (
        <>
          <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
            <span className="font-semibold text-[var(--color-on-surface)]">สต็อกที่สาขา:</span> {loading ? "กำลังโหลด..." : `${formatNumber(total)} ชิ้น จาก ${formatNumber(stock.length)} รายการ`}
            {stock.some((s) => s.qty < 0) && <span className="text-[var(--color-danger)]"> · มีรายการติดลบในไฟล์ของ SOS</span>}
          </p>
          {matrices.map((m) => (
            <Card key={m.model} className="overflow-hidden">
              <details open>
                <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-5 py-3">
                  <span className="text-base font-semibold">{m.model}</span>
                  <span className="text-sm text-[var(--color-on-surface-variant)]">{formatNumber(m.total)} ชิ้น</span>
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
        </>
      )}
    </div>
  );
}
