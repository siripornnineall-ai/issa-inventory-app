"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangePicker, useDateRange, type DateRangeValue } from "@/components/ui/DateRangePicker";
import { useStore } from "@/lib/store";
import { downloadWorkbook } from "@/lib/utils/excelMonths";
import { formatNumber } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";
import { wipEntryRows, wipHistorySheetRows } from "@/lib/utils/factoryWipView";
import { FACTORY_WIP_KINDS, FACTORY_WIP_KIND_LABEL_TH, isFactoryWipKind, type FactoryWipKind } from "@/lib/types";

// สีป้ายตามหน้าประวัติหลัก: เข้า (ยอดตั้งต้น/ตัดเข้า) = เขียว, ออก (เสียหาย) = เหลือง, ปรับยอด = ม่วง
const KIND_TONE: Record<FactoryWipKind, "success" | "yellow" | "purple"> = { opening: "success", cut_in: "success", scrap: "yellow", adjust: "purple" };

const PAGE_STEP = 50;

function FactoryHistory({ range }: { range: DateRangeValue }) {
  const state = useStore();
  const [kind, setKind] = useState<FactoryWipKind | "">("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_STEP);

  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  const rows = useMemo(() => wipEntryRows(state, { kind, from, to, search }), [state, kind, from, to, search]);
  const total = rows.reduce((s, r) => s + r.qtyChange, 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_STEP);
              }}
              placeholder="ค้นหารุ่น สี ไซซ์ SKU หมายเหตุ"
              aria-label="ค้นหา"
              className="w-72 pl-9"
            />
          </div>
          <Select
            value={kind}
            onChange={(e) => {
              setKind(isFactoryWipKind(e.target.value) ? e.target.value : "");
              setLimit(PAGE_STEP);
            }}
            aria-label="ประเภท"
            className="w-56"
          >
            <option value="">ทุกประเภท</option>
            {FACTORY_WIP_KINDS.map((k) => (
              <option key={k} value={k}>
                {FACTORY_WIP_KIND_LABEL_TH[k]}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="ghost" onClick={() => downloadWorkbook("ประวัติโรงงาน-BC.xlsx", [{ name: "ประวัติโรงงาน BC", rows: wipHistorySheetRows(rows) }])} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Excel
        </Button>
      </div>

      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ช่วงที่เลือก:</span> {formatNumber(rows.length)} รายการ · รวมเปลี่ยน {total > 0 ? "+" : ""}
        {formatNumber(total)} ชิ้น · เป็นประวัติของตัวที่ยังไม่เย็บ ไม่ปนกับการเคลื่อนไหวของสต็อกสินค้า
      </p>

      {rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="ไม่มีรายการในช่วงนี้" description="ลองขยายช่วงวันที่ หรือล้างตัวกรอง" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {rows.slice(0, limit).map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <Badge tone={KIND_TONE[r.kind]}>{r.kindLabel}</Badge>
                    {r.productName} · {r.color} / {r.size}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                    {formatThaiDate(r.date)} · {r.actorName} · {r.sku}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${r.qtyChange < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>
                  {r.qtyChange > 0 ? "+" : ""}
                  {formatNumber(r.qtyChange)} ชิ้น
                </p>
              </li>
            ))}
          </ul>
          {rows.length > limit && (
            <div className="border-t border-[var(--color-border)] p-3">
              <Button variant="secondary" onClick={() => setLimit(limit + PAGE_STEP)}>
                แสดงเพิ่ม
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default function FactoryHistoryPage() {
  const { value: range, setValue: setRange } = useDateRange("30d");
  return (
    <>
      <Header
        title="ประวัติโรงงาน BC"
        description="ตัวที่ยังไม่เย็บ: ยอดตั้งต้น ตัดเข้า ปรับยอด เสียหาย (แยกสี/ไซซ์)"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <PageContainer className="max-w-5xl">
        <Link href="/history" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับไปประวัติการเคลื่อนไหว
        </Link>
        <RequireAccess perm="view.history">
          <FactoryHistory range={range} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
