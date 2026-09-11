"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ShoppingCart, XCircle, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { useStore, useActions } from "@/lib/store";
import { ordersInRange, orderNetTotal, orderQty } from "@/lib/store/selectors";
import { useCurrentUser, useCan } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { MARKETPLACE_CHANNELS, SALES_CHANNEL_LABEL_TH, type Order, type OrderStatus, type SalesChannel } from "@/lib/types";

const PAGE_SIZE = 15;

export default function OrdersPage() {
  const state = useStore();
  const { cancelOrder } = useActions();
  const user = useCurrentUser();
  const canCancel = useCan("order.cancel");

  const { value: range, setValue: setRange } = useDateRange("30d");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<SalesChannel | "all">("all");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [brandId, setBrandId] = useState("all");
  const [modelFilter, setModelFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const brands = useMemo(() => Object.values(state.brands), [state.brands]);
  const orders = useMemo(() => ordersInRange(state, range.from, range.to), [state, range]);

  const lineDetails = useCallback(
    (o: Order) =>
      o.lines.map((l) => {
        const variant = state.variants[l.variantId];
        const product = variant ? state.products[variant.productId] : undefined;
        return { line: l, variant, product };
      }),
    [state.variants, state.products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const modelQ = modelFilter.trim().toLowerCase();
    const colorQ = colorFilter.trim().toLowerCase();
    const sizeQ = sizeFilter.trim().toLowerCase();
    return orders
      .filter((o) => channel === "all" || o.channel === channel)
      .filter((o) => status === "all" || o.status === status)
      .filter((o) => brandId === "all" || o.brandId === brandId)
      .filter((o) => !q || o.orderNo.toLowerCase().includes(q))
      .filter(
        (o) =>
          !modelQ ||
          lineDetails(o).some(
            ({ product }) => product?.modelCode?.toLowerCase().includes(modelQ) || product?.sellingName.toLowerCase().includes(modelQ)
          )
      )
      .filter((o) => !colorQ || lineDetails(o).some(({ variant }) => variant?.color.toLowerCase().includes(colorQ)))
      .filter((o) => !sizeQ || lineDetails(o).some(({ variant }) => variant?.size.toLowerCase().includes(sizeQ)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, search, channel, status, brandId, modelFilter, colorFilter, sizeFilter, lineDetails]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const invoiceablePaged = paged.filter((o) => (MARKETPLACE_CHANNELS as readonly string[]).includes(o.channel));
  const allInvoiceablePagedSelected = invoiceablePaged.length > 0 && invoiceablePaged.every((o) => selected.has(o.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allInvoiceablePagedSelected) {
        for (const o of invoiceablePaged) next.delete(o.id);
      } else {
        for (const o of invoiceablePaged) next.add(o.id);
      }
      return next;
    });
  }

  function openCancel(order: Order) {
    setCancelTarget(order);
    setCancelReason("");
  }

  function handleCancel() {
    if (!cancelTarget || !user) return;
    if (!cancelReason.trim()) {
      toastError("กรุณาระบุเหตุผลการยกเลิก");
      return;
    }
    setBusy(true);
    try {
      cancelOrder(cancelTarget.id, cancelReason.trim(), user.id, user.name);
      toastSuccess("ยกเลิกคำสั่งซื้อและคืนสต็อกเรียบร้อยแล้ว");
      setCancelTarget(null);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title="คำสั่งซื้อ"
        description="รายการคำสั่งซื้อที่เกิดจากการเบิกสินค้าออกแบบขาย พร้อมยกเลิกและคืนสต็อกได้"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาเลขที่ออเดอร์..."
              className="w-72 pl-9"
            />
          </div>
          {selected.size > 0 && (
            <Link href={`/invoices/new?orderIds=${Array.from(selected).join(",")}`}>
              <Button>
                <FileText className="h-4 w-4" /> สร้างใบกำกับภาษี ({selected.size})
              </Button>
            </Link>
          )}
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
            <SlidersHorizontal className="h-4 w-4" /> ตัวกรองละเอียด
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">แบรนด์/ร้านทั้งหมด</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as SalesChannel | "all");
                setPage(1);
              }}
            >
              <option value="all">ช่องทางทั้งหมด</option>
              {Object.entries(SALES_CHANNEL_LABEL_TH).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OrderStatus | "all");
                setPage(1);
              }}
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="completed">สำเร็จ</option>
              <option value="cancelled">ยกเลิก</option>
              <option value="pending_payment">รอชำระ</option>
              <option value="paid">ชำระแล้ว</option>
              <option value="preparing">กำลังจัดเตรียม</option>
              <option value="shipped">จัดส่งแล้ว</option>
              <option value="returned">คืนสินค้า</option>
            </Select>
            <Input
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                setPage(1);
              }}
              placeholder="กรองตามรุ่น/ชื่อสินค้า..."
            />
            <Input
              value={colorFilter}
              onChange={(e) => {
                setColorFilter(e.target.value);
                setPage(1);
              }}
              placeholder="กรองตามสี..."
            />
            <Input
              value={sizeFilter}
              onChange={(e) => {
                setSizeFilter(e.target.value);
                setPage(1);
              }}
              placeholder="กรองตามไซซ์..."
            />
          </div>
        </Card>

        <Card>
          {paged.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<ShoppingCart className="h-10 w-10" />} title="ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไข" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {paged.map((o) => {
                  const expanded = expandedId === o.id;
                  const invoiceable = (MARKETPLACE_CHANNELS as readonly string[]).includes(o.channel);
                  return (
                    <div key={o.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          {invoiceable && (
                            <input
                              type="checkbox"
                              checked={selected.has(o.id)}
                              onChange={() => toggleOne(o.id)}
                              className="mt-1 h-4 w-4 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{o.orderNo}</p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(o.date)}</p>
                            <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                              {o.brandId ? state.brands[o.brandId]?.name ?? "-" : "-"} · {SALES_CHANNEL_LABEL_TH[o.channel]}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <OrderStatusBadge status={o.status} />
                          <p className="mt-1 text-sm font-semibold">{formatTHB(orderNetTotal(o))}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">{formatNumber(orderQty(o))} ชิ้น</p>
                        </div>
                      </div>
                      {o.status === "cancelled" && o.cancelReason && (
                        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">เหตุผล: {o.cancelReason}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {invoiceable && (
                          <Link href={`/invoices/new?orderIds=${o.id}`}>
                            <Button size="sm" variant="ghost">
                              <FileText className="h-3.5 w-3.5" /> ใบกำกับภาษี
                            </Button>
                          </Link>
                        )}
                        {canCancel && o.status !== "cancelled" && (
                          <Button size="sm" variant="ghost" onClick={() => openCancel(o)}>
                            <XCircle className="h-3.5 w-3.5" /> ยกเลิก
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : o.id)}
                          className="ml-auto flex items-center gap-1 text-xs font-medium text-[var(--color-primary-container)]"
                        >
                          {expanded ? "ซ่อนรายการ" : "ดูรายการสินค้า"}
                          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {expanded && (
                        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-[var(--color-surface-container)] p-2.5">
                          {lineDetails(o).map(({ line, variant, product }) => (
                            <div key={line.id} className="text-xs">
                              <p className="font-medium text-[var(--color-on-surface)]">
                                {product?.sellingName ?? "-"} · {variant?.color ?? "-"}/{variant?.size ?? "-"}
                              </p>
                              <p className="text-[var(--color-on-surface-variant)]">
                                {variant?.sku ?? "-"} · {formatNumber(line.qty)} x {formatTHB(line.unitPrice)}
                                {line.discount ? ` − ส่วนลด ${formatTHB(line.discount)}` : ""} ={" "}
                                <span className="font-semibold text-[var(--color-on-surface)]">
                                  {formatTHB(line.qty * line.unitPrice - (line.discount ?? 0))}
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
              <Table>
              <Thead>
                <Tr>
                  <Th>
                    <input type="checkbox" checked={allInvoiceablePagedSelected} onChange={toggleAllOnPage} className="h-4 w-4" />
                  </Th>
                  <Th></Th>
                  <Th>เลขที่ออเดอร์</Th>
                  <Th>วันที่</Th>
                  <Th>แบรนด์/ร้าน</Th>
                  <Th>ช่องทาง</Th>
                  <Th>จำนวนสินค้า</Th>
                  <Th>ยอดสุทธิ</Th>
                  <Th>สถานะ</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {paged.map((o) => {
                  const expanded = expandedId === o.id;
                  return (
                    <Fragment key={o.id}>
                      <Tr className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : o.id)}>
                        <Td onClick={(e) => e.stopPropagation()}>
                          {(MARKETPLACE_CHANNELS as readonly string[]).includes(o.channel) && (
                            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} className="h-4 w-4" />
                          )}
                        </Td>
                        <Td>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Td>
                        <Td className="font-medium">{o.orderNo}</Td>
                        <Td className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(o.date)}</Td>
                        <Td>{o.brandId ? state.brands[o.brandId]?.name ?? "-" : "-"}</Td>
                        <Td>{SALES_CHANNEL_LABEL_TH[o.channel]}</Td>
                        <Td>{formatNumber(orderQty(o))}</Td>
                        <Td className="font-semibold">{formatTHB(orderNetTotal(o))}</Td>
                        <Td>
                          <OrderStatusBadge status={o.status} />
                        </Td>
                        <Td onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-2">
                            {(MARKETPLACE_CHANNELS as readonly string[]).includes(o.channel) && (
                              <Link href={`/invoices/new?orderIds=${o.id}`}>
                                <Button size="sm" variant="ghost">
                                  <FileText className="h-3.5 w-3.5" /> ใบกำกับภาษี
                                </Button>
                              </Link>
                            )}
                            {canCancel && o.status !== "cancelled" && (
                              <Button size="sm" variant="ghost" onClick={() => openCancel(o)}>
                                <XCircle className="h-3.5 w-3.5" /> ยกเลิก
                              </Button>
                            )}
                          </div>
                          {o.status === "cancelled" && o.cancelReason && (
                            <p className="max-w-[180px] text-xs text-[var(--color-on-surface-variant)]">เหตุผล: {o.cancelReason}</p>
                          )}
                        </Td>
                      </Tr>
                      {expanded && (
                        <Tr>
                          <Td colSpan={10} className="bg-[var(--color-surface-container)] p-0">
                            <div className="p-4">
                              <Table>
                                <Thead>
                                  <Tr>
                                    <Th>สินค้า</Th>
                                    <Th>รุ่น</Th>
                                    <Th>สี</Th>
                                    <Th>ไซซ์</Th>
                                    <Th>SKU</Th>
                                    <Th>จำนวน</Th>
                                    <Th>ราคาต่อหน่วย</Th>
                                    <Th>ส่วนลด</Th>
                                    <Th>รวม</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {lineDetails(o).map(({ line, variant, product }) => (
                                    <Tr key={line.id}>
                                      <Td>{product?.sellingName ?? "-"}</Td>
                                      <Td>{product?.modelCode ?? "-"}</Td>
                                      <Td>{variant?.color ?? "-"}</Td>
                                      <Td>{variant?.size ?? "-"}</Td>
                                      <Td className="font-mono text-xs">{variant?.sku ?? "-"}</Td>
                                      <Td>{formatNumber(line.qty)}</Td>
                                      <Td>{formatTHB(line.unitPrice)}</Td>
                                      <Td>{formatTHB(line.discount ?? 0)}</Td>
                                      <Td className="font-semibold">{formatTHB(line.qty * line.unitPrice - (line.discount ?? 0))}</Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </div>
                          </Td>
                        </Tr>
                      )}
                    </Fragment>
                  );
                })}
              </Tbody>
            </Table>
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </Card>
      </PageContainer>

      <Dialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="ยกเลิกคำสั่งซื้อ"
        description={cancelTarget ? `ออเดอร์ ${cancelTarget.orderNo} — สต็อกสินค้าในออเดอร์นี้จะถูกคืนกลับเข้าคลังทันที` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              ปิด
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={busy}>
              ยืนยันยกเลิก
            </Button>
          </>
        }
      >
        <FormField label="เหตุผลการยกเลิก" required>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
        </FormField>
      </Dialog>
    </>
  );
}
