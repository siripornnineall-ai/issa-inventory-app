"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Download, History as HistoryIcon, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { MovementTypeBadge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { Dialog } from "@/components/ui/Dialog";
import { useStore, useActions } from "@/lib/store";
import { movementsInRange } from "@/lib/store/selectors";
import { formatNumber } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { HISTORY_TAB_LABEL, isVerificationOnly, movementDirection, movementTypesForTab, summarizeMovements, type HistoryTab } from "@/lib/utils/movementTabs";
import { useCan } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { MOVEMENT_TYPE_LABEL_TH, STOCK_RETURN_LABEL_TH, STOCK_RETURN_TYPES, type MovementItemType, type MovementType, type StockMovement } from "@/lib/types";

const PAGE_SIZE = 20;

function qtyClass(qty: number) {
  return qty > 0 ? "text-[var(--color-success)]" : qty < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-on-surface-variant)]";
}

function qtyText(qty: number) {
  return `${qty > 0 ? "+" : ""}${formatNumber(qty)}`;
}

export default function HistoryPage() {
  const state = useStore();
  const { addEditedNote } = useActions();
  const canEditNote = useCan("settings.write");

  const { value: range, setValue: setRange } = useDateRange("30d");
  const [tab, setTab] = useState<HistoryTab>("all");
  const [search, setSearch] = useState("");
  const [itemType, setItemType] = useState<MovementItemType | "all">("all");
  const [movementType, setMovementType] = useState<MovementType | "all">("all");
  const [warehouseId, setWarehouseId] = useState("all");
  // นับสต็อกที่ตรงกับระบบถูกบันทึกเป็นปรับยอด 0 ชิ้น (ยืนยันยอด) ซ่อนไว้ก่อน ไม่ให้กลบรายการเข้า/ออกที่สำคัญกว่า
  const [showVerified, setShowVerified] = useState(false);
  const [page, setPage] = useState(1);
  const [noteMovementId, setNoteMovementId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const movements = useMemo(() => movementsInRange(state, range.from, range.to), [state, range]);

  // ตัวกรองทั่วไป (ยังไม่แยกแท็บ) ใช้นับจำนวนบนแท็บแต่ละอัน
  const pre = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements
      .filter((m) => itemType === "all" || m.itemType === itemType)
      .filter((m) => warehouseId === "all" || m.warehouseFromId === warehouseId || m.warehouseToId === warehouseId)
      .filter((m) => !q || m.itemName.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.refNo.toLowerCase().includes(q))
      .filter((m) => showVerified || !isVerificationOnly(m));
  }, [movements, search, itemType, warehouseId, showVerified]);

  const tabCounts = useMemo(() => {
    const counts: Record<HistoryTab, number> = { all: pre.length, in: 0, out: 0, adjust: 0, return: 0, convert: 0 };
    for (const m of pre) counts[movementDirection(m)] += 1;
    return counts;
  }, [pre]);

  // รายการในแท็บนี้ (รวมรายการยืนยันยอดเสมอ ใช้สรุปยอด) แล้วค่อยกรองประเภทการเคลื่อนไหว
  const tabbedAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements
      .filter((m) => itemType === "all" || m.itemType === itemType)
      .filter((m) => warehouseId === "all" || m.warehouseFromId === warehouseId || m.warehouseToId === warehouseId)
      .filter((m) => !q || m.itemName.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.refNo.toLowerCase().includes(q))
      .filter((m) => tab === "all" || movementDirection(m) === tab)
      .filter((m) => movementType === "all" || m.movementType === movementType);
  }, [movements, search, itemType, warehouseId, tab, movementType]);

  const filtered = useMemo(
    () => tabbedAll.filter((m) => showVerified || !isVerificationOnly(m)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tabbedAll, showVerified]
  );
  const totals = useMemo(() => summarizeMovements(tabbedAll), [tabbedAll]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const typeOptions = movementTypesForTab(tab) ?? (Object.keys(MOVEMENT_TYPE_LABEL_TH) as MovementType[]);

  function changeTab(next: HistoryTab) {
    setTab(next);
    setMovementType("all");
    setPage(1);
  }

  function exportExcel() {
    // ส่งออกเฉพาะประวัติคำสั่งซื้อที่ขายออก (movementType === "sale") เท่านั้น
    // ไม่รวมรับเข้า/โอนย้าย/ปรับยอด/สาเหตุอื่น ๆ แม้ว่าหน้าจอจะกรองแบบอื่นอยู่ก็ตาม
    const saleRows = filtered.filter((m) => m.movementType === "sale");
    if (saleRows.length === 0) {
      toastError("ไม่พบประวัติคำสั่งซื้อที่ขายออกในช่วงเวลา/ตัวกรองที่เลือก");
      return;
    }
    const rows = saleRows.map((m) => ({
      "วันที่": formatThaiDateTime(m.createdAt),
      "เลขที่เอกสาร": m.refNo,
      "รายการ": m.itemName,
      "SKU/รหัส": m.sku,
      "สี": m.color ?? "",
      "ไซซ์": m.size ?? "",
      "จำนวนที่ขาย": Math.abs(m.qtyChange),
      "คงเหลือก่อน": m.qtyBefore,
      "คงเหลือหลัง": m.qtyAfter,
      "ผู้ทำรายการ": m.actorName,
      "หมายเหตุ": m.note ?? "",
      "หมายเหตุแก้ไข": m.editedNote ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ประวัติคำสั่งซื้อที่ขายออก");
    XLSX.writeFile(wb, `ประวัติคำสั่งซื้อที่ขายออก-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function openNoteDialog(movementId: string, currentNote: string) {
    setNoteMovementId(movementId);
    setNoteDraft(currentNote);
  }

  function saveNote() {
    if (!noteMovementId) return;
    try {
      addEditedNote(noteMovementId, noteDraft);
      toastSuccess("บันทึกหมายเหตุแก้ไขเรียบร้อยแล้ว");
      setNoteMovementId(null);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  // หัวคอลัมน์ "ประเภท" และ "จำนวน" ปรับตามแท็บ
  const typeHeader = tab === "out" ? "เหตุผลที่ออก" : tab === "adjust" ? "ที่มา" : tab === "return" ? "ประเภทที่คืน" : "ประเภท";
  const qtyHeader = tab === "in" ? "จำนวนเข้า" : tab === "out" ? "จำนวนออก" : tab === "adjust" ? "ผลต่าง" : tab === "return" ? "จำนวนรับคืน" : "จำนวน";

  function typeCell(m: StockMovement) {
    if (tab === "adjust" && m.reason) return <span className="text-xs">{m.reason}</span>;
    if (tab === "return") {
      // reason ของใบรับคืนเป็น "ประเภท · ช่องทาง" (ช่องทางอาจไม่มี)
      const channel = m.reason?.split(" · ")[1];
      return (
        <div className="flex flex-col items-start gap-1">
          <MovementTypeBadge type={m.movementType} />
          {channel && <span className="text-xs text-[var(--color-on-surface-variant)]">{channel}</span>}
        </div>
      );
    }
    return <MovementTypeBadge type={m.movementType} />;
  }

  function summaryText(): string {
    const parts: string[] = [];
    if (tab === "all") {
      parts.push(`เข้า ${formatNumber(totals.inQty)} ชิ้น (${totals.inCount} รายการ)`);
      parts.push(`ออก ${formatNumber(totals.outQty)} ชิ้น (${totals.outCount} รายการ)`);
      parts.push(`รับคืน ${formatNumber(totals.returnQty)} ชิ้น (${totals.returnCount} รายการ)`);
      parts.push(`ปรับยอด +${formatNumber(totals.adjustUp)} / -${formatNumber(totals.adjustDown)} (${totals.adjustCount} รายการ)`);
    } else if (tab === "convert") {
      parts.push(`แปลงรุ่น (ตัดตัวเปล่าไปเย็บตามออเดอร์) ${formatNumber(totals.convertQty)} ชิ้น จาก ${totals.convertCount} รายการ`);
    } else if (tab === "return") {
      parts.push(`รวมรับคืน ${formatNumber(totals.returnQty)} ชิ้น จาก ${totals.returnCount} รายการ`);
      for (const t of STOCK_RETURN_TYPES) {
        const qty = tabbedAll.filter((m) => m.movementType === t).reduce((s, m) => s + m.qtyChange, 0);
        parts.push(`${STOCK_RETURN_LABEL_TH[t]} ${formatNumber(qty)}`);
      }
    } else if (tab === "in") {
      parts.push(`รวมเข้า ${formatNumber(totals.inQty)} ชิ้น จาก ${totals.inCount} รายการ`);
    } else if (tab === "out") {
      parts.push(`รวมออก ${formatNumber(totals.outQty)} ชิ้น จาก ${totals.outCount} รายการ`);
    } else {
      parts.push(`ปรับขึ้น +${formatNumber(totals.adjustUp)} · ปรับลง -${formatNumber(totals.adjustDown)} (${totals.adjustCount} รายการที่ยอดเปลี่ยน)`);
      parts.push(`นับแล้วตรงกับระบบ ${totals.verifiedCount} รายการ`);
    }
    return parts.join(" · ");
  }

  return (
    <>
      <Header
        title="ประวัติการเคลื่อนไหว"
        description="ตรวจสอบย้อนหลังการรับเข้า เบิกออก โอนย้าย และปรับยอดสต็อกทั้งหมด"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <PageContainer>
        <Tabs
          tabs={(Object.keys(HISTORY_TAB_LABEL) as HistoryTab[]).map((id) => ({ id, label: `${HISTORY_TAB_LABEL[id]} (${formatNumber(tabCounts[id])})` }))}
          active={tab}
          onChange={(id) => changeTab(id as HistoryTab)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาชื่อสินค้า, SKU หรือเลขที่เอกสาร..."
              className="w-80 pl-9"
            />
          </div>
          <Button variant="ghost" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel (เฉพาะรายการขาย)
          </Button>
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
            <SlidersHorizontal className="h-4 w-4" /> ตัวกรองละเอียด
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Select
              value={itemType}
              onChange={(e) => {
                setItemType(e.target.value as MovementItemType | "all");
                setPage(1);
              }}
            >
              <option value="all">ประเภทสินค้าทั้งหมด</option>
              <option value="product">สินค้า</option>
              <option value="equipment">อุปกรณ์</option>
            </Select>
            <Select
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value as MovementType | "all");
                setPage(1);
              }}
              aria-label="ประเภทการเคลื่อนไหว"
            >
              <option value="all">{tab === "all" ? "การเคลื่อนไหวทั้งหมด" : `ทุกประเภทของ${HISTORY_TAB_LABEL[tab]}`}</option>
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {MOVEMENT_TYPE_LABEL_TH[value]}
                </option>
              ))}
            </Select>
            <Select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">คลังทั้งหมด</option>
              {Object.values(state.warehouses).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            {(tab === "all" || tab === "adjust") && (
              <label htmlFor="hist-verified" className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  id="hist-verified"
                  type="checkbox"
                  checked={showVerified}
                  onChange={(e) => {
                    setShowVerified(e.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4"
                />
                แสดงรายการยืนยันยอด (นับแล้วตรงกับระบบ เปลี่ยน 0 ชิ้น)
              </label>
            )}
          </div>
        </Card>

        <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
          <span className="font-semibold text-[var(--color-on-surface)]">ช่วงที่เลือก:</span> {summaryText()}
        </p>

        <Card>
          {paged.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<HistoryIcon className="h-10 w-10" />} title="ไม่พบประวัติการเคลื่อนไหวที่ตรงกับเงื่อนไข" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {paged.map((m) => (
                  <div key={m.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.itemName}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                          {m.color && m.size ? `${m.color} / ${m.size} · ` : ""}
                          {m.sku}
                        </p>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(m.createdAt)} · {m.refNo}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <MovementTypeBadge type={m.movementType} />
                        <p className={`mt-1 text-sm font-semibold ${qtyClass(m.qtyChange)}`}>{qtyText(m.qtyChange)}</p>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">
                          {tab === "adjust" ? `${formatNumber(m.qtyBefore)} → ${formatNumber(m.qtyAfter)}` : `คงเหลือ ${formatNumber(m.qtyAfter)}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-start justify-between gap-2 text-xs text-[var(--color-on-surface-variant)]">
                      <div>
                        <p>โดย {m.actorName}</p>
                        {tab === "adjust" && m.reason && <p>{m.reason}</p>}
                        {m.note && <p>{m.note}</p>}
                        {m.editedNote && <p className="italic text-[var(--color-warning)]">แก้ไข: {m.editedNote}</p>}
                      </div>
                      {canEditNote && (
                        <button
                          onClick={() => openNoteDialog(m.id, m.editedNote ?? "")}
                          className="shrink-0 text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                          aria-label="เพิ่มหมายเหตุแก้ไข"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>วันที่</Th>
                      <Th>เลขที่เอกสาร</Th>
                      <Th>รายการ</Th>
                      <Th>{typeHeader}</Th>
                      <Th>{qtyHeader}</Th>
                      <Th>{tab === "adjust" ? "ก่อน → หลัง" : "คงเหลือหลัง"}</Th>
                      <Th>ผู้ทำรายการ</Th>
                      <Th>หมายเหตุ</Th>
                      {canEditNote && <Th></Th>}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map((m) => (
                      <Tr key={m.id}>
                        <Td className="whitespace-nowrap text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(m.createdAt)}</Td>
                        <Td className="font-mono text-xs">{m.refNo}</Td>
                        <Td>
                          <p className="font-medium">{m.itemName}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">
                            {m.color && m.size ? `${m.color} / ${m.size} · ` : ""}
                            {m.sku}
                          </p>
                        </Td>
                        <Td>{typeCell(m)}</Td>
                        <Td className={`font-semibold ${qtyClass(m.qtyChange)}`}>{qtyText(m.qtyChange)}</Td>
                        <Td>{tab === "adjust" ? `${formatNumber(m.qtyBefore)} → ${formatNumber(m.qtyAfter)}` : formatNumber(m.qtyAfter)}</Td>
                        <Td className="text-xs">{m.actorName}</Td>
                        <Td className="max-w-[200px] text-xs text-[var(--color-on-surface-variant)]">
                          {m.note && <p>{m.note}</p>}
                          {m.editedNote && <p className="mt-1 italic text-[var(--color-warning)]">แก้ไข: {m.editedNote}</p>}
                        </Td>
                        {canEditNote && (
                          <Td>
                            <button
                              onClick={() => openNoteDialog(m.id, m.editedNote ?? "")}
                              className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                              aria-label="เพิ่มหมายเหตุแก้ไข"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </Td>
                        )}
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

      <Dialog
        open={Boolean(noteMovementId)}
        onClose={() => setNoteMovementId(null)}
        title="เพิ่มหมายเหตุแก้ไข"
        description="หมายเหตุเดิมจะไม่ถูกลบ ระบบจะแสดงหมายเหตุแก้ไขเพิ่มเติมต่อท้ายรายการ"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteMovementId(null)}>
              ยกเลิก
            </Button>
            <Button onClick={saveNote}>บันทึก</Button>
          </>
        }
      >
        <FormField label="หมายเหตุแก้ไข">
          <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} />
        </FormField>
      </Dialog>
    </>
  );
}
