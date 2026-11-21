"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { formatNumber } from "@/lib/utils/money";
import { materialByColor, materialNeeds, parsePocketMap, parseRates, type MaterialRate, type PocketColor } from "@/lib/utils/materialPlan";

const RATES_KEY = "issa-material-rates";
const POCKET_KEY = "issa-material-pocket-colors";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const round1 = (n: number) => Math.round(n * 10) / 10;

function read(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface MaterialModel {
  id: string;
  name: string;
  need: number;
  colors: { color: string; need: number }[];
}

// วัสดุที่ต้องใช้ตามยอดที่ต้องผลิต (ตามจำนวนเดือนที่เลือกดูล่วงหน้า): ผ้าหลักแยกตามสี ผ้ากระเป๋าแยกเป็นสีดำ/สีขาว
// อัตราต่อตัวและสีผ้ากระเป๋าของแต่ละสีแก้ได้ จำไว้ในเครื่องนี้
export function MaterialCard({ models, months, untilDate }: { models: MaterialModel[]; months: string; untilDate: string }) {
  const [rates, setRates] = useState<MaterialRate[]>(() => parseRates(read(RATES_KEY)));
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rates.map((x) => [x.key, String(x.perPiece)])));
  const [pocketMap, setPocketMap] = useState<Record<string, PocketColor>>(() => parsePocketMap(read(POCKET_KEY)));

  function edit(key: string, text: string) {
    setDraft((d) => ({ ...d, [key]: text }));
    const v = Number(text);
    if (text.trim() === "" || !Number.isFinite(v) || v < 0) return;
    const next = rates.map((r) => (r.key === key ? { ...r, perPiece: v } : r));
    setRates(next);
    try {
      localStorage.setItem(RATES_KEY, JSON.stringify(Object.fromEntries(next.map((r) => [r.key, r.perPiece]))));
    } catch {
      // เก็บไม่ได้ก็ใช้ค่าในหน้านี้ไปก่อน
    }
  }

  function setPocket(color: string, value: PocketColor) {
    const next = { ...pocketMap, [color]: value };
    setPocketMap(next);
    try {
      localStorage.setItem(POCKET_KEY, JSON.stringify(next));
    } catch {
      // เหมือนด้านบน
    }
  }

  const perPiece = useMemo(() => ({ main: rates.find((r) => r.key === "main")?.perPiece ?? 0, pocket: rates.find((r) => r.key === "pocket")?.perPiece ?? 0 }), [rates]);
  const byModel = useMemo(() => materialNeeds(models, rates), [models, rates]);
  const byColor = useMemo(() => materialByColor(models, perPiece, pocketMap), [models, perPiece, pocketMap]);

  function exportExcel() {
    const colorRows: (string | number)[][] = [
      [`วัสดุที่ต้องใช้ — ผลิตเพิ่มให้พอขาย ${months} เดือน (ถึง ${untilDate})`],
      [],
      ["อัตราต่อตัว", `ผ้าหลัก ${perPiece.main} หลา`, `ผ้ากระเป๋า ${perPiece.pocket} หลา`],
      [],
      ["สี", "ต้องผลิต (ชิ้น)", "ผ้าหลัก (หลา)", "ผ้ากระเป๋า (หลา)", "สีผ้ากระเป๋า"],
      ...byColor.rows.map((r) => [r.color, r.pieces, round1(r.main), round1(r.pocket), r.pocketColor || "ไม่ระบุ"]),
      ["รวมทั้งหมด", byModel.pieces, round1(byModel.totals.main), round1(byModel.totals.pocket), ""],
      [],
      ["ผ้ากระเป๋าสีดำรวม (หลา)", round1(byColor.pocketTotals.ดำ)],
      ["ผ้ากระเป๋าสีขาวรวม (หลา)", round1(byColor.pocketTotals.ขาว)],
      ...(byColor.pocketTotals.ไม่ระบุ > 0 ? [["ผ้ากระเป๋า ยังไม่ระบุสี (หลา)", round1(byColor.pocketTotals.ไม่ระบุ)]] : []),
    ];
    const modelRows: (string | number)[][] = [
      ["รุ่น", "ต้องผลิต (ชิ้น)", "ผ้าหลัก (หลา)", "ผ้ากระเป๋า (หลา)"],
      ...byModel.rows.map((m) => [m.name, m.pieces, round1(m.amounts.main), round1(m.amounts.pocket)]),
      ["รวมทั้งหมด", byModel.pieces, round1(byModel.totals.main), round1(byModel.totals.pocket)],
    ];
    downloadWorkbook("วัสดุที่ต้องใช้.xlsx", [
      { name: "ตามสี", rows: colorRows },
      { name: "ตามรุ่น", rows: modelRows },
    ]);
  }

  const unassigned = byColor.pocketTotals.ไม่ระบุ;

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
              <Button variant="secondary" size="sm" onClick={exportExcel} disabled={byColor.rows.length === 0}>
                <Download className="h-4 w-4" /> Excel
              </Button>
            </span>
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]">ใช้อัตราเดียวกันทุกรุ่น/สี/ไซซ์ (รวมเผื่อเสียแล้ว) แก้ตัวเลขและสีผ้ากระเป๋าของแต่ละสีได้ ระบบจำไว้ในเครื่องนี้</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-[var(--color-on-surface-variant)]">ต้องผลิตรวม</p>
              <p className="text-2xl font-bold">
                {formatNumber(byModel.pieces)} <span className="text-sm font-normal">ชิ้น</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-[var(--color-on-surface-variant)]">ผ้าหลักรวม</p>
              <p className="text-2xl font-bold">
                {fmt(byModel.totals.main)} <span className="text-sm font-normal">หลา</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-[var(--color-on-surface-variant)]">ผ้ากระเป๋าสีดำ</p>
              <p className="text-2xl font-bold">
                {fmt(byColor.pocketTotals.ดำ)} <span className="text-sm font-normal">หลา</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-[var(--color-on-surface-variant)]">ผ้ากระเป๋าสีขาว</p>
              <p className="text-2xl font-bold">
                {fmt(byColor.pocketTotals.ขาว)} <span className="text-sm font-normal">หลา</span>
              </p>
            </div>
          </div>
          {unassigned > 0 && (
            <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              ผ้ากระเป๋า {fmt(unassigned)} หลา ยังไม่ระบุสี (สีเสื้อที่ยังไม่ได้เลือกว่าใช้ผ้ากระเป๋าดำหรือขาว) เลือกในช่อง “สีผ้ากระเป๋า” ของสีนั้นด้านล่าง
            </p>
          )}

          {byColor.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table data-material className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-on-surface-variant)]">
                    <th className="py-1.5 pr-3 font-medium">สี</th>
                    <th className="px-3 py-1.5 text-right font-medium">ต้องผลิต</th>
                    <th className="px-3 py-1.5 text-right font-medium">ผ้าหลัก (หลา)</th>
                    <th className="px-3 py-1.5 text-right font-medium">ผ้ากระเป๋า (หลา)</th>
                    <th className="px-3 py-1.5 font-medium">สีผ้ากระเป๋า</th>
                  </tr>
                </thead>
                <tbody>
                  {byColor.rows.map((r) => (
                    <tr key={r.color} className="border-b border-[var(--color-border)]/60">
                      <td className="py-1.5 pr-3">{r.color}</td>
                      <td className="px-3 py-1.5 text-right">{formatNumber(r.pieces)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(r.main)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(r.pocket)}</td>
                      <td className="px-3 py-1.5">
                        <Select value={r.pocketColor} onChange={(e) => setPocket(r.color, e.target.value as PocketColor)} aria-label={`สีผ้ากระเป๋าของสี${r.color}`} className="w-32">
                          <option value="">ยังไม่ระบุ</option>
                          <option value="ดำ">ดำ</option>
                          <option value="ขาว">ขาว</option>
                        </Select>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1.5 pr-3">รวม</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(byModel.pieces)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(byModel.totals.main)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(byModel.totals.pocket)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {byModel.rows.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-1 text-[var(--color-on-surface-variant)]">แยกตามรุ่น</p>
              <table data-material className="w-full text-left">
                <tbody>
                  {byModel.rows.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--color-border)]/60">
                      <td className="py-1.5 pr-3">{m.name}</td>
                      <td className="px-3 py-1.5 text-right">{formatNumber(m.pieces)} ชิ้น</td>
                      <td className="px-3 py-1.5 text-right">ผ้าหลัก {fmt(m.amounts.main)}</td>
                      <td className="px-3 py-1.5 text-right">ผ้ากระเป๋า {fmt(m.amounts.pocket)}</td>
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
