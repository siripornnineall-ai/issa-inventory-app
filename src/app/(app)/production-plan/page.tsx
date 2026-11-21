"use client";

import { compactCellNumber, useIsMobile } from "@/lib/utils/useIsMobile";
import { ExcelPickButton } from "@/components/ui/ExcelPickButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Upload } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card } from "@/components/ui/Card";
import { MaterialSideTable } from "@/components/production/MaterialSideTable";
import { useMaterialSettings, type MaterialSettings } from "@/components/production/useMaterialSettings";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { useCan, useCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/client";
import { loadBaseline, saveBaseline } from "@/lib/supabase/salesBaseline";
import { toastError, toastSuccess } from "@/lib/toast";
import { REAL_DATA_START, monthRange, netSalesByVariant } from "@/lib/utils/salesMatrix";
import { brandBarStyle } from "@/lib/utils/brandColor";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { formatNumber } from "@/lib/utils/money";
import { addMonthsClamped, averageBaseline, formatPlanDate, planSheet, productionPlan, type BaselineInput, type PlanCell, type PlanMatrix } from "@/lib/utils/productionPlan";
import { matchBaseline, parseBaselineCsv, parseBaselineSheets, type BaselineMatch } from "@/lib/utils/salesBaselineImport";

function lastMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("sv-SE").slice(0, 8) + "01";
}

const fmt1 = (n: number) => formatNumber(Math.round(n));
const lowStyle = { backgroundColor: "color-mix(in srgb, var(--color-danger) 18%, transparent)" };

type Metric = "demand" | "stock" | "need";
const METRIC_TITLE: Record<Metric, string> = {
  demand: "ยอดขาย (ชิ้น)",
  stock: "สต็อกปัจจุบัน (ชิ้น)",
  need: "ที่ต้องผลิตเพิ่ม (ชิ้น)",
};
const METRIC_HINT: Record<Metric, string> = {
  demand: "ยอดขายต่อเดือน × จำนวนเดือนที่เลือก · % = สัดส่วนของแต่ละสีในยอดขายรุ่นนี้",
  stock: "คลัง · ถ้ามีชิ้นรอเย็บที่ BC ขึ้นบรรทัดเล็ก +N รอเย็บ แยกไว้",
  need: "แดงติดลบ = ขาด (ต้องผลิตเท่าที่ติดลบ) · เทา = มีของพอ (จำนวนคลัง + รอเย็บ)",
};
const METRICS: Metric[] = ["demand", "stock", "need"];

