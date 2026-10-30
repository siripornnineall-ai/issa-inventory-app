"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle, KpiCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedChoice } from "@/components/ui/SegmentedChoice";
import { ReturnNav } from "@/components/stock/ReturnNav";
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { useStore } from "@/lib/store";
import { STOCK_RETURN_LABEL_TH, STOCK_RETURN_TYPES, type StockReturnType } from "@/lib/types";
import { formatThaiDate } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { returnSummary, type ReturnSummary } from "@/lib/utils/returnSummary";

function Bars({ items, unit = "ชิ้น", empty = "ยังไม่มีข้อมูลในช่วงนี้" }: { items: { label: string; pieces: number; value?: number }[]; unit?: string; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-[var(--color-on-surface-variant)]">{empty}</p>;
  const max = Math.max(...items.map((i) => i.pieces), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{i.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--color-on-surface-variant)]">
              <span className="font-semibold text-[var(--color-on-surface)]">{formatNumber(i.pieces)}</span> {unit}
              {i.value !== undefined && ` · ${formatTHB(i.value)}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-surface-container)]">
            <div className="h-2 rounded-full bg-[var(--color-primary-container)]" style={{ width: `${Math.max(2, Math.round((i.pieces / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PairList({ items }: { items: { from: string; to: string; pieces: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีการเปลี่ยนสินค้าที่ระบุไว้ในช่วงนี้</p>;
  return (
    <ul className="divide-y divide-[var(--color-border)] text-sm">
      {items.map((p) => (
        <li key={`${p.from}>${p.to}`} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0">
            {p.from} <span className="text-[var(--color-on-surface-variant)]">→</span> <span className="font-medium">{p.to}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatNumber(p.pieces)} ชิ้น</span>
        </li>
      ))}
    </ul>
  );
}

function exportExcel(s: ReturnSummary, rangeLabel: string) {
  downloadWorkbook(`สรุปสินค้าคืน_${rangeLabel.replace(/[\\/:*?"<>|\s]+/g, "_")}.xlsx`, [
    {
      name: "สรุป",
      rows: [
        ["ช่วงเวลา", rangeLabel],
        ["จำนวนใบ", s.docs],
        ["จำนวนชิ้น", s.pieces],
        ["มูลค่า (บาท)", s.value],
        ["เทียบยอดขาย (%)", s.ratePct ?? ""],
        [],
        ["ประเภท", "ใบ", "ชิ้น", "มูลค่า (บาท)"],
        ...STOCK_RETURN_TYPES.map((t) => [STOCK_RETURN_LABEL_TH[t], s.byType[t].docs, s.byType[t].pieces, s.byType[t].value]),
      ],
    },
    { name: "ตามเหตุผล", rows: [["เหตุผล", "ชิ้น", "มูลค่า (บาท)"], ...s.byReason.map((r) => [r.label, r.pieces, r.value])] },
    { name: "ลูกค้าพูดว่า", rows: [["คำที่ลูกค้าพูด", "ชิ้น"], ...s.byTag.map((t) => [t.tag, t.pieces])] },
    { name: "ตามรุ่น", rows: [["รุ่น", "ชิ้น", "มูลค่า (บาท)"], ...s.byProduct.map((p) => [p.name, p.pieces, p.value])] },
    { name: "ตามสี-ไซซ์", rows: [["สินค้า", "ชิ้น", "มูลค่า (บาท)"], ...s.byVariant.map((v) => [v.label, v.pieces, v.value])] },
    { name: "เปลี่ยนเป็น", rows: [["จาก", "เป็น", "ชิ้น"], ...s.exchanges.map((e) => [e.from, e.to, e.pieces])] },
    { name: "ช่องทาง", rows: [["ช่องทาง", "ชิ้น", "มูลค่า (บาท)"], ...s.byChannel.map((c) => [c.channel, c.pieces, c.value])] },
    {
      name: "รายการทั้งหมด",
      rows: [
        ["เลขที่ใบ", "วันที่", "ประเภท", "ช่องทาง", "แบรนด์", "รุ่น", "สี", "ไซซ์", "SKU", "จำนวน", "ราคาต่อชิ้น", "มูลค่า", "เหตุผล", "ลูกค้าพูดว่า", "เปลี่ยนเป็น", "หมายเหตุ"],
        ...s.rows.map((r) => [r.docNo, formatThaiDate(r.date), r.typeLabel, r.channel, r.brandName, r.productName, r.color, r.size, r.sku, r.qty, r.unitPrice, r.value, r.reasonLabel, r.tags.join(", "), r.exchangeTo, r.note]),
      ],
    },
  ]);
}

function SummaryContent() {
  const state = useStore();
  const { value: range, setValue: setRange } = useDateRange("30d");
  // กล่องเลือก: "all" = ทั้งหมด
  const [brandId, setBrandId] = useState("all");
  const [type, setType] = useState<StockReturnType | "all">("all");

  const summary = useMemo(
    () => returnSummary(state, { from: new Date(range.from).getTime(), to: new Date(range.to).getTime(), brandId: brandId === "all" ? "" : brandId, returnType: type === "all" ? "" : type }),
    [state, range, brandId, type]
  );
  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const rangeLabel = `${formatThaiDate(range.from)} - ${formatThaiDate(range.to)}`;
  const noReason = summary.byReason.find((r) => r.code === "none");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--color-on-surface-variant)]">ประเภท</p>
          <SegmentedChoice
            ariaLabel="ประเภท"
            value={type}
            onChange={setType}
            columns="grid-cols-2 sm:grid-cols-5"
            options={[{ value: "all" as const, label: "ทั้งหมด" }, ...STOCK_RETURN_TYPES.map((t) => ({ value: t, label: STOCK_RETURN_LABEL_TH[t] }))]}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--color-on-surface-variant)]">แบรนด์</p>
          <SegmentedChoice
            ariaLabel="แบรนด์"
            value={brandId}
            onChange={setBrandId}
            columns="grid-cols-2 sm:grid-cols-4"
            options={[{ value: "all", label: "ทุกแบรนด์" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
          />
        </div>
        <div>
          <Button variant="secondary" onClick={() => exportExcel(summary, rangeLabel)} disabled={summary.rows.length === 0}>
            <Download className="h-4 w-4" /> ดาวน์โหลด Excel
          </Button>
        </div>
      </div>

      {summary.rows.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState title="ไม่มีสินค้าคืนในช่วงนี้" description="ลองขยายช่วงวันที่ หรือเปลี่ยนตัวกรอง" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="ใบรับคืน" value={formatNumber(summary.docs)} unit="ใบ" />
            <KpiCard label="จำนวนสินค้า" value={formatNumber(summary.pieces)} unit="ชิ้น" />
            <KpiCard label="มูลค่าที่ถูกคืน" value={formatTHB(summary.value)} />
            <KpiCard label="เทียบยอดขายช่วงเดียวกัน" value={summary.ratePct === null ? "-" : `${summary.ratePct}%`} unit={summary.salesPieces > 0 ? `ของ ${formatNumber(summary.salesPieces)} ชิ้นที่ขาย` : undefined} />
          </div>
          {summary.estimatedLines > 0 && (
            <p className="-mt-2 px-1 text-xs text-[var(--color-on-surface-variant)]">
              {formatNumber(summary.estimatedLines)} รายการเป็นใบเก่าที่ยังไม่ได้บันทึกราคา มูลค่าของรายการเหล่านั้นประมาณจากราคาขายปัจจุบัน
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STOCK_RETURN_TYPES.map((t) => (
              <Card key={t} className="p-4">
                <p className="text-xs text-[var(--color-on-surface-variant)]">{STOCK_RETURN_LABEL_TH[t]}</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatNumber(summary.byType[t].pieces)} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">ชิ้น · {summary.byType[t].docs} ใบ</span>
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">{formatTHB(summary.byType[t].value)}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>เหตุผลหลักที่ลูกค้าคืน/เปลี่ยน</CardTitle>
              {noReason && <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{`"ไม่ได้ระบุ" คือใบเก่าที่บันทึกก่อนมีตัวเลือกเหตุผล (${formatNumber(noReason.pieces)} ชิ้น)`}</p>}
            </CardHeader>
            <CardContent>
              <Bars items={summary.byReason.map((r) => ({ label: r.label, pieces: r.pieces, value: r.value }))} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ลูกค้าพูดว่าอะไรบ่อยสุด</CardTitle>
              </CardHeader>
              <CardContent>
                <Bars items={summary.byTag.map((t) => ({ label: t.tag, pieces: t.pieces }))} empty="ยังไม่มีใครเลือกคำที่ลูกค้าพูดในช่วงนี้" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>ช่องทางที่ถูกคืนบ่อย</CardTitle>
              </CardHeader>
              <CardContent>
                <Bars items={summary.byChannel.map((c) => ({ label: c.channel, pieces: c.pieces, value: c.value }))} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>รุ่นที่ถูกคืนบ่อย</CardTitle>
              </CardHeader>
              <CardContent>
                <Bars items={summary.byProduct.slice(0, 10).map((p) => ({ label: p.name, pieces: p.pieces, value: p.value }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>สี/ไซซ์ที่ถูกคืนบ่อย</CardTitle>
              </CardHeader>
              <CardContent>
                <Bars items={summary.byVariant.slice(0, 10).map((v) => ({ label: v.label, pieces: v.pieces, value: v.value }))} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>เปลี่ยนจากอะไรเป็นอะไร</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-on-surface-variant)]">ระดับรุ่น</p>
                <PairList items={summary.exchangeModels.slice(0, 10)} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-on-surface-variant)]">ระดับสี/ไซซ์</p>
                <PairList items={summary.exchanges.slice(0, 10)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ข้อความและหมายเหตุล่าสุด</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.notes.length === 0 ? (
                <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีหมายเหตุหรือคำที่ลูกค้าพูดในช่วงนี้</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-sm">
                  {summary.notes.slice(0, 20).map((n, i) => (
                    <li key={`${n.docNo}-${i}`} className="py-2">
                      <p className="font-medium">{n.label}</p>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">
                        {n.docNo} · {formatThaiDate(n.date)} · {n.reasonLabel}
                      </p>
                      <p className="mt-0.5">{n.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ReturnSummaryPage() {
  return (
    <>
      <Header title="สรุปสินค้าคืน/เปลี่ยน" description="ลูกค้าคืนหรือเปลี่ยนเพราะอะไร พูดอะไรบ่อย มูลค่าเท่าไหร่ ดาวน์โหลดไปใช้ต่อได้" />
      <PageContainer className="max-w-5xl">
        <ReturnNav active="summary" />
        <RequireAccess perm="view.history">
          <SummaryContent />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
