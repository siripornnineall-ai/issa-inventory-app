"use client";

import { useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore, useActions } from "@/lib/store";
import { orderNetTotal } from "@/lib/store/selectors";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatTHB } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { NO_TAX_INVOICE_BUYER_LABEL, SALES_CHANNEL_LABEL_TH } from "@/lib/types";

function NewInvoiceForm() {
  const state = useStore();
  const { createInvoice } = useActions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderIds = useMemo(() => (searchParams.get("orderIds") ?? "").split(",").filter(Boolean), [searchParams]);
  const orders = useMemo(() => orderIds.map((id) => state.orders[id]).filter((o): o is NonNullable<typeof o> => Boolean(o)), [orderIds, state.orders]);
  const grandTotal = orders.reduce((s, o) => s + orderNetTotal(o), 0);

  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState icon={<FileText className="h-10 w-10" />} title="ไม่พบคำสั่งซื้อที่เลือก" description="กรุณากลับไปเลือกคำสั่งซื้อจากหน้าคำสั่งซื้ออีกครั้ง" />
        </CardContent>
      </Card>
    );
  }

  function handleSubmit() {
    setSaving(true);
    try {
      const invoice = createInvoice({
        orderIds,
        buyerName: buyerName || undefined,
        buyerAddress: buyerAddress || undefined,
        buyerTaxId: buyerTaxId || undefined,
        note: note || undefined,
      });
      toastSuccess("สร้างใบกำกับภาษีเรียบร้อยแล้ว");
      router.replace(`/invoices/${invoice.id}`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>คำสั่งซื้อที่เลือก ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* การ์ดสำหรับจอมือถือ */}
          <div className="divide-y divide-[var(--color-border)] sm:hidden">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.orderNo}</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(o.date)} · {SALES_CHANNEL_LABEL_TH[o.channel]}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatTHB(orderNetTotal(o))}</p>
              </div>
            ))}
          </div>

          {/* ตารางสำหรับจอกว้าง */}
          <div className="hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>เลขที่ออเดอร์</Th>
                  <Th>วันที่</Th>
                  <Th>ช่องทาง</Th>
                  <Th>ยอดสุทธิ</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-medium">{o.orderNo}</Td>
                    <Td className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(o.date)}</Td>
                    <Td>{SALES_CHANNEL_LABEL_TH[o.channel]}</Td>
                    <Td className="font-semibold">{formatTHB(orderNetTotal(o))}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end text-sm">
            <span>
              ยอดรวมทั้งสิ้น: <span className="font-semibold">{formatTHB(grandTotal)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลผู้ซื้อ</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4">
          <FormField label="ชื่อผู้ซื้อ" hint={`เว้นว่างไว้ = "${NO_TAX_INVOICE_BUYER_LABEL}" (กรณีลูกค้าปลายทางไม่ต้องการใบกำกับภาษี)`} className="col-span-2">
            <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder={NO_TAX_INVOICE_BUYER_LABEL} />
          </FormField>
          <FormField label="ที่อยู่ผู้ซื้อ" className="col-span-2">
            <Textarea value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="กรอกเมื่อลูกค้าขอใบกำกับภาษีเต็มรูป" />
          </FormField>
          <FormField label="เลขประจำตัวผู้เสียภาษีผู้ซื้อ">
            <Input value={buyerTaxId} onChange={(e) => setBuyerTaxId(e.target.value)} />
          </FormField>
          <FormField label="หมายเหตุ" className="col-span-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ชื่อช่องทางการขาย หรือหมายเหตุอื่น ๆ" />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.replace("/orders")}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          สร้างใบกำกับภาษี
        </Button>
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <>
      <Header
        title="สร้างใบกำกับภาษี"
        description="รวมคำสั่งซื้อที่เลือกเป็นใบกำกับภาษี/ใบเสร็จรับเงินเดียว"
        actions={
          <BackLink href="/orders" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </BackLink>
        }
      />
      <PageContainer className="max-w-4xl">
        <RequireAccess perm="order.create">
          <NewInvoiceForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
