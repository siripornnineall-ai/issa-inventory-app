"use client";

import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { returnSummary, type ReturnSummary, type TrendGrain } from "@/lib/utils/returnSummary";
import { buildActions, type ActionLevel, type ReturnAction } from "@/lib/utils/returnInsights";
import { BrandTag } from "@/components/ui/BrandTag";
import { brandColor } from "@/lib/utils/brandColor";
import { cn } from "@/lib/utils/cn";

function Bars({
  items,
  unit = "ชิ้น",
  empty = "ยังไม่มีข้อมูลในช่วงนี้",
  onSelect,
  selectedKey,
}: {
  items: { key?: string; label: string; pieces: number; value?: number }[];
  unit?: string;
  empty?: string;
  onSelect?: (key: string) => void; // กดแถบเพื่อดูเฉพาะรายการนั้น (กดซ้ำ = เลิกเลือก)
  selectedKey?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-[var(--color-on-surface-variant)]">{empty}</p>;
  const max = Math.max(...items.map((i) => i.pieces), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((i) => {
        const key = i.key ?? i.label;
        const active = selectedKey !== undefined && selectedKey === key;
        const body = (
          <>
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
          </>
        );
        return (
          <li key={key} className="text-sm">
            {onSelect ? (
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(key)}
                className={cn("block w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-container)]", active && "bg-[var(--color-surface-container)] ring-1 ring-[var(--color-primary-container)]")}
              >
                {body}
              </button>
            ) : (
              <div className="px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const LEVEL_STYLE: Record<ActionLevel, { label: string; className: string }> = {
  high: { label: "ควรรีบดู", className: "bg-red-100 text-red-800" },
  mid: { label: "ควรตามต่อ", className: "bg-amber-100 text-amber-800" },
  info: { label: "ข้อสังเกต", className: "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]" },
};

const TYPE_COLOR: Record<StockReturnType, string> = {
  return_rts: "#c98a2b",
  return_customer: "#3b6f7a",
  return_defective: "#b3402f",
  return_exchange: "#6a8f4e",
};

function trendLabel(key: string, grain: TrendGrain): string {
  const [y, m, d] = key.split("-").map(Number);
  if (grain === "month") return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  return `${d}/${m}`;
}

function ActionList({ actions, onDrill }: { actions: ReturnAction[]; onDrill: (drill: NonNullable<ReturnAction["drill"]>) => void }) {
  if (actions.length === 0) return <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีข้อสังเกตในช่วงนี้</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {actions.map((a) => (
        <li key={a.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={cn("mr-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold", LEVEL_STYLE[a.level].className)}>{LEVEL_STYLE[a.level].label}</span>
              <span className="font-semibold">{a.title}</span>
              <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">{a.detail}</p>
            </div>
            {a.drill && (
              <Button variant="secondary" onClick={() => onDrill(a.drill!)}>
                ดูรายการ
              </Button>
            )}
          </div>
          <p className="mt-2 rounded-lg bg-[var(--color-surface-container)] px-3 py-2">
            <span className="font-semibold">ควรทำ: </span>
            {a.todo}
          </p>
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
  // กดแถบในแผนภูมิ/ปุ่ม "ดูรายการ" เพื่อดูเฉพาะเหตุผลหรือรุ่นนั้น
  const [reasonCode, setReasonCode] = useState("");
  const [productId, setProductId] = useState("");
  const [rowLimit, setRowLimit] = useState(20);

  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  const brands = useMemo(() => Object.values(state.brands).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.brands]);
  const drilling = Boolean(reasonCode || productId);

  // scope = ตามช่วงวันที่/ประเภท/แบรนด์ ที่เลือก (ไม่รวมตัวกรองจากการกดแผนภูมิ) ใช้เป็นฐานของข้อสรุป "ควรทำอะไร"
  const scope = useMemo(
    () => returnSummary(state, { from, to, brandId: brandId === "all" ? "" : brandId, returnType: type === "all" ? "" : type }),
    [state, from, to, brandId, type]
  );
  const summary = useMemo(
    () => (drilling ? returnSummary(state, { from, to, brandId: brandId === "all" ? "" : brandId, returnType: type === "all" ? "" : type, reasonCode, productId }) : scope),
    [state, from, to, brandId, type, reasonCode, productId, drilling, scope]
  );
  // เปรียบเทียบแต่ละแบรนด์ (ช่วงวันที่/ประเภทเดียวกัน ไม่ขึ้นกับแบรนด์ที่เลือก)
  const brandScopes = useMemo(
    () =>
      brands.map((b) => {
        const sum = returnSummary(state, { from, to, brandId: b.id, returnType: type === "all" ? "" : type });
        return { brand: b, sum, actions: buildActions(sum) };
      }),
    [state, brands, from, to, type]
  );
  const scopeActions = useMemo(() => buildActions(scope), [scope]);

  const pickBrand = (id: string) => {
    setBrandId(id);
    setReasonCode("");
    setProductId("");
  };
  const applyDrill = (bId: string | null, drill: NonNullable<ReturnAction["drill"]>) => {
    if (bId !== null) setBrandId(bId);
    setReasonCode(drill.reasonCode ?? "");
    setProductId(drill.productId ?? "");
    setRowLimit(20);
  };
  const clearDrill = () => {
    setReasonCode("");
    setProductId("");
  };
  const reasonName = reasonCode ? (scope.byReason.find((r) => r.code === reasonCode)?.label ?? "") : "";
  const productName = productId ? (scope.byProduct.find((p) => p.productId === productId)?.name ?? "") : "";
  const rangeLabel = `${formatThaiDate(range.from)} - ${formatThaiDate(range.to)}`;
  const noReason = summary.byReason.find((r) => r.code === "none");
  const trendData = summary.trend.map((p) => ({ ...p, ...p.byType, name: trendLabel(p.key, summary.trendGrain) }));
  const grainLabel = { day: "รายวัน", week: "รายสัปดาห์", month: "รายเดือน" }[summary.trendGrain];

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
            onChange={pickBrand}
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

      {drilling && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-primary-container)] bg-white px-3 py-2 text-sm">
          <span className="text-[var(--color-on-surface-variant)]">กำลังดูเฉพาะ:</span>
          {reasonCode && <span className="rounded-md bg-[var(--color-surface-container)] px-2 py-0.5 font-medium">เหตุผล: {reasonName || (reasonCode === "none" ? "ไม่ได้ระบุ" : reasonCode)}</span>}
          {productId && <span className="rounded-md bg-[var(--color-surface-container)] px-2 py-0.5 font-medium">รุ่น: {productName || "ที่เลือก"}</span>}
          <Button variant="secondary" onClick={clearDrill}>
            <X className="h-4 w-4" /> ล้างตัวกรอง
          </Button>
        </div>
      )}

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

          {brands.length > 1 && (
            <section aria-label="เปรียบเทียบแต่ละแบรนด์" className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-semibold">เปรียบเทียบแต่ละแบรนด์ <span className="font-normal text-[var(--color-on-surface-variant)]">(กดการ์ดเพื่อดูเฉพาะแบรนด์นั้น)</span></h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {brandScopes.map(({ brand, sum, actions }) => {
                  const active = brandId === brand.id;
                  const urgent = actions.filter((a) => a.level === "high").length;
                  const topReason = sum.byReason.find((r) => r.code !== "none");
                  return (
                    <button
                      key={brand.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pickBrand(active ? "all" : brand.id)}
                      className={cn("rounded-2xl border bg-white p-4 text-left transition-shadow hover:shadow-[var(--shadow-micro)]", active ? "border-[var(--color-primary-container)] ring-2 ring-[var(--color-primary-container)]" : "border-[var(--color-border)]")}
                      style={{ borderTop: `4px solid ${brandColor(brand)}` }}
                    >
                      <BrandTag brandId={brand.id} className="text-sm font-semibold" />
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {formatNumber(sum.pieces)} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">ชิ้น · {formatTHB(sum.value)}</span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                        {sum.ratePct === null ? "ไม่มียอดขายให้เทียบ" : `${sum.ratePct}% ของยอดขาย (${formatNumber(sum.salesPieces)} ชิ้น)`}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">เหตุผลหลัก: {topReason ? `${topReason.label} (${formatNumber(topReason.pieces)})` : "ยังไม่มีข้อมูล"}</p>
                      <p className={cn("mt-2 text-xs font-semibold", urgent > 0 ? "text-red-700" : "text-[var(--color-on-surface-variant)]")}>{urgent > 0 ? `มี ${urgent} เรื่องที่ควรรีบดู` : "ไม่มีเรื่องเร่งด่วน"}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <Card>
            <CardHeader>
              <CardTitle>สรุป: ควรทำอะไรต่อ</CardTitle>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">คำนวณจากตัวเลขในช่วงที่เลือกด้วยกฎง่าย ๆ (เกณฑ์ปรับได้ที่ returnInsights.ts) ของที่คืนน้อยกว่า 5 ชิ้นจะไม่สรุปให้เพราะข้อมูลน้อยเกินไป</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {brandId === "all" && brands.length > 1 ? (
                brandScopes.map(({ brand, actions }) => (
                  <div key={brand.id}>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <BrandTag brandId={brand.id} />
                    </p>
                    <ActionList actions={actions} onDrill={(d) => applyDrill(brand.id, d)} />
                  </div>
                ))
              ) : (
                <ActionList actions={scopeActions} onDrill={(d) => applyDrill(null, d)} />
              )}
            </CardContent>
          </Card>

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
              <CardTitle>แนวโน้มของคืน ({grainLabel})</CardTitle>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">แยกสีตามประเภท แตะที่แท่งเพื่อดูตัวเลข</p>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {STOCK_RETURN_TYPES.map((t) => (
                      <Bar key={t} dataKey={t} stackId="a" fill={TYPE_COLOR[t]} name={STOCK_RETURN_LABEL_TH[t]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>เหตุผลหลักที่ลูกค้าคืน/เปลี่ยน</CardTitle>
              {noReason && <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{`"ไม่ได้ระบุ" คือใบเก่าที่บันทึกก่อนมีตัวเลือกเหตุผล (${formatNumber(noReason.pieces)} ชิ้น)`}</p>}
            </CardHeader>
            <CardContent>
              <Bars
                items={scope.byReason.map((r) => ({ key: r.code, label: r.label, pieces: r.pieces, value: r.value }))}
                selectedKey={reasonCode || undefined}
                onSelect={(k) => {
                  setReasonCode(reasonCode === k ? "" : k);
                  setRowLimit(20);
                }}
              />
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
                <Bars
                  items={scope.byProduct.slice(0, 10).map((p) => ({ key: p.productId, label: p.name, pieces: p.pieces, value: p.value }))}
                  selectedKey={productId || undefined}
                  onSelect={(k) => {
                    setProductId(productId === k ? "" : k);
                    setRowLimit(20);
                  }}
                />
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

          <Card>
            <CardHeader>
              <CardTitle>รายการที่คืน ({formatNumber(summary.rows.length)} รายการ)</CardTitle>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">{drilling ? "เฉพาะที่เลือกไว้ด้านบน" : "กดแถบเหตุผลหรือรุ่นด้านบนเพื่อดูเฉพาะรายการนั้น"} เรียงจากใหม่ไปเก่า</p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {summary.rows.slice(0, rowLimit).map((r, i) => (
                  <li key={`${r.docNo}-${r.sku}-${i}`} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.productName} {r.color} {r.size}
                      </p>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">
                        {r.docNo} · {formatThaiDate(r.date)} · {r.typeLabel} · {r.channel}
                        {r.brandName && ` · ${r.brandName}`}
                      </p>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">เหตุผล: {r.reasonLabel}</p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p className="font-semibold">{formatNumber(r.qty)} ชิ้น</p>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">{formatTHB(r.value)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {summary.rows.length > rowLimit && (
                <div className="mt-3">
                  <Button variant="secondary" onClick={() => setRowLimit(rowLimit + 30)}>
                    แสดงเพิ่ม
                  </Button>
                </div>
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
      <Header title="สรุปสินค้าคืน/เปลี่ยน" description="แดชบอร์ดของคืน/เปลี่ยน แยกตามแบรนด์ กดดูรายละเอียดได้ พร้อมสรุปว่าควรทำอะไรต่อ" />
      <PageContainer className="max-w-5xl">
        <ReturnNav active="summary" />
        <RequireAccess perm="view.history">
          <SummaryContent />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
