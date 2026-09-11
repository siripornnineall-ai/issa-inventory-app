"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ClipboardList,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  XCircle,
  PackagePlus,
  LogIn,
  LogOut,
  Wrench,
  Boxes,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, KpiCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { Badge } from "@/components/ui/Badge";
import { DrillDownDialog, type DrillKind } from "@/components/dashboard/DrillDownDialog";
import { useStore } from "@/lib/store";
import {
  bestSellers,
  dailySeries,
  dashboardStats,
  equipmentOverview,
  lowStockVariants,
  recentMovements,
} from "@/lib/store/selectors";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { MOVEMENT_TYPE_LABEL_TH } from "@/lib/types";

export default function DashboardPage() {
  const state = useStore();
  const { value: range, setValue: setRange } = useDateRange("30d");
  const [drillKind, setDrillKind] = useState<DrillKind | null>(null);

  const stats = useMemo(() => dashboardStats(state, range.from, range.to), [state, range]);
  const series = useMemo(() => dailySeries(state, range.from, range.to), [state, range]);
  const lowStock = useMemo(() => lowStockVariants(state).slice(0, 4), [state]);
  const top = useMemo(() => bestSellers(state, range.from, range.to, 3), [state, range]);
  const recent = useMemo(() => recentMovements(state, 5), [state]);
  const equipOverview = useMemo(() => equipmentOverview(state, range.from, range.to), [state, range]);
  const lowStockEquipmentList = useMemo(
    () =>
      Object.values(state.equipment)
        .map((e) => ({ e, onHand: Object.values(state.equipmentStock).filter((s) => s.itemId === e.id).reduce((sum, s) => sum + s.qtyOnHand, 0) }))
        .filter((x) => x.onHand <= x.e.reorderPoint)
        .slice(0, 3),
    [state]
  );

  return (
    <>
      <Header
        title="แดชบอร์ด"
        description="ภาพรวมสินค้า ยอดขาย และการเคลื่อนไหวของสต็อก"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <PageContainer>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          <KpiCard
            icon={<ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="จำนวนปัจจุบัน"
            value={formatNumber(stats.currentQty)}
            unit="ชิ้น"
            onClick={() => setDrillKind("currentQty")}
          />
          <KpiCard
            icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="ยอดขาย"
            value={formatTHB(stats.sales.baht, { compact: true })}
            unit={`· ${formatNumber(stats.sales.qty)} ชิ้น · ${formatNumber(stats.sales.orders)} ออเดอร์`}
            onClick={() => setDrillKind("sales")}
          />
          <KpiCard
            icon={<ArrowDownToLine className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="สต็อกเข้า"
            value={formatNumber(stats.stockIn.qty)}
            unit={`ชิ้น · ${stats.stockIn.docs} รายการ`}
            onClick={() => setDrillKind("stockIn")}
          />
          <KpiCard
            icon={<ArrowUpFromLine className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="สต็อกออก"
            value={formatNumber(stats.stockOut.qty)}
            unit={`ชิ้น · ${stats.stockOut.docs} รายการ`}
            onClick={() => setDrillKind("stockOut")}
          />
          <KpiCard
            icon={<XCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
            label="ยอดยกเลิก"
            value={formatTHB(stats.cancelled.baht, { compact: true })}
            unit={`· ${stats.cancelled.orders} ออเดอร์`}
            onClick={() => setDrillKind("cancelled")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>ภาพรวมการเคลื่อนไหว</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">เปรียบเทียบยอดขายและการโหลดเข้าของสินค้า</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-on-surface-variant)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--color-on-surface-variant)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "sales" ? "ยอดขาย" : "สต็อกเข้า")} />
                    <Bar dataKey="sales" fill="var(--color-primary-container)" radius={[4, 4, 0, 0]} name="sales" />
                    <Bar dataKey="stockIn" fill="#a0ced7" radius={[4, 4, 0, 0]} name="stockIn" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>สินค้าที่ต้องจัดการ</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">โมเดลที่มีจำนวนสต็อกเหลือน้อย</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {lowStock.length === 0 && <p className="text-sm text-[var(--color-on-surface-variant)]">ไม่มีสินค้าใกล้หมดในขณะนี้</p>}
              {lowStock.map(({ variant, stock }) => {
                const product = state.products[variant.productId];
                return (
                  <div key={variant.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-on-surface)]">{product?.sellingName}</p>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">
                        {variant.color} / {variant.size} · คงเหลือ {stock.onHand}
                      </p>
                    </div>
                    <Badge tone="danger">ใกล้หมด</Badge>
                  </div>
                );
              })}
              <Link href="/low-stock" className="text-sm font-medium text-[var(--color-primary-container)] hover:underline">
                ดูสินค้าใกล้หมดทั้งหมด →
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>สินค้าขายดี</CardTitle>
              <Link href="/reports" className="text-sm font-medium text-[var(--color-primary-container)] hover:underline">
                ดูทั้งหมด
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {top.length === 0 && <p className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่มีข้อมูลยอดขายในช่วงเวลานี้</p>}
              {top.map((t, idx) => (
                <div key={t.product.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-container)] text-sm font-semibold text-[var(--color-primary-container)]">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-on-surface)]">{t.product.sellingName}</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]">ขายได้ {formatNumber(t.qty)} ชิ้น</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-on-surface)]">{formatTHB(t.revenue)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>การเคลื่อนไหวล่าสุด</CardTitle>
              <Link href="/history" className="text-sm font-medium text-[var(--color-primary-container)] hover:underline">
                ดูประวัติทั้งหมด
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {recent.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-on-surface)]">{m.itemName}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge tone={m.qtyChange > 0 ? "success" : "warning"}>{MOVEMENT_TYPE_LABEL_TH[m.movementType]}</Badge>
                      <span className="text-xs text-[var(--color-on-surface-variant)]">{m.qtyChange > 0 ? "+" : ""}{m.qtyChange} ชิ้น</span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(m.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[var(--color-primary)] text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">ภาพรวมสต็อกอุปกรณ์</h3>
              <p className="mt-1 text-sm text-white/60">ตรวจสอบอุปกรณ์ที่ใช้ในการแพ็กสินค้า ซ่อมสินค้า และใช้งานภายในบริษัท</p>
            </div>
            <Link href="/equipment">
              <Button variant="secondary" size="sm">
                จัดการอุปกรณ์ทั้งหมด
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-0 md:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs text-white/60">อุปกรณ์คงเหลือ</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(equipOverview.onHand)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs text-white/60">รับอุปกรณ์เข้า</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(equipOverview.stockIn)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs text-white/60">เบิกอุปกรณ์ออก</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(equipOverview.stockOut)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs text-white/60">อุปกรณ์ใกล้หมด</p>
              <p className="mt-1 text-2xl font-semibold text-[#ffb4a9]">{equipOverview.lowStockCount} รายการ</p>
            </div>
          </CardContent>
          {lowStockEquipmentList.length > 0 && (
            <CardContent className="pt-0">
              <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3">
                {lowStockEquipmentList.map(({ e, onHand }) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-white/60" /> {e.name}
                    </span>
                    <span className="text-white/70">
                      คงเหลือ {onHand} {e.unit}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link href="/products/new">
            <Button>
              <PackagePlus className="h-4 w-4" /> เพิ่มสินค้าใหม่
            </Button>
          </Link>
          <Link href="/stock-in">
            <Button variant="secondary">
              <LogIn className="h-4 w-4" /> รับสินค้าเข้า
            </Button>
          </Link>
          <Link href="/stock-out">
            <Button variant="secondary">
              <LogOut className="h-4 w-4" /> เบิกสินค้าออก
            </Button>
          </Link>
          <Link href="/equipment/new">
            <Button variant="ghost">
              <Boxes className="h-4 w-4" /> เพิ่มอุปกรณ์ใหม่
            </Button>
          </Link>
        </div>
      </PageContainer>

      {drillKind && <DrillDownDialog open onClose={() => setDrillKind(null)} kind={drillKind} range={range} />}
    </>
  );
}
