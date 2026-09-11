"use client";

import { useStore } from "@/lib/store";
import { formatTHB, formatNumber, vatBreakdown } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";

export function PoDocument({ docId, className, vatEnabled = false }: { docId: string; className?: string; vatEnabled?: boolean }) {
  const state = useStore();
  const doc = state.stockInDocs[docId];

  if (!doc) {
    return <div className="p-8 text-sm text-[var(--color-on-surface-variant)]">ไม่พบเอกสารรับสินค้าเข้านี้ (id: {docId})</div>;
  }

  const supplier = doc.supplierId ? state.suppliers[doc.supplierId] : undefined;
  const warehouse = state.warehouses[doc.warehouseId];
  const company = state.companyInfo;

  const rows = doc.lines.map((l) => {
    const variant = state.variants[l.itemId];
    const product = variant ? state.products[variant.productId] : undefined;
    const qty = l.qty;
    const unitCost = l.unitCost ?? 0;
    return {
      id: l.id,
      name: product?.sellingName ?? "-",
      detail: variant ? `${variant.color} / ${variant.size} · ${variant.sku}` : "-",
      qty,
      unitCost,
      total: qty * unitCost,
    };
  });
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const { subtotal, vat } = vatBreakdown(grandTotal, vatEnabled);

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
          <p className="text-xl font-bold">ใบสั่งซื้อ (Purchase Order)</p>
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">เลขที่: {doc.poNumber}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">วันที่: {formatThaiDate(doc.date)}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">อ้างอิงเอกสารรับเข้า: {doc.docNo}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-medium text-[var(--color-on-surface-variant)]">ผู้ผลิต / ซัพพลายเออร์</p>
          <p className="font-medium">{supplier?.name ?? "-"}</p>
          {supplier?.address && <p className="text-xs text-[var(--color-on-surface-variant)]">{supplier.address}</p>}
          {supplier?.taxId && <p className="text-xs text-[var(--color-on-surface-variant)]">เลขผู้เสียภาษี: {supplier.taxId}</p>}
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-on-surface-variant)]">คลังปลายทาง</p>
          <p className="font-medium">{warehouse?.name ?? "-"}</p>
          {doc.billNumber && (
            <>
              <p className="mt-2 text-xs font-medium text-[var(--color-on-surface-variant)]">เลขที่บิล / ใบส่งของ</p>
              <p className="font-medium">{doc.billNumber}</p>
            </>
          )}
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border-strong)] text-left">
            <th className="py-2">สินค้า</th>
            <th className="py-2 text-right">จำนวน</th>
            <th className="py-2 text-right">ราคาต่อหน่วย</th>
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
              <td className="py-2 text-right">{formatTHB(r.unitCost)}</td>
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
                <span>ราคาไม่รวมภาษีมูลค่าเพิ่ม</span>
                <span>{formatTHB(subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs text-[var(--color-on-surface-variant)]">
                <span>ภาษีมูลค่าเพิ่ม 7%</span>
                <span>{formatTHB(vat)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-[var(--color-border-strong)] pt-2 text-sm font-semibold">
            <span>ยอดรวมทั้งสิ้น</span>
            <span>{formatTHB(grandTotal)}</span>
          </div>
        </div>
      </div>

      {doc.note && (
        <div className="mt-6">
          <p className="text-xs font-medium text-[var(--color-on-surface-variant)]">หมายเหตุ</p>
          <p>{doc.note}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-6 text-center text-xs">
        <div>
          <div className="mb-1 border-b border-[var(--color-border-strong)] pb-8" />
          <p className="font-medium">{doc.issuedByName || " "}</p>
          <p>ผู้สั่งซื้อ</p>
        </div>
        <div>
          <div className="mb-1 border-b border-[var(--color-border-strong)] pb-8" />
          <p className="font-medium">{doc.approvedByName || " "}</p>
          <p>ผู้อนุมัติ</p>
        </div>
      </div>
    </div>
  );
}
