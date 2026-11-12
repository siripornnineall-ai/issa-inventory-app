"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSosLines } from "./useSosLines";
import { rankModels, skuMatrix } from "@/lib/utils/sosView";
import type { SosBranch, SosImportRow } from "@/lib/utils/sosAnalysis";
import { useStore } from "@/lib/store";
import { formatNumber, formatTHB } from "@/lib/utils/money";

// ยอดขาย: "ขายอะไรไปเท่าไร" จัดอันดับรุ่น (ชิ้น ยอดเงิน สัดส่วน) กดขยายดูเป็นตารางสี × ไซซ์ (จำนวนชิ้น) ถ้าเลือกทุกสาขาแสดงยอดแยกรายสาขาใต้ตาราง
// นับเฉพาะส่วนปกติของรายงาน (ส่วนบัตรเครดิตยังไม่นับ)
export function SalesTab({ branches, selectedImports }: { branches: SosBranch[]; selectedImports: SosImportRow[] }) {
  const state = useStore();
  const { sales, loading, error } = useSosLines(selectedImports.map((i) => i.id));
  const ranks = useMemo(
    () => rankModels(state, sales.filter((s) => s.section === "main").map((s) => ({ branch_id: s.branch_id, variant_id: s.variant_id, description: s.description, sos_code: s.sos_code, qty: s.qty, net: s.net }))),
    [state, sales]
  );
  const shownBranches = branches.filter((b) => selectedImports.some((i) => i.branch_id === b.id));
  const showByBranch = shownBranches.length > 1;
  const total = ranks.reduce((s, r) => s + r.qty, 0);
  const totalNet = ranks.reduce((s, r) => s + r.net, 0);

  if (selectedImports.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีข้อมูลในช่วงที่เลือก" description="เลือกสาขา/ช่วงเวลาอื่น หรือนำเข้าไฟล์จาก SOS ก่อน" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ยอดขายที่ SOS:</span> {loading ? "กำลังโหลด..." : `${formatNumber(total)} ชิ้น · ${formatTHB(totalNet)} จาก ${formatNumber(ranks.length)} รุ่น`} · เรียงจากขายได้มากไปน้อย กดที่รุ่นเพื่อดูสี/ไซซ์
      </p>
      {ranks.map((r) => (
        <Card key={r.model} className="overflow-hidden">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="w-8 text-sm font-semibold text-[var(--color-on-surface-variant)]">#{r.rank}</span>
              <span className="min-w-0 flex-1 basis-40 text-base font-semibold">{r.model}</span>
              {showByBranch && (
                <span className="text-xs text-[var(--color-on-surface-variant)]">
                  {shownBranches.filter((b) => r.byBranch[b.id]).map((b) => `${b.name} ${r.byBranch[b.id]}`).join(" · ")}
                </span>
              )}
              <span className="text-sm tabular-nums">
                <span className="font-semibold">{formatNumber(r.qty)}</span> ชิ้น · {formatTHB(r.net)} · {r.sharePct}%
              </span>
            </summary>
            <div className="overflow-x-auto px-5 pb-4">
              {(() => {
                const product = Object.values(state.products).find((p) => p.sellingName.trim().toLowerCase() === r.model.trim().toLowerCase());
                const m = skuMatrix(r.skus, product);
                return (
                  <>
                    {m.rows.length > 0 && (
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
                          {m.rows.map((row) => (
                            <tr key={row.color} className="border-b border-[var(--color-border)]">
                              <td className="px-3 py-2 font-medium">{row.color}</td>
                              {m.sizes.map((s) => {
                                const n = row.cells[s];
                                return (
                                  <td key={s} style={n ? { backgroundColor: `color-mix(in srgb, var(--color-primary-container) ${Math.round(10 + 30 * (n / Math.max(1, m.max)))}%, transparent)` } : undefined} className={`px-3 py-2 text-center ${n ? "font-medium" : "text-[var(--color-on-surface-variant)]/50"}`}>
                                    {n ? formatNumber(n) : "–"}
                                  </td>
                                );
                              })}
                              <td className="bg-[var(--color-surface-container)] px-3 py-2 text-center font-semibold">{formatNumber(row.total)}</td>
                            </tr>
                          ))}
                          <tr className="bg-[var(--color-surface-container)] font-semibold">
                            <td className="px-3 py-2">รวมต่อไซซ์</td>
                            {m.sizes.map((s) => (
                              <td key={s} className="px-3 py-2 text-center">
                                {formatNumber(m.sizeTotals[s] ?? 0)}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center">{formatNumber(r.qty)}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {m.other.length > 0 && (
                      <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
                        รายการที่อ่านสี/ไซซ์ไม่ได้: {m.other.map((o) => `${o.label} (${o.qty})`).join(", ")}
                      </p>
                    )}
                    {showByBranch && (
                      <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">แยกตามสาขา: {shownBranches.filter((b) => r.byBranch[b.id]).map((b) => `${b.name} ${r.byBranch[b.id]} ชิ้น`).join(" · ")}</p>
                    )}
                  </>
                );
              })()}
            </div>
          </details>
        </Card>
      ))}
      {!loading && ranks.length === 0 && (
        <Card className="p-8">
          <EmptyState title="ไม่มียอดขายในช่วงนี้" />
        </Card>
      )}
    </div>
  );
}
