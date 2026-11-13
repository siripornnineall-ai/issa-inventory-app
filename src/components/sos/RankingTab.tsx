"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSosLines } from "./useSosLines";
import { buildAdvice, type SosBranch, type SosImportRow } from "@/lib/utils/sosAnalysis";
import { adviceRows, latestImportPerBranch, rankModels, selectedPeriods, type AdviceAction, type PeriodMode } from "@/lib/utils/sosView";
import type { SosFeedbackRow } from "@/lib/supabase/sos";
import { useStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils/money";

// จัดอันดับ/แนะนำ: ตอบว่า "สาขานี้ควรทำอะไร" ด้วยการ์ดสรุป 3 ช่อง (เติม / เพิ่มรายการใหม่ / ถอน) และตารางเดียวที่รวมเป็นรุ่น
// ตัดสินจากยอดขายจริงเป็นหลัก ความเห็นทีมขายแสดงประกอบและเตือนเมื่อขัดกับตัวเลข ไม่ได้ใช้เปลี่ยนอันดับ
const ACTION_LABEL: Record<AdviceAction, string> = { restock: "ควรเติม", addNew: "ควรเพิ่มใหม่", remove: "ควรถอน" };
const ACTION_TONE: Record<AdviceAction, "success" | "yellow" | "neutral"> = { restock: "success", addNew: "yellow", remove: "neutral" };
const INITIAL_ROWS = 12;

function BranchAdvice({
  branch,
  months,
  advice,
  ranks,
  rows,
  capacity,
}: {
  branch: SosBranch;
  months: number;
  advice: ReturnType<typeof buildAdvice>;
  ranks: ReturnType<typeof rankModels>;
  rows: ReturnType<typeof adviceRows>;
  capacity: number;
}) {
  const [filter, setFilter] = useState<AdviceAction | "all">("all");
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const shown = rows.filter((r) => filter === "all" || r.action === filter);
  const sum = (a: AdviceAction) => rows.filter((r) => r.action === a).reduce((s, r) => s + r.qty, 0);
  const tiles: { action: AdviceAction; title: string; hint: string }[] = [
    { action: "restock", title: "ควรเติม", hint: "ขายได้แล้วของหมด" },
    { action: "addNew", title: "ควรเพิ่มรายการใหม่", hint: "ขายดีที่สาขาอื่น" },
    { action: "remove", title: "ควรถอน", hint: "มีของแต่ไม่ขาย" },
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{branch.name}</h2>
        <p className="text-xs text-[var(--color-on-surface-variant)]">
          ข้อมูล {months} เดือน{months < 2 && " (น้อย คำแนะนำอาจคลาดเคลื่อน ควรดูควบคู่กับหน้าร้าน)"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <button
            key={t.action}
            type="button"
            onClick={() => {
              setFilter(filter === t.action ? "all" : t.action);
              setLimit(INITIAL_ROWS);
            }}
            aria-pressed={filter === t.action}
            className={`rounded-xl border p-3 text-left transition-colors ${filter === t.action ? "border-[var(--color-primary-container)] ring-1 ring-[var(--color-primary-container)]" : "border-[var(--color-border)]"}`}
          >
            <p className="text-xs text-[var(--color-on-surface-variant)]">{t.title}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {formatNumber(sum(t.action))} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">ชิ้น</span>
            </p>
            <p className="text-[11px] text-[var(--color-on-surface-variant)]">{t.hint}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
        สาขารับของเพิ่มได้สุทธิ +{formatNumber(capacity)} ชิ้น: ถอน {formatNumber(advice.removePieces)} ชิ้น แล้วส่งเติม/เพิ่มได้ไม่เกิน {formatNumber(advice.removePieces + capacity)} ชิ้น (แผนนี้ส่ง {formatNumber(advice.addPieces)} ชิ้น) · กดการ์ดเพื่อกรองตาราง
      </p>

      <h3 className="mt-5 text-sm font-semibold">ขายดี 5 อันดับแรก (รุ่น)</h3>
      {ranks.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">ยังไม่มียอดขาย</p>
      ) : (
        <table className="mt-1 w-full border-collapse text-sm">
          <tbody>
            {ranks.slice(0, 5).map((r) => (
              <tr key={r.model} className="border-b border-[var(--color-border)]">
                <td className="w-8 py-1.5 font-semibold text-[var(--color-on-surface-variant)]">#{r.rank}</td>
                <td className="py-1.5 font-medium">{r.model}</td>
                <td className="py-1.5 text-xs text-[var(--color-on-surface-variant)]">ขายดีสุด: {r.skus.slice(0, 2).map((s) => `${s.label} (${s.qty})`).join(", ")}</td>
                <td className="py-1.5 text-right tabular-nums">{formatNumber(r.qty)} ชิ้น</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-5 text-sm font-semibold">
        คำแนะนำ <span className="font-normal text-[var(--color-on-surface-variant)]">({formatNumber(shown.length)} รายการ{filter !== "all" ? ` · เฉพาะ${ACTION_LABEL[filter]}` : ""})</span>
      </h3>
      {shown.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">ไม่มีรายการ</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-container)] text-left text-xs">
                <th className="px-3 py-2 font-medium">ทำอะไร</th>
                <th className="px-3 py-2 font-medium">รุ่น</th>
                <th className="px-3 py-2 font-medium">สี / ไซซ์</th>
                <th className="px-3 py-2 text-right font-medium">ชิ้น</th>
                <th className="px-3 py-2 font-medium">เหตุผล</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((r) => (
                <tr key={`${r.action}-${r.strong}-${r.model}`} className="border-b border-[var(--color-border)] align-top">
                  <td className="px-3 py-2">
                    <Badge tone={ACTION_TONE[r.action]}>{ACTION_LABEL[r.action]}</Badge>
                  </td>
                  <td className="px-3 py-2 font-medium">{r.model}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.cells.slice(0, 8).map((c) => `${c.label} ×${c.qty}`).join(" · ")}
                    {r.cells.length > 8 && <span className="text-[var(--color-on-surface-variant)]"> และอีก {r.cells.length - 8} รายการ</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(r.qty)}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-on-surface-variant)]">
                    {r.reason}
                    {r.caution && <span className="block font-medium text-[var(--color-warning)]">⚠ ทีมขายแจ้งว่าขายดีหรือมีลูกค้าถามหา ลองตรวจก่อนถอน</span>}
                    {r.notes.length > 0 && <span className="block">ทีมขาย: {r.notes.join(" · ")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > limit && (
            <button type="button" onClick={() => setLimit(limit + INITIAL_ROWS)} className="mt-2 text-sm font-medium text-[var(--color-primary-container)] hover:underline">
              แสดงเพิ่ม ({formatNumber(shown.length - limit)} รายการ)
            </button>
          )}
        </div>
      )}
      {advice.skippedOverCapacity.length > 0 && <p className="mt-3 text-xs text-[var(--color-on-surface-variant)]">มีอีก {formatNumber(advice.skippedOverCapacity.length)} รายการที่น่าเพิ่มแต่เกินโควตา</p>}
    </Card>
  );
}

export function RankingTab({
  branches,
  allImports,
  mode,
  branchId,
  feedback,
}: {
  branches: SosBranch[];
  allImports: SosImportRow[];
  mode: PeriodMode;
  branchId: string;
  feedback: SosFeedbackRow[];
}) {
  const state = useStore();
  const [capacity, setCapacity] = useState("20");
  const periods = useMemo(() => new Set(selectedPeriods(allImports, mode)), [allImports, mode]);
  // ต้องใช้ข้อมูลทุกสาขาในช่วงที่เลือก (เทียบกับสาขาอื่น) แม้เลือกดูสาขาเดียว
  const windowImports = useMemo(() => allImports.filter((i) => periods.has(i.period_start)), [allImports, periods]);
  const { sales, stock, loading, error } = useSosLines(windowImports.map((i) => i.id));
  const shownBranches = branches.filter((b) => (!branchId || b.id === branchId) && windowImports.some((i) => i.branch_id === b.id));
  const cap = Math.max(0, Math.floor(Number(capacity) || 0));

  const results = useMemo(() => {
    const main = sales.filter((s) => s.section === "main");
    const variantByCode: Record<string, string | null> = {};
    for (const l of [...main, ...stock]) if (l.variant_id && !variantByCode[l.sos_code]) variantByCode[l.sos_code] = l.variant_id;
    return shownBranches.map((b) => {
      const mine = windowImports.filter((i) => i.branch_id === b.id);
      const mineIds = new Set(mine.map((i) => i.id));
      const latest = latestImportPerBranch(mine)[0];
      const mySales = main.filter((s) => mineIds.has(s.import_id));
      const advice = buildAdvice({
        sales: mySales.map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })),
        stock: stock.filter((s) => latest && s.import_id === latest.id).map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })),
        otherBranchSales: main.filter((s) => !mineIds.has(s.import_id)).map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })),
        feedback: feedback.filter((f) => !f.branch_id || f.branch_id === b.id),
        capacity: cap,
      });
      const ranks = rankModels(state, mySales.map((s) => ({ branch_id: s.branch_id, variant_id: s.variant_id, description: s.description, sos_code: s.sos_code, qty: s.qty, net: s.net })));
      return { branch: b, months: mine.length, advice, ranks, rows: adviceRows(state, advice, variantByCode) };
    });
  }, [shownBranches, windowImports, sales, stock, feedback, cap, state]);

  if (windowImports.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีข้อมูลในช่วงที่เลือก" description="เลือกช่วงเวลาอื่น หรือนำเข้าไฟล์จาก SOS ก่อน" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 px-1 text-sm">
        <label className="flex items-center gap-2">
          เพิ่มของได้สุทธิ
          <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-label="โควตาเพิ่มสุทธิ" className="h-9 w-20" />
          ชิ้นต่อสาขา
        </label>
        <span className="text-xs text-[var(--color-on-surface-variant)]">ตัดสินจากยอดขายจริงเป็นหลัก ความเห็นทีมขายใช้ประกอบเท่านั้น</span>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังวิเคราะห์...</p>}
      {!loading && results.map((r) => <BranchAdvice key={r.branch.id} branch={r.branch} months={r.months} advice={r.advice} ranks={r.ranks} rows={r.rows} capacity={cap} />)}
    </div>
  );
}
