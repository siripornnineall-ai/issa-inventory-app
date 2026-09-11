"use client";

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { useStore } from "@/lib/store";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { todayInputValue } from "@/lib/utils/date";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  ORDER_STATUS_LABEL_TH,
  SALES_CHANNEL_LABEL_TH,
  type OrderStatus,
  type SalesChannel,
} from "@/lib/types";

function monthAgoInputValue(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function chipToggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

interface SalesRow {
  date: string;
  orderNo: string;
  brand: string;
  channel: string;
  product: string;
  model: string;
  sku: string;
  color: string;
  size: string;
  qty: number;
  unitPrice: number;
  discount: number;
  netAmount: number;
  status: string;
}

export function SalesExcelExport() {
  const state = useStore();
  const brands = useMemo(() => Object.values(state.brands), [state.brands]);

  const [from, setFrom] = useState(monthAgoInputValue());
  const [to, setTo] = useState(todayInputValue());
  const [month, setMonth] = useState("");
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);

  function applyMonth(value: string) {
    setMonth(value);
    if (!value) return;
    const [y, m] = value.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  const buildRows = useCallback((): SalesRow[] => {
    const fromT = new Date(from).setHours(0, 0, 0, 0);
    const toT = new Date(to).setHours(23, 59, 59, 999);
    const rows: SalesRow[] = [];
    for (const o of Object.values(state.orders)) {
      const t = new Date(o.date).getTime();
      if (t < fromT || t > toT) continue;
      if (brandIds.length > 0 && !(o.brandId && brandIds.includes(o.brandId))) continue;
      if (channels.length > 0 && !channels.includes(o.channel)) continue;
      if (statuses.length > 0 && !statuses.includes(o.status)) continue;
      const brandName = o.brandId ? state.brands[o.brandId]?.name ?? "-" : "-";
      for (const line of o.lines) {
        const variant = state.variants[line.variantId];
        const product = variant ? state.products[variant.productId] : undefined;
        rows.push({
          date: o.date.slice(0, 10),
          orderNo: o.orderNo,
          brand: brandName,
          channel: SALES_CHANNEL_LABEL_TH[o.channel] ?? o.channel,
          product: product?.sellingName ?? "-",
          model: product?.modelCode ?? "-",
          sku: variant?.sku ?? "-",
          color: variant?.color ?? "-",
          size: variant?.size ?? "-",
          qty: line.qty,
          unitPrice: line.unitPrice,
          discount: line.discount,
          netAmount: line.qty * line.unitPrice - line.discount,
          status: ORDER_STATUS_LABEL_TH[o.status] ?? o.status,
        });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [state, from, to, brandIds, channels, statuses]);

  function toSheetRows(rows: SalesRow[]) {
    return rows.map((r) => ({
      "วันที่": r.date,
      "เลขที่ออเดอร์": r.orderNo,
      "แบรนด์/ร้าน": r.brand,
      "ช่องทาง": r.channel,
      "สินค้า": r.product,
      "รุ่น": r.model,
      "SKU": r.sku,
      "สี": r.color,
      "ไซซ์": r.size,
      "จำนวน": r.qty,
      "ราคาต่อหน่วย": r.unitPrice,
      "ส่วนลด": r.discount,
      "ยอดสุทธิ": r.netAmount,
      "สถานะ": r.status,
    }));
  }

  function subtotalRow(rows: SalesRow[]) {
    return {
      "วันที่": "",
      "เลขที่ออเดอร์": "",
      "แบรนด์/ร้าน": "",
      "ช่องทาง": "รวมทั้งหมด",
      "สินค้า": "",
      "รุ่น": "",
      "SKU": "",
      "สี": "",
      "ไซซ์": "",
      "จำนวน": rows.reduce((s, r) => s + r.qty, 0),
      "ราคาต่อหน่วย": "",
      "ส่วนลด": rows.reduce((s, r) => s + r.discount, 0),
      "ยอดสุทธิ": rows.reduce((s, r) => s + r.netAmount, 0),
      "สถานะ": "",
    };
  }

  function safeSheetName(name: string, used: Set<string>) {
    const base = name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${base.slice(0, 28)}(${i})`;
      i += 1;
    }
    used.add(candidate);
    return candidate;
  }

  function handleExport() {
    const rows = buildRows();
    if (rows.length === 0) {
      toastError("ไม่พบข้อมูลยอดขายตามเงื่อนไขที่เลือก");
      return;
    }
    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();

    const allSheetRows = [...toSheetRows(rows), subtotalRow(rows)];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSheetRows), safeSheetName("ยอดขายทั้งหมด", usedNames));

    const channelsPresent = Array.from(new Set(rows.map((r) => r.channel)));
    if (channelsPresent.length > 1) {
      for (const channelLabel of channelsPresent) {
        const subset = rows.filter((r) => r.channel === channelLabel);
        const sheetRows = [...toSheetRows(subset), subtotalRow(subset)];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), safeSheetName(channelLabel, usedNames));
      }
    }

    XLSX.writeFile(wb, `ยอดขาย-ISSA-${from}_ถึง_${to}.xlsx`);
    toastSuccess(`ส่งออก Excel เรียบร้อยแล้ว (${rows.length} รายการ)`);
  }

  const preview = useMemo(() => buildRows(), [buildRows]);
  const previewQty = preview.reduce((s, r) => s + r.qty, 0);
  const previewAmount = preview.reduce((s, r) => s + r.netAmount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-[var(--color-primary-container)]" />
        <CardTitle>ส่งออกยอดขาย (Excel)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="วันที่เริ่มต้น">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setMonth(""); }} />
          </FormField>
          <FormField label="วันที่สิ้นสุด">
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setMonth(""); }} />
          </FormField>
          <FormField label="หรือเลือกทั้งเดือน/ปี">
            <Input type="month" value={month} onChange={(e) => applyMonth(e.target.value)} />
          </FormField>
        </div>

        <FormField label="แบรนด์/ร้าน" hint="ไม่เลือก = ทุกแบรนด์">
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBrandIds((prev) => chipToggle(prev, b.id))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  brandIds.includes(b.id) ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="ช่องทางการขาย" hint="ไม่เลือก = ทุกช่องทาง (เลือกมากกว่า 1 ช่องทาง จะแยกชีทให้อัตโนมัติ)">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(SALES_CHANNEL_LABEL_TH).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setChannels((prev) => chipToggle(prev, value as SalesChannel))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  channels.includes(value as SalesChannel) ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="สถานะออเดอร์" hint="ไม่เลือก = ทุกสถานะ">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ORDER_STATUS_LABEL_TH).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatuses((prev) => chipToggle(prev, value as OrderStatus))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  statuses.includes(value as OrderStatus) ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </FormField>

        <div className="flex items-center justify-between rounded-xl bg-[var(--color-surface-container)] px-4 py-3 text-sm">
          <span>
            ตัวอย่าง: <span className="font-semibold">{formatNumber(preview.length)}</span> รายการ ·{" "}
            <span className="font-semibold">{formatNumber(previewQty)}</span> ชิ้น · {formatTHB(previewAmount)}
          </span>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4" /> ส่งออก Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
