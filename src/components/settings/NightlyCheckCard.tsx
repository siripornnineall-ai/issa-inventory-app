"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDateTime } from "@/lib/utils/date";

interface StockIssue {
  type: string;
  sku: string;
  expected: number;
  actual: number;
  diff: number;
}

interface IntegrityIssue {
  kind: string;
  ref: string | null;
  at: string | null;
}

interface CheckRow {
  checked_at: string;
  mismatches: number;
  detail: StockIssue[];
  integrity: IntegrityIssue[];
}

const KIND_LABEL: Record<string, string> = {
  order_without_lines: "ออเดอร์ไม่มีรายการสินค้า",
  stock_in_doc_without_lines: "ใบรับเข้าไม่มีรายการสินค้า",
  stock_out_doc_without_lines: "ใบเบิกออกไม่มีรายการสินค้า",
  transfer_without_lines: "ใบโอนย้ายไม่มีรายการสินค้า",
  sale_movement_without_order: "ขายออกแล้วแต่ไม่มีออเดอร์",
  image_color_without_variant: "มีรูปของสีนี้ แต่ไม่มีตัวเลือกสีนี้",
  product_without_variants: "สินค้าไม่มีตัวเลือกเลย",
  stock_in_doc_qty_mismatch: "ใบรับเข้ามียอดไม่เท่ากับรายการเคลื่อนไหว (เลขใบอาจชนกับอีกเครื่อง)",
  order_qty_mismatch: "ออเดอร์มียอดไม่เท่ากับรายการเคลื่อนไหว (เลขใบอาจชนกับอีกเครื่อง)",
};

// ผลตรวจประจำคืนจากฐานข้อมูล (ทุกวัน 03:10 น.): สต็อกไม่ตรงกับผลรวมของประวัติ ยอดติดลบ และข้อมูลที่บันทึกไม่ครบ
// อ่านได้เฉพาะผู้ดูแลระบบ (สิทธิ์ฝั่งฐานข้อมูล)
export function NightlyCheckCard() {
  const [row, setRow] = useState<CheckRow | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLatest = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from("stock_check_log")
      .select("checked_at, mismatches, detail, integrity")
      .order("id", { ascending: false })
      .limit(1);
    return { row: (data?.[0] as CheckRow | undefined) ?? null, message: err?.message ?? "" };
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchLatest().then((r) => {
      if (!alive) return;
      if (r.message) setError(r.message);
      else setRow(r.row);
    });
    return () => {
      alive = false;
    };
  }, [fetchLatest]);

  async function reload() {
    setLoading(true);
    setError("");
    const r = await fetchLatest();
    setLoading(false);
    if (r.message) setError(r.message);
    else setRow(r.row);
  }

  const stockIssues = row?.detail ?? [];
  const integrity = row?.integrity ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>ผลตรวจประจำคืนจากฐานข้อมูล</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          ฐานข้อมูลตรวจเองทุกคืนเวลา 03:10 น. ว่ายอดสต็อกเท่ากับผลรวมของประวัติหรือไม่ มียอดติดลบหรือไม่ และมีใบ/ออเดอร์/สินค้าที่บันทึกไม่ครบหรือไม่ (เห็นเฉพาะผู้ดูแลระบบ)
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => void reload()} loading={loading}>
            <RefreshCw className="h-4 w-4" /> โหลดผลล่าสุด
          </Button>
          {row && <span className="text-sm text-[var(--color-on-surface-variant)]">ตรวจเมื่อ {formatThaiDateTime(row.checked_at)}</span>}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-[var(--color-danger-container)] px-3 py-2 text-sm text-[var(--color-on-danger-container)]">
            โหลดผลตรวจไม่สำเร็จ: {error}
          </p>
        )}
        {row === null && !error && <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีผลตรวจ (หรือคุณไม่ใช่ผู้ดูแลระบบ)</p>}

        {row && stockIssues.length === 0 && integrity.length === 0 && (
          <p role="status" className="rounded-xl bg-[var(--color-success-container)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
            ไม่พบความผิดปกติ
          </p>
        )}

        {row && stockIssues.length > 0 && (
          <>
            <p role="alert" className="rounded-xl bg-[var(--color-danger-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-danger-container)]">
              สต็อกไม่ตรงกับประวัติ {stockIssues.length} รายการ (ควรนับของจริงแล้วปรับที่หน้านับสต็อก)
            </p>
            <Table>
              <Thead>
                <Tr>
                  <Th>รหัสสินค้า</Th>
                  <Th>ประวัติรวมได้</Th>
                  <Th>ยอดในระบบ</Th>
                  <Th>ต่าง</Th>
                </Tr>
              </Thead>
              <Tbody>
                {stockIssues.map((m) => (
                  <Tr key={`${m.type}-${m.sku}`}>
                    <Td className="font-mono text-xs">{m.sku}</Td>
                    <Td>{m.expected}</Td>
                    <Td className="font-semibold text-[var(--color-danger)]">{m.actual}</Td>
                    <Td>{m.diff > 0 ? `+${m.diff}` : m.diff}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}

        {row && integrity.length > 0 && (
          <>
            <p role="alert" className="rounded-xl bg-[var(--color-warning-container)] px-3 py-2 text-sm font-medium text-[var(--color-warning)]">
              ข้อมูลที่อาจบันทึกไม่ครบ {integrity.length} รายการ
            </p>
            <Table>
              <Thead>
                <Tr>
                  <Th>เรื่อง</Th>
                  <Th>รายการ</Th>
                  <Th>เวลา</Th>
                </Tr>
              </Thead>
              <Tbody>
                {integrity.map((i) => (
                  <Tr key={`${i.kind}-${i.ref}`}>
                    <Td>{KIND_LABEL[i.kind] ?? i.kind}</Td>
                    <Td className="font-medium">{i.ref}</Td>
                    <Td>{i.at ? formatThaiDateTime(i.at) : "-"}</Td>
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
