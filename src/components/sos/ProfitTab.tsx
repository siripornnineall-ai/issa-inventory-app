"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { setBranchRent } from "@/lib/supabase/sos";
import { buildPnL, type SosBranch, type SosImportRow, type SosSummaryRow } from "@/lib/utils/sosAnalysis";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";

// ต้นทุนและกำไรรายสาขารายเดือน: ยอดที่เราได้รับ (หลังหัก GP และค่าบริการ ก่อนภาษีหัก ณ ที่จ่าย) - ต้นทุนสินค้า - ค่าเช่า
// ส่วน "เอกสาร ชำระเป็น บัตรเครดิต" ในรายงานของ SOS ยังไม่นับ (รอเจ้าของงานยืนยันความหมาย) แสดงแยกไว้ให้เห็น
export function ProfitTab({ branches, imports, summaries, onChanged }: { branches: SosBranch[]; imports: SosImportRow[]; summaries: SosSummaryRow[]; onChanged: () => void }) {
  const rows = useMemo(() => buildPnL(branches, imports, summaries), [branches, imports, summaries]);
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

  const totals = rows.reduce(
    (t, r) => ({ received: t.received + r.received, cogs: t.cogs + r.cogs, before: t.before + r.profitBeforeRent, net: t.net + (r.netProfit ?? r.profitBeforeRent), missingRent: t.missingRent || r.netProfit === null }),
    { received: 0, cogs: 0, before: 0, net: 0, missingRent: false }
  );

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold">ค่าเช่าต่อเดือนของแต่ละสาขา</h2>
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">กรอกแล้วกดบันทึก ระบบหักค่าเช่านี้ในทุกเดือนของสาขานั้น (ยังไม่กรอก = แสดงกำไรก่อนค่าเช่า)</p>
        {branches.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีสาขา นำเข้าไฟล์จาก SOS ที่แท็บ &quot;นำเข้าไฟล์&quot; ก่อน</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {branches.map((b) => {
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
        )}
      </Card>

      {rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="ยังไม่มีข้อมูลยอดขาย" description="นำเข้าไฟล์รายงานจาก SOS ที่แท็บ นำเข้าไฟล์ เพื่อดูต้นทุนและกำไร" />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-container)] text-left text-xs">
                <th className="px-4 py-2.5 font-medium">สาขา / งวด</th>
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
              {rows.map((r) => (
                <tr key={r.importId} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.branchName}</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]">
                      {formatThaiDate(r.periodStart)} - {formatThaiDate(r.periodEnd)}
                    </p>
                    {r.creditQty > 0 && (
                      <p className="mt-0.5 text-[11px] text-[var(--color-warning)]">
                        ยังไม่นับส่วนบัตรเครดิต {formatNumber(r.creditQty)} ชิ้น {formatTHB(r.creditNet)} (รอยืนยัน)
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.pieces)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(r.salesTotal)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatTHB(r.gp)}
                    {r.gpPct !== null && <span className="block text-[11px] text-[var(--color-on-surface-variant)]">{r.gpPct}%</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(r.otherFees)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(r.received)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(r.cogs)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatTHB(r.profitBeforeRent)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.rent === null ? <span className="text-xs text-[var(--color-on-surface-variant)]">ยังไม่กรอก</span> : formatTHB(r.rent)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${r.netProfit !== null && r.netProfit < 0 ? "text-[var(--color-danger)]" : ""}`}>
                    {r.netProfit === null ? <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">–</span> : formatTHB(r.netProfit)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-container)] font-semibold">
                <td className="px-4 py-2.5">รวมทุกงวดที่แสดง</td>
                <td />
                <td />
                <td />
                <td />
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(totals.received)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(totals.cogs)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatTHB(totals.before)}</td>
                <td />
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatTHB(totals.net)}
                  {totals.missingRent && <span className="block text-[11px] font-normal text-[var(--color-on-surface-variant)]">บางสาขายังไม่กรอกค่าเช่า</span>}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-on-surface-variant)]">
            ยอดที่ได้รับ = ยอดขายรวม - GP - ค่าบริการอื่นๆ (บวกภาษีหัก ณ ที่จ่ายกลับ เพราะเป็นภาษีที่ขอเครดิตได้) · ต้นทุน = 200 บาทต่อชิ้น เสื้อสูท 400 บาท ค่าส่ง (EMS) ไม่นับ · ต้นทุนคิดจากส่วนปกติของรายงานเท่านั้น
          </p>
        </Card>
      )}
    </div>
  );
}
