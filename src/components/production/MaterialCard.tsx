"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { formatNumber } from "@/lib/utils/money";
import { DEFAULT_MATERIAL_RATES, materialNeeds, parseRates, type MaterialRate } from "@/lib/utils/materialPlan";

const STORAGE_KEY = "issa-material-rates";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// วัสดุที่ต้องใช้ตามยอดที่ต้องผลิต (ตามจำนวนเดือนที่เลือกดูล่วงหน้า) อัตราใช้ต่อตัวแก้ได้ จำไว้ในเครื่องนี้
export function MaterialCard({ models, months, untilDate }: { models: { id: string; name: string; need: number }[]; months: string; untilDate: string }) {
  const [rates, setRates] = useState<MaterialRate[]>(() => {
    try {
      return parseRates(typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_MATERIAL_RATES;
    }
  });
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rates.map((x) => [x.key, String(x.perPiece)])));

  function edit(key: string, text: string) {
    setDraft((d) => ({ ...d, [key]: text }));
    const v = Number(text);
    if (text.trim() === "" || !Number.isFinite(v) || v < 0) return;
    const next = rates.map((r) => (r.key === key ? { ...r, perPiece: v } : r));
    setRates(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next.map((r) => [r.key, r.perPiece]))));
    } catch {
      // เก็บไม่ได้ก็ใช้ค่าในหน้านี้ไปก่อน
    }
  }

  const calc = useMemo(() => materialNeeds(models, rates), [models, rates]);

  function exportExcel() {
    const rows: (string | number)[][] = [
      [`วัสดุที่ต้องใช้ — ผลิตเพิ่มให้พอขาย ${months} เดือน (ถึง ${untilDate})`],
      [],
      ["อัตราใช้ต่อตัว", ...rates.map((r) => `${r.label} ${r.perPiece} ${r.unit}`)],
      [],
      ["รุ่น", "ต้องผลิต (ชิ้น)", ...rates.map((r) => `${r.label} (${r.unit})`)],
      ...calc.rows.map((m) => [m.name, m.pieces, ...rates.map((r) => Math.round(m.amounts[r.key] * 10) / 10)]),
      ["รวมทั้งหมด", calc.pieces, ...rates.map((r) => Math.round(calc.totals[r.key] * 10) / 10)],
    ];
    downloadWorkbook("วัสดุที่ต้องใช้.xlsx", [{ name: "วัสดุ", rows }]);
  }

  return (
    <Card className="p-5">
      <details open>
        <summary className="cursor-pointer text-sm font-semibold">
          วัสดุที่ต้องใช้ (ผลิตเพิ่มให้พอขาย {months} เดือน ถึง {untilDate})
        </summary>
        <div className="mt-4 flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap items-end gap-4">
            {rates.map((r) => (
              <label key={r.key} className="flex flex-col gap-1">
                <span className="text-[var(--color-on-surface-variant)]">
                  {r.label} ต่อตัว ({r.unit})
                </span>
                <Input inputMode="decimal" value={draft[r.key] ?? ""} onChange={(e) => edit(r.key, e.target.value)} aria-label={`${r.label} ต่อตัว`} className="w-28" />
              </label>
            ))}
            <span className="ml-auto">
              <Button variant="secondary" size="sm" onClick={exportExcel} disabled={calc.rows.length === 0}>
                <Download className="h-4 w-4" /> Excel
              </Button>
            </span>
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]">ใช้อัตราเดียวกันทุกรุ่น/สี/ไซซ์ (รวมเผื่อเสียแล้ว) แก้ตัวเลขด้านบนได้ ระบบจำไว้ในเครื่องนี้</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-[var(--color-on-surface-variant)]">ต้องผลิตรวม</p>
              <p className="text-2xl font-bold">{formatNumber(calc.pieces)} <span className="text-sm font-normal">ชิ้น</span></p>
            </div>
            {rates.map((r) => (
              <div key={r.key} className="rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-[var(--color-on-surface-variant)]">{r.label}รวม</p>
                <p className="text-2xl font-bold">{fmt(calc.totals[r.key])} <span className="text-sm font-normal">{r.unit}</span></p>
              </div>
            ))}
          </div>
          {calc.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table data-material className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-on-surface-variant)]">
                    <th className="py-1.5 pr-3 font-medium">รุ่น</th>
                    <th className="px-3 py-1.5 text-right font-medium">ต้องผลิต</th>
                    {rates.map((r) => (
                      <th key={r.key} className="px-3 py-1.5 text-right font-medium">
                        {r.label} ({r.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--color-border)]/60">
                      <td className="py-1.5 pr-3">{m.name}</td>
                      <td className="px-3 py-1.5 text-right">{formatNumber(m.pieces)}</td>
                      {rates.map((r) => (
                        <td key={r.key} className="px-3 py-1.5 text-right">
                          {fmt(m.amounts[r.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
