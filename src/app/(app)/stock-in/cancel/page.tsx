"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { useStore, useActions } from "@/lib/store";
import { stockInCancelProblems } from "@/lib/store/engine";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatThaiDateTime } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";
import { STOCK_RETURN_LABEL_TH } from "@/lib/types";
import type { StockInDoc } from "@/lib/types";
import type { AppState } from "@/lib/store/state";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 100;

function itemLabel(state: AppState, doc: StockInDoc, itemId: string): string {
  if (doc.itemType === "product") {
    const v = state.variants[itemId];
    const p = v ? state.products[v.productId] : undefined;
    return `${p?.sellingName ?? "ไม่ทราบชื่อสินค้า"} ${v?.color ?? ""} ${v?.size ?? ""}`.replace(/\s+/g, " ").trim();
  }
  return state.equipment[itemId]?.name ?? "ไม่ทราบชื่ออุปกรณ์";
}

function docKind(doc: StockInDoc): string {
  return doc.returnType ? `รับคืน · ${STOCK_RETURN_LABEL_TH[doc.returnType]}` : "รับเข้า";
}

function CancelStockInContent() {
  const state = useStore();
  const user = useCurrentUser();
  const { cancelStockIns } = useActions();
  const [days, setDays] = useState("3");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // เวลาที่เปิดหน้า ใช้นับย้อนหลัง (ใบที่เพิ่งบันทึกใหม่ระหว่างเปิดหน้ายังขึ้นเพราะใหม่กว่าเสมอ)
  const [openedAt] = useState(() => Date.now());

  const docs = useMemo(() => {
    const since = openedAt - Number(days) * DAY_MS;
    const q = search.trim().toLowerCase();
    return Object.values(state.stockInDocs)
      .filter((d) => new Date(d.createdAt).getTime() >= since)
      .filter((d) => (kind === "all" ? true : kind === "in" ? !d.returnType : Boolean(d.returnType)))
      .filter((d) => {
        if (!q) return true;
        if (d.docNo.toLowerCase().includes(q)) return true;
        return d.lines.some((l) => itemLabel(state, d, l.itemId).toLowerCase().includes(q) || (state.variants[l.itemId]?.sku ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state, days, kind, search, openedAt]);

  const shown = docs.slice(0, MAX_ROWS);
  const chosen = useMemo(() => docs.filter((d) => selected.has(d.id)), [docs, selected]);
  const chosenQty = chosen.reduce((s, d) => s + d.lines.reduce((x, l) => x + l.qty, 0), 0);
  const problems = useMemo(() => (open ? stockInCancelProblems(state, chosen.map((d) => d.id)) : []), [open, state, chosen]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openDialog() {
    setReason("");
    setOpen(true);
  }

  function confirm() {
    if (!user) return;
    if (!reason.trim()) {
      toastError("กรุณาระบุเหตุผลที่ยกเลิก");
      return;
    }
    setBusy(true);
    try {
      const res = cancelStockIns(
        chosen.map((d) => d.id),
        reason.trim(),
        user.id,
        user.name
      );
      toastSuccess(`ยกเลิก ${res.docs} ใบ หักสต็อกคืน ${formatNumber(res.pieces)} ชิ้นเรียบร้อยแล้ว`);
      setSelected(new Set());
      setOpen(false);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stock-in" className="flex w-fit items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้ารับสินค้าเข้า
      </Link>

      <Card className="p-4 text-sm text-[var(--color-on-surface-variant)]">
        ใช้เมื่อรับเข้าผิดรุ่นหรือผิดจำนวน ระบบจะหักสต็อกคืนตามที่รับเข้า และใบนั้นจะไม่ถูกนับในรายงาน (ประวัติเดิมยังเก็บไว้ ลบไม่ได้) ยกเลิกไม่ได้ถ้าของจากใบนี้ถูกขายหรือเบิกออกไปแล้ว
        หลังยกเลิก ให้บันทึกรับเข้าใหม่ให้ถูกรุ่นที่หน้ารับสินค้าเข้า
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาเลขที่ใบ, ชื่อรุ่น หรือ SKU" className="pl-9" aria-label="ค้นหา" />
        </div>
        <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label="ช่วงเวลา">
          <option value="1">ใบที่บันทึกใน 1 วันล่าสุด</option>
          <option value="3">ใบที่บันทึกใน 3 วันล่าสุด</option>
          <option value="7">ใบที่บันทึกใน 7 วันล่าสุด</option>
          <option value="30">ใบที่บันทึกใน 30 วันล่าสุด</option>
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="ชนิดใบ">
          <option value="all">ทุกชนิด (รับเข้าและรับคืน)</option>
          <option value="in">เฉพาะรับสินค้าเข้า</option>
          <option value="return">เฉพาะรับคืน</option>
        </Select>
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState title="ไม่พบใบรับเข้าในช่วงนี้" description="ลองขยายช่วงเวลา หรือเปลี่ยนคำค้นหา" />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {shown.map((d) => {
              const cancelled = d.status === "cancelled";
              const qty = d.lines.reduce((s, l) => s + l.qty, 0);
              const first = d.lines[0] ? itemLabel(state, d, d.lines[0].itemId) : "-";
              const more = d.lines.length > 1 ? ` และอีก ${d.lines.length - 1} รายการ` : "";
              const receiver = d.receivedBy ? (state.users[d.receivedBy]?.name ?? "") : "";
              return (
                <li key={d.id} className={"flex items-start gap-3 px-4 py-3 " + (cancelled ? "bg-[var(--color-surface-container)]/50 text-[var(--color-on-surface-variant)]" : "")}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={selected.has(d.id)}
                    disabled={cancelled}
                    onChange={() => toggle(d.id)}
                    aria-label={`เลือกใบ ${d.docNo}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium">{d.docNo}</span>
                      <span className="text-xs text-[var(--color-on-surface-variant)]">
                        {formatThaiDateTime(d.createdAt)}
                        {receiver && ` · ${receiver}`}
                      </span>
                      <Badge tone="neutral">{docKind(d)}</Badge>
                      {cancelled && <Badge tone="danger">ยกเลิกแล้ว</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {first}
                      {more}
                    </p>
                    {cancelled && d.cancelReason && <p className="text-xs">เหตุผล: {d.cancelReason}</p>}
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">{formatNumber(qty)} ชิ้น</p>
                </li>
              );
            })}
          </ul>
          {docs.length > MAX_ROWS && (
            <p className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-on-surface-variant)]">แสดง {MAX_ROWS} ใบล่าสุดจาก {formatNumber(docs.length)} ใบ ใช้ช่องค้นหาเพื่อจำกัดให้แคบลง</p>
          )}
        </Card>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
        <p className="text-sm">
          {chosen.length === 0 ? "ยังไม่ได้เลือกใบ" : `เลือก ${chosen.length} ใบ รวม ${formatNumber(chosenQty)} ชิ้น`}
        </p>
        <div className="flex gap-2">
          {chosen.length > 0 && (
            <Button variant="secondary" onClick={() => setSelected(new Set())}>
              ล้างที่เลือก
            </Button>
          )}
          <Button variant="danger" onClick={openDialog} disabled={chosen.length === 0}>
            ยกเลิกใบที่เลือก
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="ยืนยันยกเลิกใบรับเข้า"
        description={`ยกเลิก ${chosen.length} ใบ หักสต็อกคืน ${formatNumber(chosenQty)} ชิ้น ใบเหล่านี้จะไม่ถูกนับในรายงาน`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ปิด
            </Button>
            <Button variant="danger" onClick={confirm} loading={busy}>
              ยืนยันยกเลิก
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {problems.length > 0 && (
            <div role="alert" className="rounded-xl bg-[var(--color-danger-container)] px-3 py-2 text-sm text-[var(--color-on-danger-container)]">
              <p className="font-medium">ยกเลิกไม่ได้ตอนนี้</p>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <FormField label="เหตุผลที่ยกเลิก" required hint="เช่น รับเข้าผิดรุ่น ต้องเป็น Wendy Slim">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </FormField>
        </div>
      </Dialog>
    </div>
  );
}

export default function CancelStockInPage() {
  return (
    <>
      <Header title="ยกเลิกใบรับเข้า" description="รับเข้าผิดรุ่นหรือผิดจำนวน ยกเลิกใบแล้วบันทึกใหม่ให้ถูก" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.adjust">
          <CancelStockInContent />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
