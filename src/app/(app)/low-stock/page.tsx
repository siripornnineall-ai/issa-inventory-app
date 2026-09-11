"use client";

import Link from "next/link";
import { AlertTriangle, LogIn } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { lowStockVariants } from "@/lib/store/selectors";
import { formatNumber } from "@/lib/utils/money";

export default function LowStockPage() {
  const state = useStore();
  const rows = lowStockVariants(state).sort((a, b) => a.stock.onHand - b.stock.onHand);

  return (
    <>
      <Header title="สินค้าใกล้หมด" description="รายการตัวเลือกสินค้าที่คงเหลือต่ำกว่าหรือเท่ากับจุดแจ้งเตือน" />
      <PageContainer>
        <Card>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={<AlertTriangle className="h-10 w-10" />} title="ไม่มีสินค้าใกล้หมดในขณะนี้" />
              </div>
            ) : (
              <>
                {/* การ์ดสำหรับจอมือถือ */}
                <div className="divide-y divide-[var(--color-border)] sm:hidden">
                  {rows.map(({ variant, stock }) => {
                    const product = state.products[variant.productId];
                    return (
                      <div key={variant.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <Link href={`/products/${variant.productId}`} className="block truncate text-sm font-medium hover:text-[var(--color-primary-container)]">
                            {product?.sellingName ?? "-"}
                          </Link>
                          <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                            {variant.color} / {variant.size} · {variant.sku}
                          </p>
                          <p className="text-xs">
                            คงเหลือ <span className="font-semibold text-[var(--color-danger)]">{formatNumber(stock.onHand)}</span>{" "}
                            <span className="text-[var(--color-on-surface-variant)]">/ จุดแจ้งเตือน {formatNumber(variant.reorderPoint)}</span>
                          </p>
                        </div>
                        <Link href="/stock-in" className="shrink-0">
                          <Button size="sm" variant="secondary">
                            <LogIn className="h-3.5 w-3.5" /> รับเข้า
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {/* ตารางสำหรับจอกว้าง */}
                <div className="hidden sm:block">
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>สินค้า</Th>
                        <Th>สี / ไซซ์</Th>
                        <Th>SKU</Th>
                        <Th>คงเหลือ</Th>
                        <Th>จุดแจ้งเตือน</Th>
                        <Th></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.map(({ variant, stock }) => {
                        const product = state.products[variant.productId];
                        return (
                          <Tr key={variant.id}>
                            <Td className="font-medium">
                              <Link href={`/products/${variant.productId}`} className="hover:text-[var(--color-primary-container)]">
                                {product?.sellingName ?? "-"}
                              </Link>
                            </Td>
                            <Td>
                              {variant.color} / {variant.size}
                            </Td>
                            <Td className="font-mono text-xs">{variant.sku}</Td>
                            <Td className="font-semibold text-[var(--color-danger)]">{formatNumber(stock.onHand)}</Td>
                            <Td>{formatNumber(variant.reorderPoint)}</Td>
                            <Td>
                              <Link href="/stock-in">
                                <Button size="sm" variant="secondary">
                                  <LogIn className="h-3.5 w-3.5" /> รับเข้า
                                </Button>
                              </Link>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
