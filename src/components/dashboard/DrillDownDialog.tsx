"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { MOVEMENT_TYPE_LABEL_TH, SALES_CHANNEL_LABEL_TH, ORDER_STATUS_LABEL_TH } from "@/lib/types";
import type { AppState } from "@/lib/store/state";

export type DrillKind = "currentQty" | "sales" | "stockIn" | "stockOut" | "cancelled";

interface Row {
  id: string;
  date: string;
  brand: string;
  model: string;
  sku: string;
  color: string;
  size: string;
  qty: number;
  amount?: number;
  type: string;
  channel: string;
  actor: string;
  status: string;
  note: string;
}

const TITLES: Record<DrillKind, string> = {
  currentQty: "รายละเอียดจำนวนคงเหลือปัจจุบัน",
  sales: "รายละเอียดยอดขาย",
  stockIn: "รายละเอียดสต็อกเข้า",
  stockOut: "รายละเอียดสต็อกออก",
  cancelled: "รายละเอียดยอดยกเลิก",
};

function buildRows(state: AppState, kind: DrillKind, fromISO: string, toISO: string): Row[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();

  function brandModel(productId: string) {
    const product = state.products[productId];
    const brand = product?.brandId ? state.brands[product.brandId] : undefined;
    return { name: product?.sellingName ?? "-", brand: brand?.name ?? "-", model: product?.modelCode ?? "-" };
  }

  if (kind === "currentQty") {
    // อ่านจากสต็อกจริงปัจจุบัน (variantStock) โดยตรง แทนการรวมย้อนหลังจากประวัติการเคลื่อนไหว
    // เพื่อให้ตรงกับตัวเลขบนการ์ด KPI เสมอ แม้ไม่มีประวัติเก่าเหลืออยู่ (เช่น หลังรีเซ็ตสต็อก)
    const totals = new Map<string, number>();
    for (const s of Object.values(state.variantStock)) {
      totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.qtyOnHand);
    }
    const rows: Row[] = [];
    for (const [variantId, qty] of totals) {
      if (qty === 0) continue;
      const variant = state.variants[variantId];
      if (!variant) continue;
      const { name, brand, model } = brandModel(variant.productId);
      rows.push({
        id: variantId,
        date: "-",
        brand,
        model,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        qty,
        type: name,
        channel: "-",
        actor: "-",
        status: variant.isDefective ? "มีตำหนิ" : "-",
        note: "-",
      });
    }
    return rows.sort((a, b) => b.qty - a.qty);
  }

  if (kind === "sales" || kind === "cancelled") {
    const rows: Row[] = [];
    for (const o of Object.values(state.orders)) {
      if (kind === "sales") {
        if (o.status === "cancelled") continue;
        const t = new Date(o.date).getTime();
        if (t < from || t > to) continue;
      } else {
        if (o.status !== "cancelled" || !o.cancelledAt) continue;
        const t = new Date(o.cancelledAt).getTime();
        if (t < from || t > to) continue;
      }
      const brandName = o.brandId ? state.brands[o.brandId]?.name ?? "-" : "-";
      for (const line of o.lines) {
        const variant = state.variants[line.variantId];
        const { model } = variant ? brandModel(variant.productId) : { model: "-" };
        rows.push({
          id: line.id,
          date: kind === "cancelled" ? o.cancelledAt ?? o.date : o.date,
          brand: brandName,
          model,
          sku: variant?.sku ?? "-",
          color: variant?.color ?? "-",
          size: variant?.size ?? "-",
          qty: line.qty,
          amount: line.unitPrice * line.qty - line.discount,
          type: "ขาย",
          channel: SALES_CHANNEL_LABEL_TH[o.channel] ?? o.channel,
          actor: "-",
          status: ORDER_STATUS_LABEL_TH[o.status] ?? o.status,
          note: (kind === "cancelled" ? o.cancelReason : o.note) ?? "-",
        });
      }
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // stockIn / stockOut
  const rows: Row[] = [];
  for (const m of Object.values(state.movements)) {
    if (m.itemType !== "product") continue;
    const t = new Date(m.createdAt).getTime();
    if (t < from || t > to) continue;
    if (kind === "stockIn" && m.movementType !== "stock_in") continue;
    if (kind === "stockOut" && !(m.qtyChange < 0 && m.movementType !== "cancel_restock")) continue;
    const variant = m.variantId ? state.variants[m.variantId] : undefined;
    const { brand, model } = variant ? brandModel(variant.productId) : { brand: "-", model: "-" };
    rows.push({
      id: m.id,
      date: m.createdAt,
      brand,
      model,
      sku: m.sku ?? "-",
      color: m.color ?? "-",
      size: m.size ?? "-",
      qty: Math.abs(m.qtyChange),
      type: MOVEMENT_TYPE_LABEL_TH[m.movementType] ?? m.movementType,
      channel: "-",
      actor: m.actorName,
      status: "-",
      note: m.note ?? m.reason ?? "-",
    });
  }
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function DrillDownDialog({
  open,
  onClose,
  kind,
  range,
}: {
  open: boolean;
  onClose: () => void;
  kind: DrillKind;
  range: { from: string; to: string };
}) {
  const state = useStore();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => (open ? buildRows(state, kind, range.from, range.to) : []), [open, state, kind, range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.brand.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.color.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q) ||
        r.actor.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q);
      const matchesChannel = channel === "all" || r.channel === (SALES_CHANNEL_LABEL_TH as Record<string, string>)[channel];
      const matchesStatus = status === "all" || r.status === (ORDER_STATUS_LABEL_TH as Record<string, string>)[status];
      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [rows, search, channel, status]);

  const totalQty = filtered.reduce((s, r) => s + r.qty, 0);
  const totalAmount = filtered.reduce((s, r) => s + (r.amount ?? 0), 0);
  const showChannelStatus = kind === "sales" || kind === "cancelled";

  return (
    <Dialog open={open} onClose={onClose} title={TITLES[kind]} size="xl">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาแบรนด์/รุ่น/SKU/สี/ไซซ์/ผู้ทำรายการ..." />
          {showChannelStatus && (
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="all">ช่องทางทั้งหมด</option>
              {Object.entries(SALES_CHANNEL_LABEL_TH).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
          {showChannelStatus && (
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">สถานะทั้งหมด</option>
              {Object.entries(ORDER_STATUS_LABEL_TH).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[var(--color-surface-container)] px-4 py-3 text-sm">
          <span>
            รวม: <span className="font-semibold">{formatNumber(totalQty)}</span> ชิ้น จาก {filtered.length} รายการ
          </span>
          {totalAmount > 0 && (
            <span>
              มูลค่ารวม: <span className="font-semibold">{formatTHB(totalAmount)}</span>
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="ไม่พบข้อมูลที่ตรงกับเงื่อนไข" />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>วันที่</Th>
                  <Th>แบรนด์</Th>
                  <Th>รุ่น</Th>
                  <Th>SKU</Th>
                  <Th>สี</Th>
                  <Th>ไซซ์</Th>
                  <Th>จำนวน</Th>
                  <Th>ประเภท</Th>
                  {showChannelStatus && <Th>ช่องทาง</Th>}
                  {showChannelStatus && <Th>สถานะ</Th>}
                  {!showChannelStatus && <Th>ผู้ทำรายการ</Th>}
                  <Th>หมายเหตุ</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-xs text-[var(--color-on-surface-variant)]">{r.date === "-" ? "-" : formatThaiDateTime(r.date)}</Td>
                    <Td>{r.brand}</Td>
                    <Td>{r.model}</Td>
                    <Td className="font-mono text-xs">{r.sku}</Td>
                    <Td>{r.color}</Td>
                    <Td>{r.size}</Td>
                    <Td className="font-semibold">{formatNumber(r.qty)}</Td>
                    <Td>{r.type}</Td>
                    {showChannelStatus && <Td>{r.channel}</Td>}
                    {showChannelStatus && <Td>{r.status}</Td>}
                    {!showChannelStatus && <Td>{r.actor}</Td>}
                    <Td className="max-w-[160px] truncate text-xs text-[var(--color-on-surface-variant)]" title={r.note}>
                      {r.note}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
