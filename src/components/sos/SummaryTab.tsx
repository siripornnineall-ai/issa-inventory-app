"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { setBranchRent } from "@/lib/supabase/sos";
import { buildPnL, type SosBranch, type SosImportRow, type SosSummaryRow } from "@/lib/utils/sosAnalysis";
import { branchTotals } from "@/lib/utils/sosView";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatNumber, formatTHB } from "@/lib/utils/money";

// สรุปรายสาขา: ต้นทุนและกำไรของช่วงที่เลือก (รวมหลายเดือนถ้าเลือก 2 เดือนล่าสุด) เรียงจากกำไรมากไปน้อย
// กำไร = ยอดที่ได้รับ (หลังหัก GP และค่าบริการ ก่อนภาษีหัก ณ ที่จ่าย) - ต้นทุน - ค่าเช่า ส่วนบัตรเครดิตของ SOS ยังไม่นับ (รอยืนยัน) แจ้งไว้ครั้งเดียวด้านบน
export function SummaryTab({
  branches,
  selectedImports,
  summaries,
  onChanged,
}: {
  branches: SosBranch[];
  selectedImports: SosImportRow[];
  summaries: SosSummaryRow[];
  onChanged: () => void;
}) {
  const rows = useMemo(() => buildPnL(branches, selectedImports, summaries), [branches, selectedImports, summaries]);
  const totals = useMemo(() => branchTotals(rows), [rows]);
  const [rentDraft, setRentDraft] = useState<Record<string, string>>({});

  async function saveRent(b: SosBranch) {
    const raw = (rentDraft[b.id] ?? "").trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toastError("ค่าเช่าต้องเป็นตัวเลขที่ไม่ติดลบ");
      return;
    }
    try {
      await setBranchRent(createClient(), b.id, value);
      toastSuccess(`บันทึกค่าเช่า ${b.name} แล้ว`);
      setRentDraft((d) => {
        const next = { ...d };
        delete next[b.id];
        return next;
      });
      onChanged();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }

  const sum = (f: (t: (typeof totals)[number]) => number) => totals.reduce((s, t) => s + f(t), 0);
  const creditQty = sum((t) => t.creditQty);
  const creditNet = sum((t) => t.creditNet);
  const anyMissingRent = totals.some((t) => t.netProfit === null);
  const shownBranchIds = new Set(totals.map((t) => t.branchId));

  return (
    <div className="flex flex-col gap-5">
      {creditQty > 0 && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ในไฟล์ของ SOS มีส่วน &quot;เอกสาร ชำระเป็น บัตรเครดิต&quot; อีก {formatNumber(creditQty)} ชิ้น ({formatTHB(creditNet)}) ที่ <b>ยังไม่นับ</b> ในตัวเลขข้างล่าง (รอยืนยันความหมายกับ SOS) ตัวเลขทั้งหมดคำนวณจากส่วนปกติที่ SOS คิดเป็นยอดขายรวม
        </p>
      )}

      {totals.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="ยังไม่มีข้อมูลในช่วงที่เลือก" description="เลือกสาขา/ช่วงเวลาอื่น หรือนำเข้าไฟล์จาก SOS ที่แท็บ นำเข้าไฟล์" />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-container)] text-left text-xs">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">สาขา</th>
                <th className="px-3 py-2.5 text-right font-medium">ชิ้น</th>
                <th className="px-3 py-2.5 text-right font-medium">ยอดขายรวม</th>
                <th className="px-3 py-2.5 text-right font-medium">GP ที่ SOS หัก</th>
                <th className="px-3 py-2.5 text-right font-medium">ค่าบริการ</th>
                <th className="px-3 py-2.5 text-right font-medium">ยอดที่ได้รับ</th>
                <th className="px-3 py-2.5 text-right font-medium">ต้นทุน</th>
                <th className="px-3 py-2.5 text-right font-medium">กำไรก่อนค่าเช่า</th>
                <th className="px-3 py-2.5 text-right font-medium">ค่าเช่า</th>
                <th className="px-4 py-2.5 text-right font-medium">กำไรสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t, i) => (
                <tr key={t.branchId} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-4 py-2.5 text-[var(--color-on-surface-variant)]">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{t.branchName}</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]">รวม {t.months} เดือน</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(t.pieces)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(t.salesTotal)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatTHB(t.gp)}
                    {t.salesTotal > 0 && <span className="block text-[11px] text-[var(--color-on-surface-variant)]">{Math.round((t.gp / t.salesTotal) * 1000) / 10}%</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(t.otherFees)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(t.received)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(t.cogs)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatTHB(t.profitBeforeRent)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.rentTotal === null ? <span className="text-xs text-[var(--color-on-surface-variant)]">ยังไม่กรอก</span> : formatTHB(t.rentTotal)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${t.netProfit !== null && t.netProfit < 0 ? "text-[var(--color-danger)]" : ""}`}>
                    {t.netProfit === null ? <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">–</span> : formatTHB(t.netProfit)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-container)] font-semibold">
                <td />
                <td className="px-3 py-2.5">รวม</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(sum((t) => t.pieces))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.salesTotal))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.gp))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.otherFees))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.received))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.cogs))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.profitBeforeRent))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(sum((t) => t.rentTotal ?? 0))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatTHB(sum((t) => t.netProfit ?? t.profitBeforeRent))}
                  {anyMissingRent && <span className="block text-[11px] font-normal text-[var(--color-on-surface-variant)]">บางสาขายังไม่กรอกค่าเช่า</span>}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-on-surface-variant)]">
            ยอดที่ได้รับ = ยอดขายรวม - GP - ค่าบริการอื่นๆ (บวกภาษีหัก ณ ที่จ่ายกลับ) · ต้นทุน = 200 บาทต่อชิ้น เสื้อสูท 400 บาท ค่าส่ง (EMS) ไม่นับ · ค่าเช่า = ค่าเช่าต่อเดือน × จำนวนเดือนที่รวม
          </p>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-base font-semibold">ค่าเช่าต่อเดือนของแต่ละสาขา</h2>
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">กรอกแล้วกดบันทึก ระบบหักค่าเช่านี้ในทุกเดือนของสาขานั้น (ยังไม่กรอก = แสดงกำไรก่อนค่าเช่า)</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {branches
            .filter((b) => shownBranchIds.size === 0 || shownBranchIds.has(b.id))
            .map((b) => {
              const draft = rentDraft[b.id];
              const value = draft ?? (b.rent_monthly === null || b.rent_monthly === undefined ? "" : String(b.rent_monthly));
              return (
                <li key={b.id} className="rounded-xl border border-[var(--color-border)] p-3">
                  <p className="text-sm font-medium">{b.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input type="number" min={0} value={value} onChange={(e) => setRentDraft((d) => ({ ...d, [b.id]: e.target.value }))} placeholder="ยังไม่ได้กรอก" aria-label={`ค่าเช่า ${b.name}`} className="h-9" />
                    <Button size="sm" onClick={() => saveRent(b)} disabled={draft === undefined}>
                      บันทึก
                    </Button>
                  </div>
                </li>
              );
            })}
        </ul>
      </Card>
    </div>
  );
}
