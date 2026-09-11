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
import { DateRangePicker, useDateRange } from "@/components/ui/DateRangePicker";
import { Dialog } from "@/components/ui/Dialog";
import { useStore, useActions } from "@/lib/store";
import { movementsInRange } from "@/lib/store/selectors";
import { formatNumber } from "@/lib/utils/money";
import { formatThaiDateTime } from "@/lib/utils/date";
import { useCan } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { MOVEMENT_TYPE_LABEL_TH, type MovementItemType, type MovementType } from "@/lib/types";

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const state = useStore();
  const { addEditedNote } = useActions();
  const canEditNote = useCan("settings.write");

  const { value: range, setValue: setRange } = useDateRange("30d");
  const [search, setSearch] = useState("");
  const [itemType, setItemType] = useState<MovementItemType | "all">("all");
  const [movementType, setMovementType] = useState<MovementType | "all">("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [page, setPage] = useState(1);
  const [noteMovementId, setNoteMovementId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const movements = useMemo(() => movementsInRange(state, range.from, range.to), [state, range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements
      .filter((m) => itemType === "all" || m.itemType === itemType)
      .filter((m) => movementType === "all" || m.movementType === movementType)
      .filter((m) => warehouseId === "all" || m.warehouseFromId === warehouseId || m.warehouseToId === warehouseId)
      .filter((m) => !q || m.itemName.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.refNo.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, search, itemType, movementType, warehouseId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  return (
    <>
      <Header
        title="ประวัติการเคลื่อนไหว"
        description="ตรวจสอบย้อนหลังการรับเข้า เบิกออก โอนย้าย และปรับยอดสต็อกทั้งหมด"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <PageContainer>
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
            >
              <option value="all">การเคลื่อนไหวทั้งหมด</option>
              {Object.entries(MOVEMENT_TYPE_LABEL_TH).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
          </div>
        </Card>

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
                        <p className={`mt-1 text-sm font-semibold ${m.qtyChange > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                          {m.qtyChange > 0 ? "+" : ""}
                          {formatNumber(m.qtyChange)}
                        </p>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">คงเหลือ {formatNumber(m.qtyAfter)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-start justify-between gap-2 text-xs text-[var(--color-on-surface-variant)]">
                      <div>
                        <p>โดย {m.actorName}</p>
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
                  <Th>ประเภท</Th>
                  <Th>จำนวน</Th>
                  <Th>คงเหลือหลัง</Th>
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
                    <Td>
                      <MovementTypeBadge type={m.movementType} />
                    </Td>
                    <Td className={m.qtyChange > 0 ? "font-semibold text-[var(--color-success)]" : "font-semibold text-[var(--color-danger)]"}>
                      {m.qtyChange > 0 ? "+" : ""}
                      {formatNumber(m.qtyChange)}
                    </Td>
                    <Td>{formatNumber(m.qtyAfter)}</Td>
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
