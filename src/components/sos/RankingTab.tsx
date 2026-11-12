"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSosLines } from "./useSosLines";
import { buildAdvice, type AdviceItem, type SosBranch, type SosImportRow } from "@/lib/utils/sosAnalysis";
import { latestImportPerBranch, rankModels, selectedPeriods, type PeriodMode } from "@/lib/utils/sosView";
import type { SosFeedbackRow } from "@/lib/supabase/sos";
import { useStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils/money";

// จัดอันดับและแนะนำ รายสาขา: ขายดี (รุ่น และสี/ไซซ์) / ควรเติม / ควรเพิ่มรายการใหม่ / ควรถอน ภายในโควตาเพิ่มสุทธิ
// ตัดสินจากยอดขายจริงเป็นหลัก ความเห็นทีมขายแสดงประกอบและเตือนเมื่อขัดกับตัวเลข ไม่ได้ใช้เปลี่ยนอันดับ
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

  const results = useMemo(() => {
    const cap = Math.max(0, Math.floor(Number(capacity) || 0));
    const main = sales.filter((s) => s.section === "main");
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
      return { branch: b, months: mine.length, advice, ranks };
    });
  }, [shownBranches, windowImports, sales, stock, feedback, capacity, state]);

  if (windowImports.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีข้อมูลในช่วงที่เลือก" description="เลือกช่วงเวลาอื่น หรือนำเข้าไฟล์จาก SOS ก่อน" />
      </Card>
    );
  }

  const Section = (title: string, hint: string, items: AdviceItem[], tone: "green" | "yellow" | "gray", limit = 15) => (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-[var(--color-on-surface-variant)]">({formatNumber(items.length)} รายการ)</span>
      </h3>
      <p className="text-xs text-[var(--color-on-surface-variant)]">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">ไม่มีรายการ</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--color-border)] text-sm">
          {items.slice(0, limit).map((it) => (
            <li key={it.code} className="py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{it.description}</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    {it.strength === "strong" && <b className="text-[var(--color-danger)]">ควรถอนก่อน · </b>}
                    {it.reason}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${tone === "green" ? "bg-[var(--color-success-container)] text-[var(--color-success)]" : tone === "yellow" ? "bg-[var(--color-yellow-container)] text-[var(--color-yellow)]" : "bg-[var(--color-secondary-container)]"}`}>
                  {tone === "gray" ? `ถอน ${formatNumber(it.qty)} ชิ้น` : `เพิ่ม ${formatNumber(it.qty)} ชิ้น`}
                </span>
              </div>
              {it.caution && <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">⚠ {it.caution}</p>}
              {it.notes.length > 0 && <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">ความเห็นทีมขาย: {it.notes.join(" · ")}</p>}
            </li>
          ))}
        </ul>
      )}
      {items.length > limit && <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">แสดง {limit} รายการแรกจาก {formatNumber(items.length)}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 px-1 text-sm">
        <label className="flex items-center gap-2">
          เพิ่มของได้สุทธิ
          <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-label="โควตาเพิ่มสุทธิ" className="h-9 w-20" />
          ชิ้นต่อสาขา
        </label>
        <span className="text-xs text-[var(--color-on-surface-variant)]">ถอนของออกแล้วเพิ่มได้อีกเท่าที่ถอน · ตัดสินจากยอดขายจริงเป็นหลัก ความเห็นทีมขายใช้ประกอบเท่านั้น</span>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังวิเคราะห์...</p>}
      {!loading &&
        results.map(({ branch, months, advice, ranks }) => (
          <Card key={branch.id} className="p-5">
            <h2 className="text-lg font-semibold">{branch.name}</h2>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              ข้อมูล {months} เดือน{months < 2 && " (น้อย คำแนะนำอาจคลาดเคลื่อน ควรดูควบคู่กับหน้าร้าน)"} · เพิ่ม {formatNumber(advice.addPieces)} ชิ้น · ถอน {formatNumber(advice.removePieces)} ชิ้น · โควตาสุทธิ +{formatNumber(advice.capacity)} ชิ้น
            </p>

            <div className="mt-4">
              <h3 className="text-sm font-semibold">ขายดี (อันดับรุ่น)</h3>
              {ranks.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">ยังไม่มียอดขาย</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-1 text-sm">
                  {ranks.slice(0, 5).map((r) => (
                    <li key={r.model} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <b className="mr-2 text-[var(--color-on-surface-variant)]">#{r.rank}</b>
                        {r.model}
                        <span className="ml-2 text-xs text-[var(--color-on-surface-variant)]">
                          ขายดีสุด: {r.skus.slice(0, 2).map((s) => `${s.label} (${s.qty})`).join(", ")}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatNumber(r.qty)} ชิ้น</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {Section("ควรเติม", "ขายได้ในช่วงที่เลือก แต่ตอนนี้ของหมดที่สาขา", advice.restock, "green")}
            {Section("ควรเพิ่มรายการใหม่", "ขายดีที่สาขาอื่น (ตั้งแต่ 2 ชิ้น) แต่สาขานี้ยังไม่มี", advice.addNew, "yellow")}
            {Section("ควรถอน", "มีของที่สาขาแต่ไม่ขาย: ทั้งรุ่นไม่ขายเลย (ควรถอนก่อน) หรือรุ่นขายอยู่แต่สี/ไซซ์นั้นมีของตั้งแต่ 2 ชิ้นและไม่ขยับ", advice.remove, "gray")}
            {advice.skippedOverCapacity.length > 0 && (
              <p className="mt-3 text-xs text-[var(--color-on-surface-variant)]">มีอีก {formatNumber(advice.skippedOverCapacity.length)} รายการที่น่าเพิ่มแต่เกินโควตา ({advice.skippedOverCapacity.slice(0, 3).map((i) => i.description).join(", ")}...)</p>
            )}
          </Card>
        ))}
    </div>
  );
}
