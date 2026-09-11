"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Eye, Printer } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { useStore } from "@/lib/store";
import { purchaseOrdersInRange, stockInDocTotal } from "@/lib/store/selectors";
import { formatTHB } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";

const PAGE_SIZE = 15;

export default function PurchaseOrdersPage() {
  const state = useStore();
  const { value: range, setValue: setRange } = useDateRange("30d");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const docs = useMemo(() => purchaseOrdersInRange(state, range.from, range.to), [state, range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs
      .filter((d) => !q || d.poNumber?.toLowerCase().includes(q) || d.docNo.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [docs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPagedSelected = paged.length > 0 && paged.every((d) => selected.has(d.id));

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
      if (allPagedSelected) {
        for (const d of paged) next.delete(d.id);
      } else {
        for (const d of paged) next.add(d.id);
      }
      return next;
    });
  }

  return (
    <>
      <Header
        title="ใบสั่งซื้อ (PO)"
        description="ประวัติใบสั่งซื้อที่ระบบออกให้อัตโนมัติ ย้อนหลังตามช่วงวันที่/เดือน"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาเลขที่ PO..."
              className="pl-9"
            />
          </div>
          {selected.size > 0 && (
            <Link href={`/purchase-orders/print?ids=${Array.from(selected).join(",")}`} target="_blank">
              <Button>
                <Printer className="h-4 w-4" /> พิมพ์ที่เลือก ({selected.size})
              </Button>
            </Link>
          )}
        </div>

        <Card>
          {paged.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<FileText className="h-10 w-10" />} title="ไม่พบใบสั่งซื้อในช่วงเวลานี้" description="ติ๊ก 'ออกใบสั่งซื้อ (PO) อัตโนมัติ' ตอนรับสินค้าเข้า เพื่อให้ระบบสร้างใบ PO" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {paged.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} className="mt-1 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.poNumber}</p>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDate(d.date)}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                          {d.supplierId ? state.suppliers[d.supplierId]?.name ?? "-" : "-"} · {state.warehouses[d.warehouseId]?.name ?? "-"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatTHB(stockInDocTotal(d))}</p>
                      <Link href={`/stock-in/${d.id}/po`} target="_blank">
                        <Button size="sm" variant="ghost" className="mt-1">
                          <Eye className="h-3.5 w-3.5" /> ดู/พิมพ์
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>
                        <input type="checkbox" checked={allPagedSelected} onChange={toggleAllOnPage} className="h-4 w-4" />
                      </Th>
                      <Th>เลขที่ PO</Th>
                      <Th>วันที่</Th>
                      <Th>ผู้ผลิต / ซัพพลายเออร์</Th>
                      <Th>คลังปลายทาง</Th>
                      <Th>มูลค่ารวม</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map((d) => (
                      <Tr key={d.id}>
                        <Td>
                          <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} className="h-4 w-4" />
                        </Td>
                        <Td className="font-medium">{d.poNumber}</Td>
                        <Td className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDate(d.date)}</Td>
                        <Td>{d.supplierId ? state.suppliers[d.supplierId]?.name ?? "-" : "-"}</Td>
                        <Td>{state.warehouses[d.warehouseId]?.name ?? "-"}</Td>
                        <Td className="font-semibold">{formatTHB(stockInDocTotal(d))}</Td>
                        <Td>
                          <Link href={`/stock-in/${d.id}/po`} target="_blank">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-3.5 w-3.5" /> ดู/พิมพ์
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
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </Card>
      </PageContainer>
    </>
  );
}
