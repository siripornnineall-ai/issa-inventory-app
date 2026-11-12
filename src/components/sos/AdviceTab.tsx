"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSosLines } from "./useSosLines";
import { buildAdvice, type AdviceItem, type SosBranch, type SosImportRow } from "@/lib/utils/sosAnalysis";
import type { SosFeedbackRow } from "@/lib/supabase/sos";
import { formatThaiDate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

// แนะนำ SKU รายสาขา: เติม (ขายแล้วของหมด) / เพิ่มรายการใหม่ (ขายดีสาขาอื่น) / ถอน (มีของแต่ไม่ขาย) ภายในโควตาเพิ่มสุทธิ (ค่าตั้งต้น +20 ชิ้น)
// ตัดสินจากยอดขายจริงเป็นหลัก ความเห็นทีมขาย (Feedback) แสดงประกอบและเตือนเมื่อขัดกับตัวเลข ไม่ได้ใช้เปลี่ยนอันดับ
export function AdviceTab({ branches, imports, feedback }: { branches: SosBranch[]; imports: SosImportRow[]; feedback: SosFeedbackRow[] }) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [capacity, setCapacity] = useState("20");

  const periods = useMemo(() => [...new Set(imports.map((i) => i.period_start))].sort().reverse(), [imports]);
  const period = periodStart && periods.includes(periodStart) ? periodStart : periods[0] ?? "";
  const periodImports = useMemo(() => imports.filter((i) => i.period_start === period), [imports, period]);
  const mine = periodImports.find((i) => i.branch_id === branchId);
  const { sales, stock, loading, error } = useSosLines(periodImports.map((i) => i.id));

  const advice = useMemo(() => {
    if (!mine) return null;
    const cap = Math.max(0, Math.floor(Number(capacity) || 0));
    const mainSales = sales.filter((s) => s.section === "main");
    return buildAdvice({
      sales: mainSales.filter((s) => s.import_id === mine.id).map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })),
      stock: stock.filter((s) => s.import_id === mine.id).map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })),
      otherBranchSales: mainSales.filter((s) => s.import_id !== mine.id).map((s) => ({ code: s.sos_code, description: s.description, qty: s.qty })),
      feedback: feedback.filter((f) => !f.branch_id || f.branch_id === branchId),
      capacity: cap,
    });
  }, [mine, sales, stock, feedback, branchId, capacity]);

  if (branches.length === 0 || imports.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState title="ยังไม่มีข้อมูลให้วิเคราะห์" description="นำเข้าไฟล์จาก SOS ที่แท็บ นำเข้าไฟล์ ก่อน" />
      </Card>
    );
  }

  const Section = ({ title, hint, items, tone }: { title: string; hint: string; items: AdviceItem[]; tone: "green" | "yellow" | "gray" }) => (
    <Card className="p-5">
      <h2 className="text-base font-semibold">
        {title} <span className="text-sm font-normal text-[var(--color-on-surface-variant)]">({formatNumber(items.length)} รายการ)</span>
      </h2>
      <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">ไม่มีรายการ</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)] text-sm">
          {items.map((it) => (
            <li key={it.code} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{it.description}</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{it.reason}</p>
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
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="สาขา" className="w-56">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select value={period} onChange={(e) => setPeriodStart(e.target.value)} aria-label="งวดยอดขาย" className="w-56">
          {periods.map((p) => (
            <option key={p} value={p}>
              งวด {formatThaiDate(p)}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          เพิ่มของได้สุทธิ
          <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-label="โควตาเพิ่มสุทธิ" className="h-9 w-20" />
          ชิ้น
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      {!mine ? (
        <Card className="p-8">
          <EmptyState title="สาขานี้ไม่มีไฟล์ในงวดที่เลือก" description="เลือกงวดอื่น หรือนำเข้าไฟล์ของสาขานี้" />
        </Card>
      ) : loading || !advice ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังวิเคราะห์...</p>
      ) : (
        <>
          <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
            <span className="font-semibold text-[var(--color-on-surface)]">สรุป:</span> เพิ่ม {formatNumber(advice.addPieces)} ชิ้น · ถอน {formatNumber(advice.removePieces)} ชิ้น · โควตาเพิ่มสุทธิ +{formatNumber(advice.capacity)} ชิ้น (ถอนของออกแล้วเพิ่มได้อีกเท่าที่ถอน) · ตัดสินจากยอดขายจริงเป็นหลัก
            ความเห็นทีมขายใช้ประกอบเท่านั้น
          </p>
          {Section({ title: "ควรเติม", hint: "ขายได้ในงวดนี้ แต่ตอนนี้ของหมดที่สาขา", items: advice.restock, tone: "green" })}
          {Section({ title: "ควรเพิ่มรายการใหม่", hint: "ขายดีที่สาขาอื่น (ตั้งแต่ 2 ชิ้น) แต่สาขานี้ยังไม่มี", items: advice.addNew, tone: "yellow" })}
          {Section({ title: "ควรถอน", hint: "มีของที่สาขาแต่ไม่ขายเลยในงวดนี้", items: advice.remove, tone: "gray" })}
          {advice.skippedOverCapacity.length > 0 && (
            <p className="px-1 text-xs text-[var(--color-on-surface-variant)]">มีอีก {formatNumber(advice.skippedOverCapacity.length)} รายการที่น่าเพิ่มแต่เกินโควตา ({advice.skippedOverCapacity.slice(0, 3).map((i) => i.description).join(", ")}...)</p>
          )}
        </>
      )}
    </div>
  );
}
