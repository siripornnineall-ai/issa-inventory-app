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
import { lowStockEquipment } from "@/lib/store/selectors";
import { formatNumber } from "@/lib/utils/money";
import { EQUIPMENT_TYPE_LABEL_TH } from "@/lib/types";

export default function EquipmentLowStockPage() {
  const state = useStore();
  const rows = lowStockEquipment(state).sort((a, b) => a.stock.onHand - b.stock.onHand);
  function typeLabel(code: string) {
    return state.equipmentTypeOptions[code]?.labelTh ?? EQUIPMENT_TYPE_LABEL_TH[code] ?? code;
  }

  return (
    <>
      <Header title="อุปกรณ์ใกล้หมด" description="รายการอุปกรณ์ที่คงเหลือต่ำกว่าหรือเท่ากับจุดแจ้งเตือน" />
      <PageContainer>
        <Card>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={<AlertTriangle className="h-10 w-10" />} title="ไม่มีอุปกรณ์ใกล้หมดในขณะนี้" />
              </div>
            ) : (
              <>
                {/* การ์ดสำหรับจอมือถือ */}
                <div className="divide-y divide-[var(--color-border)] sm:hidden">
                  {rows.map(({ equipment, stock }) => (
                    <div key={equipment.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <Link href={`/equipment/${equipment.id}`} className="block truncate text-sm font-medium hover:text-[var(--color-primary-container)]">
                          {equipment.name}
                        </Link>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                          {equipment.code} · {typeLabel(equipment.type)}
                        </p>
                        <p className="text-xs">
                          คงเหลือ <span className="font-semibold text-[var(--color-danger)]">{formatNumber(stock.onHand)} {equipment.unit}</span>{" "}
                          <span className="text-[var(--color-on-surface-variant)]">/ จุดแจ้งเตือน {formatNumber(equipment.reorderPoint)}</span>
                        </p>
                      </div>
                      <Link href="/equipment/stock-in" className="shrink-0">
                        <Button size="sm" variant="secondary">
                          <LogIn className="h-3.5 w-3.5" /> รับเข้า
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* ตารางสำหรับจอกว้าง */}
                <div className="hidden sm:block">
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>อุปกรณ์</Th>
                        <Th>ประเภท</Th>
                        <Th>คงเหลือ</Th>
                        <Th>จุดแจ้งเตือน</Th>
                        <Th>ควรสั่งเพิ่ม</Th>
                        <Th></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.map(({ equipment, stock }) => (
                        <Tr key={equipment.id}>
                          <Td className="font-medium">
                            <Link href={`/equipment/${equipment.id}`} className="hover:text-[var(--color-primary-container)]">
                              {equipment.name}
                            </Link>
                            <p className="text-xs font-normal text-[var(--color-on-surface-variant)]">{equipment.code}</p>
                          </Td>
                          <Td>{typeLabel(equipment.type)}</Td>
                          <Td className="font-semibold text-[var(--color-danger)]">
                            {formatNumber(stock.onHand)} {equipment.unit}
                          </Td>
                          <Td>{formatNumber(equipment.reorderPoint)}</Td>
                          <Td>{formatNumber(equipment.reorderQty)}</Td>
                          <Td>
                            <Link href="/equipment/stock-in">
                              <Button size="sm" variant="secondary">
                                <LogIn className="h-3.5 w-3.5" /> รับเข้า
                              </Button>
                            </Link>
                          </Td>
                        </Tr>
                      ))}
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
