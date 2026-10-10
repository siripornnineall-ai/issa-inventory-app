"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { useStore } from "@/lib/store";
import { findStockMismatches, type StockMismatch } from "@/lib/utils/stockAudit";
import { formatThaiDateTime } from "@/lib/utils/date";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ตรวจสต็อกเทียบกับประวัติ: หายอดที่ไม่ตรงกับบรรทัดสุดท้ายในประวัติ เพื่อให้รู้ทันทีถ้ามีการบันทึกไม่ครบ
export function StockAuditCard() {
  const state = useStore();
  const [since, setSince] = useState(() => toISODate(new Date(Date.now() - 7 * 24 * 3600 * 1000)));
  const [result, setResult] = useState<StockMismatch[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string>("");

  function run() {
    setResult(findStockMismatches(state, { sinceISO: since ? new Date(since + "T00:00:00+07:00").toISOString() : undefined }));
    setCheckedAt(new Date().toISOString());
  }

  function itemLabel(m: StockMismatch): string {
    if (m.itemType === "product") {
      const v = state.variants[m.itemId];
      const p = v ? state.products[v.productId] : undefined;
      return v ? `${p?.sellingName ?? v.sku} ${v.color}/${v.size}` : "(ถูกลบแล้ว)";
    }
    const e = state.equipment[m.itemId];
    return e ? `${e.name}${e.size ? ` (${e.size})` : ""}` : "(ถูกลบแล้ว)";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ตรวจสอบความถูกต้องของสต็อก</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          เทียบยอดคงเหลือกับบรรทัดสุดท้ายในประวัติของแต่ละรายการ ถ้าไม่ตรงแสดงว่ามีการบันทึกไม่ครบ ควรรีเฟรชหน้าก่อนกดตรวจเพื่อให้ได้ข้อมูลล่าสุด
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="ตรวจรายการที่เคลื่อนไหวตั้งแต่วันที่" className="w-56">
            <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </FormField>
          <Button type="button" onClick={run}>
            <ShieldCheck className="h-4 w-4" /> ตรวจเดี๋ยวนี้
          </Button>
        </div>

        {result && result.length === 0 && (
          <p role="status" className="rounded-xl bg-[var(--color-success-container)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
            ไม่พบรายการที่ยอดไม่ตรงกับประวัติ (ตรวจเมื่อ {formatThaiDateTime(checkedAt)})
          </p>
        )}

        {result && result.length > 0 && (
          <>
            <p role="alert" className="rounded-xl bg-[var(--color-danger-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-danger-container)]">
              พบ {result.length} รายการที่ยอดไม่ตรงกับประวัติ ตรวจของจริงแล้วแก้ที่หน้านับสต็อก (ระบบจะบันทึกประวัติการปรับยอดให้)
            </p>
            <Table>
              <Thead>
                <Tr>
                  <Th>รายการ</Th>
                  <Th>ประวัติล่าสุดบอกว่า</Th>
                  <Th>ยอดในระบบตอนนี้</Th>
                  <Th>รายการล่าสุดเมื่อ</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.map((m) => (
                  <Tr key={`${m.itemType}-${m.itemId}-${m.warehouseId}`}>
                    <Td className="font-medium">{itemLabel(m)}</Td>
                    <Td>{m.recorded}</Td>
                    <Td className="font-semibold text-[var(--color-danger)]">{m.actual}</Td>
                    <Td>{formatThaiDateTime(m.lastMovement.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
