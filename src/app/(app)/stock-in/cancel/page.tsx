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

const docQty = (d: StockInDoc) => d.lines.reduce((s, l) => s + l.qty, 0);

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-xs font-semibold text-white">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function CancelStockInContent() {
  const state = useStore();
  const user = useCurrentUser();
  const { cancelStockIns } = useActions();
  const [days, setDays] = useState("3");
  const [kind, setKind] = useState("all");
  const [person, setPerson] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // เวลาที่เปิดหน้า ใช้นับย้อนหลัง (ใบที่เพิ่งบันทึกใหม่ระหว่างเปิดหน้ายังขึ้นเพราะใหม่กว่าเสมอ)
  const [openedAt] = useState(() => Date.now());

  // ใบในช่วงเวลาที่เลือก (ยังไม่กรองคน) ใช้ทำรายชื่อคนที่บันทึก
  const inPeriod = useMemo(() => {
    const since = openedAt - Number(days) * DAY_MS;
    return Object.values(state.stockInDocs).filter((d) => new Date(d.createdAt).getTime() >= since);
  }, [state.stockInDocs, days, openedAt]);

  const people = useMemo(() => {
    const byId = new Map<string, string>();
    for (const d of inPeriod) {
      if (d.receivedBy && !byId.has(d.receivedBy)) byId.set(d.receivedBy, state.users[d.receivedBy]?.name ?? "ไม่ทราบชื่อ");
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [inPeriod, state.users]);

  const docs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod
      .filter((d) => (kind === "all" ? true : kind === "in" ? !d.returnType : Boolean(d.returnType)))
      .filter((d) => person === "all" || d.receivedBy === person)
      .filter((d) => {
        if (!q) return true;
        if (d.docNo.toLowerCase().includes(q)) return true;
        return d.lines.some((l) => itemLabel(state, d, l.itemId).toLowerCase().includes(q) || (state.variants[l.itemId]?.sku ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state, inPeriod, kind, person, search]);

  const shown = docs.slice(0, MAX_ROWS);
  const selectable = shown.filter((d) => d.status !== "cancelled");
  const chosen = useMemo(() => docs.filter((d) => selected.has(d.id)), [docs, selected]);
  const chosenQty = chosen.reduce((s, d) => s + docQty(d), 0);
  const allSelected = selectable.length > 0 && selectable.every((d) => selected.has(d.id));
  const problems = useMemo(() => (open ? stockInCancelProblems(state, chosen.map((d) => d.id)) : []), [open, state, chosen]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const d of selectable) next.delete(d.id);
      else for (const d of selectable) next.add(d.id);
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

      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">รับเข้าผิดรุ่น/ผิดจำนวน ทำตามนี้</p>
        <ol className="flex flex-col gap-2 text-sm text-[var(--color-on-surface)]">
          <Step n={1}>
            <b>ติ๊กใบที่รับเข้าผิด</b> ในรายการข้างล่าง (กรองตามคนที่บันทึก หรือค้นหาชื่อรุ่นก่อนก็ได้ ติ๊กทีเดียวหลายใบได้)
          </Step>
          <Step n={2}>
            กดปุ่ม <b>&quot;ยกเลิกใบที่เลือก&quot;</b> ด้านบน แล้วพิมพ์เหตุผล เช่น รับเข้าผิดรุ่น
          </Step>
          <Step n={3}>
            สต็อกจะลดลงตามที่รับเข้าทันที แล้ว <b>ไปบันทึกรับเข้าใหม่ให้ถูกรุ่น</b> ที่หน้ารับสินค้าเข้า
          </Step>
        </ol>
        <p className="mt-3 text-xs text-[var(--color-on-surface-variant)]">
          ใบที่ยกเลิกจะไม่ถูกนับในรายงาน (ประวัติเดิมยังเก็บไว้ ลบไม่ได้) ยกเลิกไม่ได้ถ้าของจากใบนั้นถูกขายหรือเบิกออกไปแล้ว
        </p>
      </Card>

      {/* แถบปุ่มอยู่ด้านบนและติดหน้าจอ ไม่ต้องเลื่อนลงไปหาท้ายรายการ */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-sm">
        <p className="text-sm">
          {chosen.length === 0 ? (
            <span className="text-[var(--color-on-surface-variant)]">ยังไม่ได้เลือกใบ — ติ๊กช่องหน้าใบที่รับเข้าผิด</span>
          ) : (
            <span className="font-semibold">{`เลือก ${chosen.length} ใบ รวม ${formatNumber(chosenQty)} ชิ้น`}</span>
          )}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาเลขที่ใบ, ชื่อรุ่น หรือ SKU" className="pl-9" aria-label="ค้นหา" />
        </div>
        <Select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="คนที่บันทึก">
          <option value="all">ทุกคนที่บันทึก</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
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
          <label className="flex cursor-pointer items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-container)]/50 px-4 py-2.5 text-sm font-medium">
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} />
            เลือกทั้งหมดที่แสดงอยู่ ({formatNumber(selectable.length)} ใบ)
          </label>
          <ul className="divide-y divide-[var(--color-border)]">
            {shown.map((d) => {
              const cancelled = d.status === "cancelled";
              const picked = selected.has(d.id);
              const first = d.lines[0] ? itemLabel(state, d, d.lines[0].itemId) : "-";
              const more = d.lines.length > 1 ? ` และอีก ${d.lines.length - 1} รายการ` : "";
              const receiver = d.receivedBy ? (state.users[d.receivedBy]?.name ?? "") : "";
              return (
                <li key={d.id} className={cancelled ? "bg-[var(--color-surface-container)]/40 text-[var(--color-on-surface-variant)]" : picked ? "bg-[var(--color-danger-container)]/40" : ""}>
                  <label className={"flex items-start gap-3 px-4 py-3 " + (cancelled ? "" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0"
                      checked={picked}
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
                    <p className="shrink-0 text-right text-sm font-semibold tabular-nums">{formatNumber(docQty(d))} ชิ้น</p>
                  </label>
                </li>
              );
            })}
          </ul>
          {docs.length > MAX_ROWS && (
            <p className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-on-surface-variant)]">แสดง {MAX_ROWS} ใบล่าสุดจาก {formatNumber(docs.length)} ใบ ใช้ช่องค้นหาหรือกรองคนที่บันทึกเพื่อจำกัดให้แคบลง</p>
          )}
        </Card>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="ยืนยันยกเลิกใบรับเข้า"
        description={`ยกเลิก ${chosen.length} ใบ สต็อกจะลดลงรวม ${formatNumber(chosenQty)} ชิ้น ใบเหล่านี้จะไม่ถูกนับในรายงาน`}
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
          <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-on-surface-variant)]">
            {chosen.slice(0, 8).map((d) => (
              <p key={d.id} className="flex justify-between gap-2 py-0.5">
                <span className="truncate">
                  {d.docNo} · {d.lines[0] ? itemLabel(state, d, d.lines[0].itemId) : "-"}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatNumber(docQty(d))} ชิ้น</span>
              </p>
            ))}
            {chosen.length > 8 && <p className="py-0.5">และอีก {chosen.length - 8} ใบ</p>}
          </div>
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
