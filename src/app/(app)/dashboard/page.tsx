"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ClipboardList,
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
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
import { SlowStockCards } from "@/components/dashboard/SlowStockCards";
import { useStore } from "@/lib/store";
import {
  dailySeries,
  dashboardStats,
  dashboardStatsByBrand,
  returnStats,
  equipmentOverview,
  lowStockVariants,
  recentMovements,
} from "@/lib/store/selectors";
import { formatNumber } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { MOVEMENT_TYPE_LABEL_TH, STOCK_RETURN_LABEL_TH, STOCK_RETURN_TYPES, type StockReturnType } from "@/lib/types";

export default function DashboardPage() {
  const state = useStore();
  const { value: range, setValue: setRange } = useDateRange("30d");
  const [drill, setDrill] = useState<{ kind: DrillKind; brandId?: string | null; returnType?: StockReturnType } | null>(null);

  const stats = useMemo(() => dashboardStats(state, range.from, range.to), [state, range]);
  const returns = useMemo(() => returnStats(state, range.from, range.to), [state, range]);
  const byBrand = useMemo(() => dashboardStatsByBrand(state, range.from, range.to), [state, range]);
  const kpiGroups = useMemo(
    () => [
      {
        kind: "currentQty" as const,
        title: "จำนวนปัจจุบัน",
        icon: <ClipboardList className="h-4 w-4" />,
        total: { qty: stats.currentQty, unit: "ชิ้น" },
        brands: byBrand.map((b) => ({ brandId: b.brandId, name: b.name, qty: b.currentQty, unit: "ชิ้น" })),
      },
      {
        kind: "stockIn" as const,
        title: "สต็อกเข้า",
        icon: <ArrowDownToLine className="h-4 w-4" />,
        total: { qty: stats.stockIn.qty, unit: `ชิ้น · ${stats.stockIn.docs} รายการ` },
        brands: byBrand.map((b) => ({ brandId: b.brandId, name: b.name, qty: b.stockIn.qty, unit: `ชิ้น · ${b.stockIn.docs} รายการ` })),
      },
      {
        kind: "stockOut" as const,
        title: "สต็อกออก",
        icon: <ArrowUpFromLine className="h-4 w-4" />,
        total: { qty: stats.stockOut.qty, unit: `ชิ้น · ${stats.stockOut.docs} รายการ` },
        brands: byBrand.map((b) => ({ brandId: b.brandId, name: b.name, qty: b.stockOut.qty, unit: `ชิ้น · ${b.stockOut.docs} รายการ` })),
      },
    ],
    [stats, byBrand]
  );
  const series = useMemo(() => dailySeries(state, range.from, range.to), [state, range]);
  const lowStock = useMemo(() => lowStockVariants(state).slice(0, 4), [state]);
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
        {/* ตัวเลขรวมทุกแบรนด์อยู่การ์ดแรกของแต่ละกลุ่ม ตามด้วยของแต่ละแบรนด์ กดการ์ดเพื่อดูรายละเอียด */}
        <div className="flex flex-col gap-5">
          {kpiGroups.map((g) => (
            <section key={g.kind} aria-label={g.title}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-surface-container)] text-[var(--color-primary-container)]">{g.icon}</span>
                {g.title}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <KpiCard label="รวมทุกแบรนด์" value={formatNumber(g.total.qty)} unit={g.total.unit} onClick={() => setDrill({ kind: g.kind })} />
                {g.brands.map((b) => (
                  <KpiCard
                    key={b.brandId ?? "none"}
                    label={b.name}
                    value={formatNumber(b.qty)}
                    unit={b.unit}
                    onClick={() => setDrill({ kind: g.kind, brandId: b.brandId })}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* สต็อกคืนสินค้า: รวมทุกประเภทก่อน ตามด้วย ตีกลับ / คืน / ตำหนิ / เปลี่ยน (แยกจากสต็อกเข้า) */}
          <section aria-label="สต็อกคืนสินค้า">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-surface-container)] text-[var(--color-primary-container)]">
                <Undo2 className="h-4 w-4" />
              </span>
              สต็อกคืนสินค้า
            </h2>
            {returns.ratePct !== null && (
              <p className="-mt-1 mb-2 text-xs text-[var(--color-on-surface-variant)]">
                รวมคืน {formatNumber(returns.total.qty)} ชิ้น คิดเป็น {returns.ratePct}% ของยอดขาย ({formatNumber(returns.salesQty)} ชิ้น)
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
              <KpiCard
                label="รวมทุกประเภท"
                value={formatNumber(returns.total.qty)}
                unit={`ชิ้น · ${returns.total.docs} รายการ`}
                onClick={() => setDrill({ kind: "stockReturn" })}
              />
              {STOCK_RETURN_TYPES.map((t) => (
                <KpiCard
                  key={t}
                  label={STOCK_RETURN_LABEL_TH[t]}
                  value={formatNumber(returns.byType[t].qty)}
                  unit={`ชิ้น · ${returns.byType[t].docs} รายการ`}
                  onClick={() => setDrill({ kind: "stockReturn", returnType: t })}
                />
              ))}
            </div>
          </section>
        </div>

        <SlowStockCards />

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
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sales" fill="var(--color-primary-container)" radius={[4, 4, 0, 0]} name="ยอดขาย" />
                    <Bar dataKey="stockIn" fill="#a0ced7" radius={[4, 4, 0, 0]} name="สต็อกเข้า" />
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

        <div className="grid grid-cols-1 gap-4">
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
                      <Wrench className="h-4 w-4 text-white/60" /> {equipmentLabel(e)}
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

      {drill && <DrillDownDialog open onClose={() => setDrill(null)} kind={drill.kind} brandId={drill.brandId} returnType={drill.returnType} range={range} />}
    </>
  );
}
