"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, Upload } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/client";
import { loadBaseline, saveBaseline } from "@/lib/supabase/salesBaseline";
import { toastError, toastSuccess } from "@/lib/toast";
import { brandBarStyle } from "@/lib/utils/brandColor";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { formatNumber } from "@/lib/utils/money";
import { PLAN_RULES, planSheetRows, productionPlan, type BaselineInput, type PlanMatrix } from "@/lib/utils/productionPlan";
import { matchBaseline, parseBaselineCsv, type BaselineMatch } from "@/lib/utils/salesBaselineImport";

function lastMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("sv-SE").slice(0, 8) + "01";
}

function ModelBlock({ m }: { m: PlanMatrix }) {
  const brand = useStore((s) => (m.brandId ? s.brands[m.brandId] : undefined));
  return (
    <Card className="overflow-hidden" style={brandBarStyle(brand)}>
      <details open>
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-base font-semibold">{m.name}</span>
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            ควรผลิตเพิ่ม <span className="font-semibold text-[var(--color-on-surface)]">{formatNumber(m.totals.need)} ชิ้น</span>
            {m.totals.urgent > 0 && <span className="font-semibold text-[var(--color-danger)]"> · เสี่ยงหมด {formatNumber(m.totals.urgent)} ช่อง</span>}
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
                    const cell = c.cells[s];
                    if (!cell) return <td key={s} className="px-3 py-2 text-center text-[var(--color-on-surface-variant)]/50">–</td>;
                    const cover = cell.coverDays === null ? "ไม่มียอดขาย" : `อยู่ได้ ~${formatNumber(Math.round(cell.coverDays))} วัน`;
                    return (
                      <td
                        key={s}
                        title={`ขาย ~${formatNumber(cell.demand)}/เดือน · ${cover} · คลัง ${cell.stock} + รอเย็บ ${cell.wip}`}
                        className={`px-2 py-2 text-center ${cell.level === "out" ? "bg-[var(--color-danger)] text-white" : cell.level === "low" ? "text-[var(--color-danger)]" : ""}`}
                        style={cell.level === "low" ? { backgroundColor: "color-mix(in srgb, var(--color-danger) 18%, transparent)" } : undefined}
                      >
                        <div className="font-bold">{cell.need > 0 ? `ผลิต ${formatNumber(cell.need)}` : "พอ"}</div>
                        <div className="text-[10px] font-normal leading-tight opacity-90">
                          คลัง {formatNumber(cell.stock)} · รอเย็บ {formatNumber(cell.wip)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="bg-[var(--color-surface-container)] px-3 py-2 text-center font-semibold">{formatNumber(c.need)}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-surface-container)] font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--color-surface-container)] px-3 py-2">รวมต่อไซซ์</td>
                {m.sizes.map((s) => (
                  <td key={s} className="px-3 py-2 text-center">
                    {formatNumber(m.sizeNeed[s] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">{formatNumber(m.totals.need)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function ImportCard({ onSaved }: { onSaved: () => void }) {
  const state = useStore();
  const user = useCurrentUser();
  const [fileName, setFileName] = useState("");
  const [match, setMatch] = useState<BaselineMatch | null>(null);
  const [month, setMonth] = useState(lastMonthStart());
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const blocks = parseBaselineCsv(await file.text());
      setFileName(file.name);
      setMatch(matchBaseline(state, blocks));
    } catch {
      toastError("อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ CSV ของชีตยอดขาย");
    }
  }

  async function save() {
    if (!match || !user || match.rows.length === 0) return;
    setBusy(true);
    try {
      const n = await saveBaseline(createClient(), match.rows, { month, fileName, userId: user.id, userName: user.name });
      toastSuccess(`บันทึกยอดขายอ้างอิง ${formatNumber(n)} ช่องแล้ว`);
      setMatch(null);
      onSaved();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4" /> นำเข้ายอดขายรายเดือนจากไฟล์ (CSV)
        </summary>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <p className="text-[var(--color-on-surface-variant)]">
            ใช้ไฟล์ชีตยอดขายแบบเดิม (หนึ่งบล็อกต่อรุ่น สี × ไซซ์) เก็บเป็นยอดอ้างอิงสำหรับวางแผนผลิตเท่านั้น <b>ไม่ใช่ออเดอร์ และไม่ตัดสต็อก</b> นำเข้าซ้ำเดือนเดิมจะทับของเดิม
          </p>
          <input type="file" accept=".csv,text/csv" aria-label="ไฟล์ยอดขาย" onChange={(e) => void pick(e.target.files?.[0])} />
          {match && (
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
              <p>
                จับคู่ได้ <b>{formatNumber(match.rows.length)}</b> ช่อง ({formatNumber(match.totalMatched)} จาก {formatNumber(match.totalFile)} ชิ้นในไฟล์)
              </p>
              {match.unmatchedModels.length > 0 && <p className="text-amber-800">ข้ามรุ่นที่ไม่พบในระบบ: {match.unmatchedModels.join(", ")}</p>}
              {match.unmatchedCells.length > 0 && (
                <p className="text-amber-800">
                  สี/ไซซ์ที่ไม่พบในระบบ {formatNumber(match.unmatchedCells.length)} ช่อง เช่น {match.unmatchedCells.slice(0, 5).map((c) => `${c.model} ${c.color} ${c.size}`).join(", ")}
                </p>
              )}
              <label className="flex items-center gap-2">
                ยอดนี้เป็นของเดือน
                <Input type="date" value={month} onChange={(e) => setMonth(e.target.value.slice(0, 8) + "01")} aria-label="เดือนของยอดขาย" className="w-44" />
              </label>
              <div>
                <Button onClick={() => void save()} disabled={busy || match.rows.length === 0}>
                  {busy ? "กำลังบันทึก..." : "บันทึกยอดขายอ้างอิง"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

function PlanContent() {
  const state = useStore();
  const [baseline, setBaseline] = useState<{ rows: BaselineInput[]; months: string[] }>({ rows: [], months: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [search, setSearch] = useState("");
  const [buffer, setBuffer] = useState(String(PLAN_RULES.defaultBuffer));

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setBaseline(await loadBaseline(createClient()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดตอนเปิดหน้า
    void reload();
  }, [reload]);

  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const matrices = useMemo(() => productionPlan(state, baseline.rows, { buffer: Number(buffer), brandId, search }), [state, baseline.rows, buffer, brandId, search]);
  const sum = matrices.reduce(
    (s, m) => ({ stock: s.stock + m.totals.stock, wip: s.wip + m.totals.wip, have: s.have + m.totals.have, need: s.need + m.totals.need, urgent: s.urgent + m.totals.urgent }),
    { stock: 0, wip: 0, have: 0, need: 0, urgent: 0 }
  );

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
        <Select value={buffer} onChange={(e) => setBuffer(e.target.value)} aria-label="เผื่อสำรอง" className="w-44">
          {[0, 0.1, 0.15, 0.2, 0.3].map((b) => (
            <option key={b} value={String(b)}>
              เผื่อสำรอง {Math.round(b * 100)}%
            </option>
          ))}
        </Select>
        <Button className="ml-auto" variant="ghost" onClick={() => downloadWorkbook("วางแผนผลิต.xlsx", [{ name: "วางแผนผลิต", rows: planSheetRows(state, matrices) }])} disabled={matrices.length === 0}>
          <Download className="h-4 w-4" /> Excel
        </Button>
      </div>

      <ImportCard onSaved={() => void reload()} />

      {error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}

      {loading ? (
        <p className="px-1 text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>
      ) : matrices.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="ยังไม่มียอดขายอ้างอิง" description="นำเข้าไฟล์ยอดขายรายเดือนด้านบนก่อน ระบบจะเทียบกับคลังและที่รอเย็บที่ BC ให้" />
        </Card>
      ) : (
        <>
          <div role="status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Card className="col-span-2 flex flex-col justify-center bg-[var(--color-primary-container)] p-4 sm:col-span-1">
              <span className="text-sm font-medium text-white/85">ควรผลิตเพิ่มรวม</span>
              <span className="text-3xl font-bold text-white">{formatNumber(sum.need)}</span>
              <span className="text-sm text-white/85">ชิ้น จาก {formatNumber(matrices.length)} รุ่น</span>
            </Card>
            <Card className="flex flex-col justify-center p-4">
              <span className="text-sm font-medium text-[var(--color-on-surface-variant)]">ของที่มีรวม</span>
              <span className="text-2xl font-bold">{formatNumber(sum.have)}</span>
              <span className="text-sm text-[var(--color-on-surface-variant)]">
                คลัง {formatNumber(sum.stock)} + รอเย็บที่ BC {formatNumber(sum.wip)}
              </span>
            </Card>
            <Card className="flex flex-col justify-center p-4">
              <span className="text-sm font-medium text-[var(--color-on-surface-variant)]">เสี่ยงหมดภายใน {PLAN_RULES.coverDaysAlert} วัน</span>
              <span className="text-2xl font-bold text-[var(--color-danger)]">{formatNumber(sum.urgent)}</span>
              <span className="text-sm text-[var(--color-on-surface-variant)]">ช่อง (สี/ไซซ์)</span>
            </Card>
          </div>
          <p className="px-1 text-sm text-[var(--color-on-surface-variant)]">
            ยอดขายอ้างอิงล่าสุด: {baseline.months.map((m) => m.slice(0, 7)).join(", ")} · <b>ผลิต N</b> = ยอดขายต่อเดือน (บวกเผื่อสำรอง) − (คลัง + รอเย็บที่ BC) · ในแต่ละช่องโชว์ <b>คลัง</b> และ <b>รอเย็บ</b> แยกกัน ·{" "}
            <span className="rounded bg-[var(--color-danger)] px-1.5 py-0.5 text-xs font-semibold text-white">แดงเข้ม</span> ไม่มีของเลย ·{" "}
            <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--color-danger)]" style={{ backgroundColor: "color-mix(in srgb, var(--color-danger) 18%, transparent)" }}>
              แดงอ่อน
            </span>{" "}
            อยู่ได้ไม่ถึง {PLAN_RULES.coverDaysAlert} วัน
          </p>
          {matrices.map((m) => (
            <ModelBlock key={m.productId} m={m} />
          ))}
        </>
      )}
    </>
  );
}

export default function ProductionPlanPage() {
  return (
    <>
      <Header title="วางแผนผลิต" description="เทียบยอดขายรายเดือนกับของที่มี (คลัง + รอเย็บที่ BC) เพื่อดูว่ารุ่น/สี/ไซซ์ไหนควรผลิตเพิ่ม" />
      <PageContainer className="max-w-6xl">
        <RequireAccess perm="report.view">
          <div className="flex flex-col gap-5">
            <PlanContent />
          </div>
        </RequireAccess>
      </PageContainer>
    </>
  );
}
