"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { useStore } from "@/lib/store";
import { brandColor } from "@/lib/utils/brandColor";
import { SLOW_STOCK_RULES, groupSlowMovers, slowMovers, slowMoversByBrand, type SlowBrand, type SlowVariant } from "@/lib/store/selectors";
import { compareSizes } from "@/lib/utils/sizes";
import { formatNumber } from "@/lib/utils/money";

type DetailTab = "product" | "color" | "size" | "variant";
const TAB_LABEL: Record<DetailTab, string> = { product: "ตามรุ่น", color: "ตามสี", size: "ตามไซซ์", variant: "รายตัวเลือก" };

// สินค้าค้างสต็อก (ขายช้า) แยกกล่องตามแบรนด์ ใช้ชื่อแบรนด์เป็นหัวกล่อง กด "ดูทั้งหมด" เพื่อดูแยกตามรุ่น/สี/ไซซ์
export function SlowStockCards() {
  const state = useStore();
  const [open, setOpen] = useState<SlowBrand | null>(null);

  const slow = useMemo(() => slowMovers(state), [state]);
  const brands = useMemo(() => slowMoversByBrand(state, slow), [state, slow]);
  const r = SLOW_STOCK_RULES;

  return (
    <section aria-label="สินค้าค้างสต็อก">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-[var(--color-on-surface)] sm:text-xl">สินค้าค้างสต็อก (ขายช้า)</h2>
        <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
          มีของตั้งแต่ {r.minStock} ชิ้น ขายได้ไม่เกิน {r.maxSold} ชิ้นใน {r.windowDays} วันล่าสุด และรับเข้ามาเกิน {r.graceDays} วันแล้ว (รับเข้า/รับคืนเพิ่มเมื่อไหร่ นับ {r.graceDays} วันใหม่)
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {brands.map((b) => (
          <BrandBox key={b.brandId ?? "none"} brand={b} items={slow.filter((s) => s.brandId === b.brandId)} onOpen={() => setOpen(b)} />
        ))}
      </div>
      {open && <SlowStockDialog brand={open} items={slow.filter((s) => s.brandId === open.brandId)} onClose={() => setOpen(null)} />}
    </section>
  );
}

function BrandBox({ brand, items, onOpen }: { brand: SlowBrand; items: SlowVariant[]; onOpen: () => void }) {
  const state = useStore();
  const top = useMemo(() => groupSlowMovers(state, items, "product").slice(0, 4), [state, items]);
  return (
    <Card style={brand.brandId ? { borderTop: `4px solid ${brandColor(state.brands[brand.brandId])}` } : undefined}>
      <CardHeader>
        <CardTitle>{brand.name}</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          {brand.variants === 0 ? (
            "ไม่มีสินค้าค้างสต็อก"
          ) : (
            <>
              <span className="font-semibold text-[var(--color-danger)]">ค้าง {formatNumber(brand.pieces)} ชิ้น</span> · {formatNumber(brand.variants)} ตัวเลือก
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {top.map((g) => (
          <div key={g.key} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-on-surface)]">{g.label}</p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {formatNumber(g.variants)} ตัวเลือก · <span className="font-medium text-[var(--color-danger)]">ค้าง {formatNumber(g.pieces)} ชิ้น</span>
              </p>
            </div>
            <Badge tone="danger">ค้าง</Badge>
          </div>
        ))}
        {brand.variants > 0 && (
          <button type="button" onClick={onOpen} className="w-fit text-left text-sm font-medium text-[var(--color-primary-container)] hover:underline">
            ดูสินค้าค้างทั้งหมด →
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function SlowStockDialog({ brand, items, onClose }: { brand: SlowBrand; items: SlowVariant[]; onClose: () => void }) {
  const state = useStore();
  const [tab, setTab] = useState<DetailTab>("product");

  const groups = useMemo(() => (tab === "variant" ? [] : groupSlowMovers(state, items, tab)), [state, items, tab]);
  const bySize = tab === "size" ? [...groups].sort((a, b) => compareSizes(a.label, b.label)) : groups;
  const variants = useMemo(() => [...items].sort((a, b) => b.qty - a.qty), [items]);

  return (
    <Dialog open onClose={onClose} title={`สินค้าค้างสต็อก — ${brand.name}`} description={`ค้าง ${formatNumber(brand.pieces)} ชิ้น · ${formatNumber(brand.variants)} ตัวเลือก (ยอดขายนับ ${SLOW_STOCK_RULES.windowDays} วันล่าสุด)`} size="xl">
      <div className="flex flex-col gap-4">
        <Tabs tabs={(Object.keys(TAB_LABEL) as DetailTab[]).map((id) => ({ id, label: TAB_LABEL[id] }))} active={tab} onChange={(id) => setTab(id as DetailTab)} />
        {items.length === 0 ? (
          <EmptyState title="ไม่มีสินค้าค้างสต็อก" />
        ) : tab === "variant" ? (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>รุ่น</Th>
                  <Th>สี / ไซซ์</Th>
                  <Th>คงเหลือ</Th>
                  <Th>ขาย {SLOW_STOCK_RULES.windowDays} วัน</Th>
                  <Th>รับเข้าล่าสุด</Th>
                </Tr>
              </Thead>
              <Tbody>
                {variants.map((v) => (
                  <Tr key={v.variantId}>
                    <Td>{state.products[v.productId]?.sellingName ?? "-"}</Td>
                    <Td>
                      {v.color} / {v.size}
                    </Td>
                    <Td className="font-semibold">{formatNumber(v.qty)}</Td>
                    <Td>{formatNumber(v.sold)}</Td>
                    <Td className="text-xs text-[var(--color-on-surface-variant)]">{v.daysSinceReceived} วันที่แล้ว</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>{tab === "product" ? "รุ่น" : tab === "color" ? "สี" : "ไซซ์"}</Th>
                  <Th>ตัวเลือกที่ค้าง</Th>
                  <Th>ชิ้นที่ค้าง</Th>
                  <Th>ขาย {SLOW_STOCK_RULES.windowDays} วัน</Th>
                </Tr>
              </Thead>
              <Tbody>
                {bySize.map((g) => (
                  <Tr key={g.key}>
                    <Td className="font-medium">{g.label}</Td>
                    <Td>{formatNumber(g.variants)}</Td>
                    <Td className="font-semibold">{formatNumber(g.pieces)}</Td>
                    <Td>{formatNumber(g.sold)}</Td>
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
