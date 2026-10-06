"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import { useMemo } from "react";
import { Download, Wallet, ArrowDownToLine, ArrowUpFromLine, XCircle, Trophy, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle, KpiCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { SalesExcelExport } from "@/components/reports/SalesExcelExport";
import { useStore } from "@/lib/store";
import {
  bestSellers,
  dashboardStats,
  lowStockEquipment,
  lowStockVariants,
  movementsInRange,
  orderNetTotal,
  orderQty,
  ordersInRange,
} from "@/lib/store/selectors";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { useCan, useCanViewCost } from "@/lib/auth/session";
import { MOVEMENT_TYPE_LABEL_TH, SALES_CHANNEL_LABEL_TH } from "@/lib/types";

export default function ReportsPage() {
  const state = useStore();
  const canExport = useCan("report.export");
  const canViewCost = useCanViewCost();
  const { value: range, setValue: setRange } = useDateRange("30d");

  const stats = useMemo(() => dashboardStats(state, range.from, range.to), [state, range]);
  const top = useMemo(() => bestSellers(state, range.from, range.to, 20), [state, range]);
  const orders = useMemo(() => ordersInRange(state, range.from, range.to), [state, range]);
  const movements = useMemo(() => movementsInRange(state, range.from, range.to), [state, range]);
  const lowStockProducts = useMemo(() => lowStockVariants(state), [state]);
  const lowStockEquip = useMemo(() => lowStockEquipment(state), [state]);

  const byChannel = useMemo(() => {
    const completed = orders.filter((o) => o.status !== "cancelled");
    const map = new Map<string, { qty: number; revenue: number; orders: number }>();
    for (const o of completed) {
      const entry = map.get(o.channel) ?? { qty: 0, revenue: 0, orders: 0 };
      entry.qty += orderQty(o);
      entry.revenue += orderNetTotal(o);
      entry.orders += 1;
      map.set(o.channel, entry);
    }
    return Array.from(map.entries())
      .map(([channel, v]) => ({ channel: channel as keyof typeof SALES_CHANNEL_LABEL_TH, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { "รายการ": "จำนวนสินค้าปัจจุบัน (ชิ้น)", "ค่า": stats.currentQty },
      { "รายการ": "ยอดขาย (บาท)", "ค่า": stats.sales.baht },
      { "รายการ": "จำนวนขาย (ชิ้น)", "ค่า": stats.sales.qty },
      { "รายการ": "จำนวนออเดอร์", "ค่า": stats.sales.orders },
      { "รายการ": "สต็อกเข้า (ชิ้น)", "ค่า": stats.stockIn.qty },
      { "รายการ": "สต็อกออก (ชิ้น)", "ค่า": stats.stockOut.qty },
      { "รายการ": "ยอดยกเลิก (บาท)", "ค่า": stats.cancelled.baht },
      { "รายการ": "จำนวนออเดอร์ที่ยกเลิก", "ค่า": stats.cancelled.orders },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "สรุปภาพรวม");

    const bestSellerRows = top.map((t, idx) => ({
      "อันดับ": idx + 1,
      "ชื่อสินค้า": t.product.sellingName,
      "จำนวนขาย": t.qty,
      "ยอดขาย": t.revenue,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bestSellerRows), "สินค้าขายดี");

    const channelRows = byChannel.map((c) => ({
      "ช่องทาง": SALES_CHANNEL_LABEL_TH[c.channel],
      "จำนวนออเดอร์": c.orders,
      "จำนวนชิ้น": c.qty,
      "ยอดขาย": c.revenue,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(channelRows), "ยอดขายตามช่องทาง");

    const movementRows = movements.map((m) => ({
      "วันที่": formatThaiDateTime(m.createdAt),
      "เลขที่เอกสาร": m.refNo,
      "รายการ": m.itemName,
      "SKU/รหัส": m.sku,
      "ประเภทการเคลื่อนไหว": MOVEMENT_TYPE_LABEL_TH[m.movementType],
      "จำนวนเปลี่ยนแปลง": m.qtyChange,
      "ผู้ทำรายการ": m.actorName,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movementRows), "การเคลื่อนไหวสต็อก");

    const lowStockRows = lowStockProducts.map(({ variant, stock }) => {
      const product = state.products[variant.productId];
      return {
        "ชื่อสินค้า": product?.sellingName ?? "-",
        "สี": variant.color,
        "ไซซ์": variant.size,
        "SKU": variant.sku,
        "คงเหลือ": stock.onHand,
        "จุดแจ้งเตือน": variant.reorderPoint,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lowStockRows), "สินค้าใกล้หมด");

    const lowStockEquipRows = lowStockEquip.map(({ equipment, stock }) => ({
      "ชื่ออุปกรณ์": equipmentLabel(equipment),
      "คงเหลือ": stock.onHand,
      "หน่วย": equipment.unit,
      "จุดแจ้งเตือน": equipment.reorderPoint,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lowStockEquipRows), "อุปกรณ์ใกล้หมด");

    XLSX.writeFile(wb, `รายงาน-ISSA-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <>
      <Header
        title="รายงาน"
        description="สรุปยอดขาย สินค้าขายดี และภาพรวมสต็อกสำหรับช่วงเวลาที่เลือก"
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker value={range} onChange={setRange} />
            {canExport && (
              <Button variant="secondary" onClick={exportExcel}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            )}
          </div>
        }
      />
      <PageContainer>
        <RequireAccess perm="report.view">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="ยอดขาย"
            value={formatTHB(stats.sales.baht, { compact: true })}
            unit={`· ${formatNumber(stats.sales.qty)} ชิ้น`}
          />
          <KpiCard icon={<ArrowDownToLine className="h-4 w-4 sm:h-5 sm:w-5" />} label="สต็อกเข้า" value={formatNumber(stats.stockIn.qty)} unit="ชิ้น" />
          <KpiCard icon={<ArrowUpFromLine className="h-4 w-4 sm:h-5 sm:w-5" />} label="สต็อกออก" value={formatNumber(stats.stockOut.qty)} unit="ชิ้น" />
          <KpiCard
            icon={<XCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="ยอดยกเลิก"
            value={formatTHB(stats.cancelled.baht, { compact: true })}
            unit={`· ${stats.cancelled.orders} ออเดอร์`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Trophy className="h-4 w-4 text-[var(--color-primary-container)]" />
              <CardTitle>สินค้าขายดี</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {top.length === 0 ? (
                <EmptyState title="ยังไม่มีข้อมูลยอดขายในช่วงเวลานี้" />
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>อันดับ</Th>
                      <Th>สินค้า</Th>
                      <Th>จำนวนขาย</Th>
                      <Th>ยอดขาย</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {top.map((t, idx) => (
                      <Tr key={t.product.id}>
                        <Td>{idx + 1}</Td>
                        <Td className="font-medium">{t.product.sellingName}</Td>
                        <Td>{formatNumber(t.qty)}</Td>
                        <Td className="font-semibold">{formatTHB(t.revenue)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ยอดขายตามช่องทาง</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {byChannel.length === 0 ? (
                <EmptyState title="ยังไม่มีข้อมูลยอดขายในช่วงเวลานี้" />
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>ช่องทาง</Th>
                      <Th>ออเดอร์</Th>
                      <Th>จำนวนชิ้น</Th>
                      <Th>ยอดขาย</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {byChannel.map((c) => (
                      <Tr key={c.channel}>
                        <Td className="font-medium">{SALES_CHANNEL_LABEL_TH[c.channel]}</Td>
                        <Td>{formatNumber(c.orders)}</Td>
                        <Td>{formatNumber(c.qty)}</Td>
                        <Td className="font-semibold">{formatTHB(c.revenue)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--color-danger)]" />
              <CardTitle>สินค้าใกล้หมด</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {lowStockProducts.length === 0 ? (
                <EmptyState title="ไม่มีสินค้าใกล้หมดในขณะนี้" />
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>สินค้า</Th>
                      <Th>คงเหลือ</Th>
                      <Th>จุดแจ้งเตือน</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {lowStockProducts.slice(0, 8).map(({ variant, stock }) => {
                      const product = state.products[variant.productId];
                      return (
                        <Tr key={variant.id}>
                          <Td className="font-medium">
                            {product?.sellingName} <span className="text-xs text-[var(--color-on-surface-variant)]">({variant.color}/{variant.size})</span>
                          </Td>
                          <Td className="font-semibold text-[var(--color-danger)]">{formatNumber(stock.onHand)}</Td>
                          <Td>{formatNumber(variant.reorderPoint)}</Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--color-danger)]" />
              <CardTitle>อุปกรณ์ใกล้หมด</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {lowStockEquip.length === 0 ? (
                <EmptyState title="ไม่มีอุปกรณ์ใกล้หมดในขณะนี้" />
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>อุปกรณ์</Th>
                      <Th>คงเหลือ</Th>
                      <Th>จุดแจ้งเตือน</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {lowStockEquip.slice(0, 8).map(({ equipment, stock }) => (
                      <Tr key={equipment.id}>
                        <Td className="font-medium">{equipmentLabel(equipment)}</Td>
                        <Td className="font-semibold text-[var(--color-danger)]">
                          {formatNumber(stock.onHand)} {equipment.unit}
                        </Td>
                        <Td>{formatNumber(equipment.reorderPoint)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {canExport && <SalesExcelExport />}

        {canViewCost && (
          <Card>
            <CardContent className="p-4 text-xs text-[var(--color-on-surface-variant)]">
              รายงานฉบับนี้ครอบคลุมข้อมูลช่วงเวลาที่เลือกด้านบน ({formatThaiDateTime(range.from)} — {formatThaiDateTime(range.to)})
            </CardContent>
          </Card>
        )}
        </RequireAccess>
      </PageContainer>
    </>
  );
}