// หนึ่งตารางต่อหนึ่งตัวชี้วัด ความกว้างคอลัมน์คงที่ วางเรียงข้างกันในแถวเดียวของรุ่น เลื่อนซ้าย-ขวาดูได้เหมือนชีต
function MetricTable({ m, metric, showHave }: { m: PlanMatrix; metric: Metric; showHave: boolean }) {
  const mobile = useIsMobile();
  const fc = (n: number) => compactCellNumber(Math.round(n), mobile, formatNumber);
  const value = (c: { demand: number; stock: number; need: number }) => (metric === "demand" ? c.demand : metric === "stock" ? c.stock : c.need);
  const rowSum = (cells: Record<string, PlanCell>) => Object.values(cells).reduce((t, c) => t + value(c), 0);
  const colSum = (size: string) => m.colors.reduce((t, c) => t + (c.cells[size] ? value(c.cells[size]) : 0), 0);
  const wipSum = (cells: Record<string, PlanCell>) => Object.values(cells).reduce((t, c) => t + c.wip, 0);
  const grand = m.colors.reduce((t, c) => t + rowSum(c.cells), 0);
  const grandWip = m.colors.reduce((t, c) => t + wipSum(c.cells), 0);
  const sub = metric === "stock";
  const negNeed = metric === "need" && showHave; // โหมดเลขตัวเดียว: ที่ขาดแสดงติดลบสีแดง
  const wipNote = (n: number) => (sub && n > 0 ? <div className="whitespace-nowrap text-[10px] font-normal leading-tight text-[var(--color-on-surface-variant)]">+{formatNumber(n)}<span className="hidden sm:inline"> รอเย็บ</span></div> : null);
  return (
    <div className="w-full sm:w-[56rem] sm:shrink-0">
      <p className="mb-1 min-h-10 text-sm font-semibold">
        {METRIC_TITLE[metric]} <span className="font-normal text-[var(--color-on-surface-variant)]">· {METRIC_HINT[metric]}</span>
      </p>
      <table className="mx-compact w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="h-10 bg-[var(--bar,var(--color-primary-container))] text-[color:var(--bar-fg,#fff)]">
            <th className="w-24 px-3 py-2 text-left font-medium">สี</th>
            {m.sizes.map((s) => (
              <th key={s} className="w-12 px-0.5 py-2 text-center font-medium">
                {s}
              </th>
            ))}
            <th className="w-20 bg-[var(--bar-strong,var(--color-primary))] px-2 py-2 text-center font-medium text-[color:var(--bar-strong-fg,#fff)]">รวม</th>
            {metric === "demand" && <th className="w-16 px-2 py-2 text-center font-medium max-sm:hidden">%</th>}
          </tr>
        </thead>
        <tbody>
          {m.colors.map((c) => (
            <tr key={c.color} className="h-11 border-b sm:h-14 border-[var(--color-border)]">
              <td className="whitespace-nowrap px-3 py-2 font-medium">{c.color}</td>
              {m.sizes.map((s) => {
                const cell = c.cells[s];
                if (!cell) return <td key={s} className="px-1 py-2 text-center text-[var(--color-on-surface-variant)]/40">–</td>;
                const v = value(cell);
                const shortage = metric === "need" && cell.need > 0;
                return (
                  <td
                    key={s}
                    title={`ยอดขาย ${fmt1(cell.demand)} · คลัง ${cell.stock} · รอเย็บ ${cell.wip} · ควรผลิต ${cell.need}`}
                    className={`px-1 py-2 text-center ${shortage ? (cell.level === "out" ? "bg-[var(--color-danger)] font-bold text-white" : "font-bold text-[var(--color-danger)]") : v === 0 ? "text-[var(--color-on-surface-variant)]/40" : ""}`}
                    style={shortage && cell.level !== "out" ? lowStyle : undefined}
                  >
                    {metric === "need" && showHave ? (
                      // เลขตัวเดียวต่อช่อง: ขาด = ติดลบสีแดง (ต้องผลิตเท่าที่ติดลบ) / ไม่ขาด = จำนวนของที่มี (คลัง + รอเย็บ) สีเทา
                      shortage ? (
                        `-${fc(cell.need)}`
                      ) : (
                        <span className="font-normal text-[var(--color-on-surface-variant)]">{fc(cell.have)}</span>
                      )
                    ) : v === 0 && metric !== "stock" ? (
                      "–"
                    ) : (
                      fc(v)
                    )}
                    {wipNote(cell.wip)}
                  </td>
                );
              })}
              <td className={`bg-[var(--color-surface-container)] px-2 py-2 text-center font-semibold ${negNeed && rowSum(c.cells) > 0 ? "text-[var(--color-danger)]" : ""}`}>
                {negNeed ? (rowSum(c.cells) > 0 ? `-${fmt1(rowSum(c.cells))}` : "0") : fmt1(rowSum(c.cells))}
                {wipNote(wipSum(c.cells))}
              </td>
              {metric === "demand" && (
                <td className="px-2 py-2 text-center text-[var(--color-on-surface-variant)] max-sm:hidden">{grand > 0 ? `${(Math.round((rowSum(c.cells) / grand) * 1000) / 10).toFixed(1)}%` : "–"}</td>
              )}
            </tr>
          ))}
          <tr className="h-14 bg-[var(--color-surface-container)] font-semibold">
            <td className="px-3 py-2">รวม</td>
            {m.sizes.map((s) => (
              <td key={s} className={`px-1 py-2 text-center ${negNeed && colSum(s) > 0 ? "text-[var(--color-danger)]" : ""}`}>
                {negNeed ? (colSum(s) > 0 ? `-${fc(colSum(s))}` : "0") : fc(colSum(s))}
              </td>
            ))}
            <td className={`px-2 py-2 text-center ${negNeed && grand > 0 ? "text-[var(--color-danger)]" : ""}`}>
              {negNeed ? (grand > 0 ? `-${fmt1(grand)}` : "0") : fmt1(grand)}
              {wipNote(grandWip)}
            </td>
            {metric === "demand" && <td className="px-2 py-2 text-center max-sm:hidden">{grand > 0 ? "100%" : "–"}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ModelBlock({ m, showHave, material }: { m: PlanMatrix; showHave: boolean; material: MaterialSettings }) {
  const brand = useStore((s) => (m.brandId ? s.brands[m.brandId] : undefined));
  return (
    <Card className="overflow-hidden" style={brandBarStyle(brand)}>
      <details open>
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <span className="text-base font-semibold">
            {m.name}
            {m.shape && <span className="ml-2 text-sm font-normal text-[var(--color-on-surface-variant)]">{m.shape}</span>}
          </span>
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            ควรผลิตเพิ่ม <span className="font-semibold text-[var(--color-on-surface)]">{formatNumber(m.totals.need)} ชิ้น</span>
            {m.totals.urgent > 0 && <span className="font-semibold text-[var(--color-danger)]"> · ขาด {formatNumber(m.totals.urgent)} ช่อง</span>}
          </span>
        </summary>
        <div className="flex flex-col gap-5 overflow-x-auto px-2 pb-4 sm:flex-row sm:gap-8 sm:px-5 sm:pb-5">
          {METRICS.map((metric) => (
            <MetricTable key={metric} m={m} metric={metric} showHave={showHave} />
          ))}
          {m.totals.need > 0 && <MaterialSideTable colors={m.colors.map((c) => ({ color: c.color, need: c.need }))} settings={material} />}
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
  // ไฟล์ Excel ที่มีหนึ่งชีตต่อเดือน: นำเข้าได้ทุกเดือนพร้อมกัน
  const [batch, setBatch] = useState<{ sheetName: string; month: string | null; match: BaselineMatch }[] | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setFileName(file.name);
      if (/\.xlsx?$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheets = parseBaselineSheets(wb.SheetNames.map((name) => ({ name, csv: XLSX.utils.sheet_to_csv(wb.Sheets[name]) })));
        if (sheets.length === 0) throw new Error("no sheets");
        setMatch(null);
        setBatch(sheets.map((sh) => ({ sheetName: sh.sheetName, month: sh.month, match: matchBaseline(state, sh.blocks) })));
        return;
      }
      setBatch(null);
      const blocks = parseBaselineCsv(await file.text());
      setMatch(matchBaseline(state, blocks));
    } catch {
      toastError("อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ CSV หรือ Excel ของชีตยอดขาย");
    }
  }

  async function saveBatch() {
    if (!batch || !user) return;
    setBusy(true);
    try {
      let total = 0;
      for (const b of batch) {
        if (!b.month || b.match.rows.length === 0) continue;
        total += await saveBaseline(createClient(), b.match.rows, { month: b.month, fileName, userId: user.id, userName: user.name });
      }
      toastSuccess(`บันทึกยอดขายอ้างอิง ${formatNumber(total)} ช่องแล้ว`);
      setBatch(null);
      onSaved();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
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
          <Upload className="h-4 w-4" /> นำเข้ายอดขายรายเดือนจากไฟล์ (CSV / Excel)
        </summary>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <p className="text-[var(--color-on-surface-variant)]">
            ใช้ไฟล์ชีตยอดขายแบบเดิม (หนึ่งบล็อกต่อรุ่น สี × ไซซ์) เก็บเป็นยอดอ้างอิงสำหรับวางแผนผลิตเท่านั้น <b>ไม่ใช่ออเดอร์ และไม่ตัดสต็อก</b> นำเข้าซ้ำเดือนเดิมจะทับของเดิม
          </p>
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" aria-label="ไฟล์ยอดขาย" onChange={(e) => void pick(e.target.files?.[0])} />
          {batch && (
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
              <p>ไฟล์ Excel มี <b>{batch.length}</b> เดือน (หนึ่งชีตต่อเดือน) ตรวจก่อนบันทึก:</p>
              <ul className="flex flex-col gap-1">
                {batch.map((b) => (
                  <li key={b.sheetName}>
                    {b.month ? b.month.slice(0, 7) : <span className="text-amber-800">อ่านเดือนจากชีต “{b.sheetName}” ไม่ได้ (จะข้าม)</span>} · จับคู่ได้ {formatNumber(b.match.rows.length)} ช่อง ({formatNumber(b.match.totalMatched)} จาก {formatNumber(b.match.totalFile)} ชิ้น)
                    {b.match.unmatchedModels.length > 0 && <span className="text-amber-800"> · ข้ามรุ่น: {b.match.unmatchedModels.join(", ")}</span>}
                    {b.match.unmatchedCells.length > 0 && <span className="text-amber-800"> · สี/ไซซ์ไม่พบ {formatNumber(b.match.unmatchedCells.length)} ช่อง</span>}
                  </li>
                ))}
              </ul>
              <div>
                <Button onClick={() => void saveBatch()} disabled={busy || !batch.some((b) => b.month && b.match.rows.length > 0)}>
                  {busy ? "กำลังบันทึก..." : "บันทึกยอดขายอ้างอิงทุกเดือน"}
                </Button>
              </div>
            </div>
          )}
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
  const canImport = useCan("report.view"); // ทุกคนที่ดูสินค้าได้เห็นแผน แต่นำเข้าไฟล์ยอดขายได้เฉพาะผู้มีสิทธิ์ดูรายงาน
  const [baseline, setBaseline] = useState<{ rows: (BaselineInput & { month: string })[]; months: string[] }>({ rows: [], months: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [search, setSearch] = useState("");
  const material = useMaterialSettings();
  const [months, setMonths] = useState("1");
  // โชว์ของที่มี (คลัง + รอเย็บ) ในช่องที่ไม่ขาดของตาราง "ที่ต้องผลิต" (ติ๊กปิดได้ถ้ารู้สึกตัวเลขเยอะ)
  const [showHave, setShowHave] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);

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
  // เดือนที่เลือกเป็นยอดขายอ้างอิงได้: เดือนที่นำเข้าไฟล์ไว้ + เดือนที่จบแล้วในระบบ (ตั้งแต่ต้นเดือนที่ระบบเริ่มใช้จริง) เดือนที่มีทั้งสองแบบใช้ไฟล์
  const monthChoices = useMemo(() => {
    const kind = new Map<string, "file" | "sys" | "none">();
    const now = new Date();
    const real = new Date(REAL_DATA_START);
    const realKey = `${real.getFullYear()}-${String(real.getMonth() + 1).padStart(2, "0")}`;
    // แสดงทุกเดือนตั้งแต่ ม.ค. ปีนี้ (หรือเดือนแรกที่มีไฟล์) ถึงเดือนที่แล้ว: เดือนที่ยังไม่มีข้อมูลเป็นปุ่มจาง กดไม่ได้ ให้เห็นว่ายังขาดเดือนไหน
    const firstFile = [...baseline.months].sort()[0];
    let y = now.getFullYear();
    let m0 = 0;
    if (firstFile) {
      const [fy, fm] = firstFile.split("-").map(Number);
      if (fy < y || (fy === y && fm - 1 < m0)) {
        y = fy;
        m0 = fm - 1;
      }
    }
    while (y < now.getFullYear() || (y === now.getFullYear() && m0 < now.getMonth())) {
      const key = `${y}-${String(m0 + 1).padStart(2, "0")}`;
      kind.set(key, baseline.months.includes(key) ? "file" : key >= realKey ? "sys" : "none");
      m0 += 1;
      if (m0 > 11) {
        m0 = 0;
        y += 1;
      }
    }
    for (const m of baseline.months) kind.set(m, "file");
    return [...kind.entries()].map(([month, k]) => ({ month, kind: k })).sort((a, b) => a.month.localeCompare(b.month));
  }, [baseline.months]);
  const usableMonths = useMemo(() => monthChoices.filter((c) => c.kind !== "none"), [monthChoices]);
  // ติ๊กได้หลายเดือน: หลายเดือน = เฉลี่ยต่อเดือน (ไม่ติ๊กเลย = เดือนล่าสุดที่นำเข้าไฟล์ เหมือนเดิม)
  const selectedMonths = useMemo(() => {
    const valid = picked.filter((m) => usableMonths.some((c) => c.month === m));
    if (valid.length > 0) return [...valid].sort();
    const latestFile = [...baseline.months].sort().pop();
    const fallback = latestFile ?? usableMonths[usableMonths.length - 1]?.month;
    return fallback ? [fallback] : [];
  }, [picked, usableMonths, baseline.months]);
  const baseRows = useMemo<BaselineInput[]>(() => {
    const rowsForMonth = (month: string): BaselineInput[] => {
      if (baseline.months.includes(month)) return baseline.rows.filter((r) => r.month === month);
      const [y, m] = month.split("-").map(Number);
      const r = monthRange(y, m - 1);
      const rows: BaselineInput[] = [];
      for (const [variantId, qty] of netSalesByVariant(state, r.from, r.to)) {
        const v = state.variants[variantId];
        if (v) rows.push({ productId: v.productId, color: v.color, size: v.size, qty });
      }
      return rows;
    };
    if (selectedMonths.length === 0) return [];
    if (selectedMonths.length === 1) return rowsForMonth(selectedMonths[0]);
    return averageBaseline(
      selectedMonths.flatMap((month) => rowsForMonth(month).map((r) => ({ ...r, month }))),
      selectedMonths
    );
  }, [selectedMonths, baseline.rows, baseline.months, state]);
  const baseLabel = selectedMonths.length === 1 ? `เดือน ${selectedMonths[0]}` : `เฉลี่ย ${selectedMonths.length} เดือน (${selectedMonths.join(", ")})`;
  const toggleMonth = (m: string) => {
    const cur = selectedMonths;
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    if (next.length > 0) setPicked(next);
  };

  const matrices = useMemo(() => productionPlan(state, baseRows, { months: Number(months), brandId, search }), [state, baseRows, months, brandId, search]);
  // ขาดรวมถ้าดูล่วงหน้า 1-12 เดือน พร้อมวันที่ปลายทาง (วันนี้ + n เดือน) ใช้บนปุ่มเลือก
  const shortageByMonths = useMemo(() => {
    const today = new Date();
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
      n,
      until: formatPlanDate(addMonthsClamped(today, n)),
      need: productionPlan(state, baseRows, { months: n, brandId, search }).reduce((t, m) => t + m.totals.need, 0),
    }));
  }, [state, baseRows, brandId, search]);
  const untilDate = shortageByMonths.find((x) => String(x.n) === months)?.until ?? "";
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
        {monthChoices.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5" role="group" aria-label="เลือกเดือนยอดขายอ้างอิง">
            <span className="mr-1 text-sm font-medium">ยอดขายอ้างอิงจากเดือน (ติ๊กได้หลายเดือน = เฉลี่ย):</span>
            {monthChoices.map((c) => {
              const on = selectedMonths.includes(c.month);
              return (
                <button
                  key={c.month}
                  type="button"
                  aria-pressed={on}
                  disabled={c.kind === "none"}
                  onClick={() => toggleMonth(c.month)}
                  title={c.kind === "file" ? "จากไฟล์ที่นำเข้า" : c.kind === "sys" ? "ยอดขายที่บันทึกในระบบ" : "ยังไม่มียอดขายของเดือนนี้ (นำเข้าไฟล์ก่อน)"}
                  className={`rounded-full border px-3 py-1 text-sm ${on ? "border-transparent bg-[var(--color-primary-container)] font-semibold text-white" : c.kind === "none" ? "cursor-not-allowed border-dashed border-[var(--color-border)] bg-transparent text-[var(--color-on-surface-variant)]/50" : "border-[var(--color-border)] bg-white"}`}
                >
                  {c.month}
                  {c.kind === "sys" && <span className="ml-1 text-[11px] opacity-70">ระบบ</span>}
                </button>
              );
            })}
            {usableMonths.length > 1 && (
              <>
                <button type="button" onClick={() => setPicked(usableMonths.map((c) => c.month))} className="px-2 text-sm text-[var(--color-primary)] underline">
                  เลือกทั้งหมด
                </button>
                <button type="button" onClick={() => setPicked([])} className="px-2 text-sm text-[var(--color-on-surface-variant)] underline">
                  ล้าง
                </button>
              </>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showHave} onChange={(e) => setShowHave(e.target.checked)} />
          โชว์ของที่มีในตารางที่ต้องผลิต
        </label>
        <span className="ml-auto">
          <ExcelPickButton items={matrices.map((m) => ({ id: m.productId, label: m.shape ? `${m.name} ${m.shape}` : m.name }))} onExport={(sel) => downloadWorkbook("วางแผนผลิต.xlsx", [{ name: "วางแผนผลิต", ...planSheet(state, matrices.filter((m) => sel.has(m.productId))) }])} disabled={matrices.length === 0} />
        </span>
      </div>

      {canImport && <ImportCard onSaved={() => void reload()} />}

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
          <div role="group" aria-label="ดูล่วงหน้า" className="flex flex-wrap items-stretch gap-2">
            {shortageByMonths.map(({ n, need, until }) => (
              <button
                key={n}
                type="button"
                aria-pressed={months === String(n)}
                onClick={() => setMonths(String(n))}
                className={`rounded-xl border px-4 py-2 text-left ${months === String(n) ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-container)]"}`}
              >
                <span className="block text-sm font-semibold">ดูล่วงหน้า {n} เดือน</span>
                <span className="block text-xs">ถึง {until}</span>
                <span className="block text-xs">ขาดรวม {formatNumber(need)} ชิ้น</span>
              </button>
            ))}
          </div>
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
              <span className="text-sm font-medium text-[var(--color-on-surface-variant)]">ช่องที่ของไม่พอขาย</span>
              <span className="text-2xl font-bold text-[var(--color-danger)]">{formatNumber(sum.urgent)}</span>
              <span className="text-sm text-[var(--color-on-surface-variant)]">ช่อง (สี/ไซซ์)</span>
            </Card>
          </div>
          <p className="px-1 text-sm text-[var(--color-on-surface-variant)]">
            ยอดขาย{baseLabel} · ดูล่วงหน้า {months} เดือน (ถึงวันที่ {untilDate}) · แต่ละรุ่นมีสามตารางเรียงข้างกัน (ยอดขาย → สต็อกปัจจุบัน → ที่ต้องผลิต) เลื่อนซ้าย-ขวาดูได้ · ในตารางที่ต้องผลิต{" "}
            <span className="rounded bg-[var(--color-danger)] px-1.5 py-0.5 text-xs font-semibold text-white">แดงเข้ม</span> ไม่มีของเลย <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-[var(--color-danger)]" style={lowStyle}>แดงอ่อน</span> ขาดบางส่วน
          </p>
          {matrices.map((m) => (
            <ModelBlock key={m.productId} m={m} showHave={showHave} material={material} />
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
      <PageContainer className="max-w-none">
        <RequireAccess perm="view.products">
          <div className="flex flex-col gap-5">
            <PlanContent />
          </div>
        </RequireAccess>
      </PageContainer>
    </>
  );
}
