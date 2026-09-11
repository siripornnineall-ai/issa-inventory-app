"use client";

import { useStore } from "@/lib/store";
import { formatTHB, formatNumber, vatBreakdown } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";
import { MARKETPLACE_CHANNELS, SALES_CHANNEL_LABEL_TH } from "@/lib/types";

export function InvoiceDocument({ invoiceId, className, vatEnabled = false }: { invoiceId: string; className?: string; vatEnabled?: boolean }) {
  const state = useStore();
  const invoice = state.invoices[invoiceId];

  if (!invoice) {
    return <div className="p-8 text-sm text-[var(--color-on-surface-variant)]">ไม่พบใบกำกับภาษีนี้ (id: {invoiceId})</div>;
  }

  const company = state.companyInfo;
  const orders = invoice.orderIds.map((id) => state.orders[id]).filter((o): o is NonNullable<typeof o> => Boolean(o));

  const rows = orders.flatMap((order) =>
    order.lines.map((l) => {
      const variant = state.variants[l.variantId];
      const product = variant ? state.products[variant.productId] : undefined;
      const total = l.qty * l.unitPrice - (l.discount ?? 0);
      return {
        id: l.id,
        name: product?.sellingName ?? "-",
        detail: variant ? `${variant.color} / ${variant.size} · ${variant.sku}` : "-",
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount ?? 0,
        total,
      };
    })
  );
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const { subtotal, vat } = vatBreakdown(grandTotal, vatEnabled);

  const channelLabels = Array.from(new Set(orders.map((o) => SALES_CHANNEL_LABEL_TH[o.channel])));
  const orderNos = orders.map((o) => o.orderNo).join(", ");
  const isMarketplaceOnly = orders.length > 0 && orders.every((o) => (MARKETPLACE_CHANNELS as readonly string[]).includes(o.channel));

  return (
    <div className={`mx-auto max-w-3xl p-8 text-sm text-[var(--color-on-surface)] ${className ?? ""}`}>
      <div className="mb-8 flex items-start justify-between border-b border-[var(--color-border)] pb-6">
        <div>
          <p className="text-lg font-semibold">{company.name}</p>
          {company.address && <p className="text-xs text-[var(--color-on-surface-variant)]">{company.address}</p>}
          {company.phone && <p className="text-xs text-[var(--color-on-surface-variant)]">โทร. {company.phone}</p>}
          {company.taxId && <p className="text-xs text-[var(--color-on-surface-variant)]">เลขผู้เสียภาษี: {company.taxId}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">ใบกำกับภาษี/ใบเสร็จรับเงิน</p>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">เลขที่: {invoice.invoiceNo}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">วันที่: {formatThaiDate(invoice.date)}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">อ้างอิงออเดอร์: {orderNos || "-"}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium text-[var(--color-on-surface-variant)]">ลูกค้า</p>
        <p className="font-medium">{invoice.buyerName}</p>
        {invoice.buyerAddress && <p className="text-xs text-[var(--color-on-surface-variant)]">{invoice.buyerAddress}</p>}
        {invoice.buyerTaxId && <p className="text-xs text-[var(--color-on-surface-variant)]">เลขประจำตัวผู้เสียภาษี: {invoice.buyerTaxId}</p>}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border-strong)] text-left">
            <th className="py-2">สินค้า</th>
            <th className="py-2 text-right">จำนวน</th>
            <th className="py-2 text-right">ราคาต่อหน่วย</th>
            <th className="py-2 text-right">ส่วนลด</th>
            <th className="py-2 text-right">รวม</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-2">
                <p className="font-medium">{r.name}</p>
                <p className="text-[var(--color-on-surface-variant)]">{r.detail}</p>
              </td>
              <td className="py-2 text-right">{formatNumber(r.qty)}</td>
              <td className="py-2 text-right">{formatTHB(r.unitPrice)}</td>
              <td className="py-2 text-right">{formatTHB(r.discount)}</td>
              <td className="py-2 text-right">{formatTHB(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-64">
          {vatEnabled && (
            <>
              <div className="flex justify-between py-0.5 text-xs text-[var(--color-on-surface-variant)]">
                <span>มูลค่าที่ไม่มี/ยกเว้นภาษี</span>
                <span>{formatTHB(0)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs text-[var(--color-on-surface-variant)]">
                <span>มูลค่าที่คำนวณภาษี</span>
                <span>{formatTHB(subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs text-[var(--color-on-surface-variant)]">
                <span>ภาษีมูลค่าเพิ่ม 7%</span>
                <span>{formatTHB(vat)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-[var(--color-border-strong)] pt-2 text-sm font-semibold">
            <span>จำนวนเงินรวมทั้งสิ้น</span>
            <span>{formatTHB(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium text-[var(--color-on-surface-variant)]">หมายเหตุ</p>
        <p className="text-xs">{invoice.note || (isMarketplaceOnly ? channelLabels.join(", ") : "-")}</p>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-6 text-center text-xs">
        <div>
          <div className="mb-1 border-b border-[var(--color-border-strong)] pb-8" />
          <p className="font-medium">{invoice.buyerName}</p>
          <p>ผู้จ่ายเงิน</p>
        </div>
        <div>
          <div className="mb-1 border-b border-[var(--color-border-strong)] pb-8" />
          <p className="font-medium">{company.name}</p>
          <p>ผู้รับเงิน</p>
        </div>
      </div>
    </div>
  );
}
