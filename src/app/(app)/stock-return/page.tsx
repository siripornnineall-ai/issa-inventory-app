"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Trash2, Undo2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { VariantPicker } from "@/components/stock/VariantPicker";
import { DraftBanner } from "@/components/stock/DraftBanner";
import { PendingSaveBar } from "@/components/stock/PendingSaveBar";
import { DuplicateSaveDialog } from "@/components/stock/DuplicateSaveDialog";
import { SaveSuccessCard, type SavedInfo } from "@/components/stock/SaveSuccessCard";
import { useStore, useActions } from "@/lib/store";
import { CancelStockInLink } from "@/components/stock/CancelStockInLink";
import { checkScannedToken } from "@/lib/store/engine";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { playBeep } from "@/lib/utils/beep";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { useDraft } from "@/lib/utils/useDraft";
import { pruneRestoredTokens } from "@/lib/utils/draftRestore";
import { findRecentSimilarDoc, useSaveGuard } from "@/lib/utils/saveGuard";
import { RETURN_REASONS, RETURN_TAGS, isReturnReason, type ReturnReasonCode } from "@/lib/utils/returnReasons";
import { SALES_CHANNEL_LABEL_TH, STOCK_RETURN_HINT_TH, STOCK_RETURN_LABEL_TH, STOCK_RETURN_TYPES, isStockReturnType, type StockReturnType, type UnitToken, type ProductVariant } from "@/lib/types";

interface Line {
  key: string;
  variantId: string;
  qty: number;
  unitPrice: number; // ราคาต่อชิ้นของที่ถูกคืน (ตั้งต้นจากราคาขาย แก้ได้) ใช้รวมเป็นมูลค่าของที่ถูกคืน
  reason: ReturnReasonCode | ""; // เหตุผลที่ลูกค้าคืน (บังคับ)
  tags: string[]; // สิ่งที่ลูกค้าพูด (ไม่บังคับ)
  exchangeToId: string; // เปลี่ยนเป็นตัวเลือกไหน (เฉพาะใบ "เปลี่ยน" บังคับ ข้อมูลอย่างเดียว ไม่ตัดสต็อก)
}

const newLine = (variantId: string, unitPrice: number, qty = 1): Line => ({ key: variantId, variantId, qty, unitPrice, reason: "", tags: [], exchangeToId: "" });

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white"
          : "border-[var(--color-border)] text-[var(--color-on-surface)] hover:border-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
      }`}
    >
      {children}
    </button>
  );
}

function StockReturnForm({ onAgain }: { onAgain: () => void }) {
  const state = useStore();
  const { stockReturn, recordUnitScanIn } = useActions();
  const user = useCurrentUser();
  const router = useRouter();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const [date, setDate] = useState(todayInputValue());
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  // ไม่เลือกประเภทให้ล่วงหน้า ผู้บันทึกต้องกดเลือกเอง (กันบันทึกผิดประเภทโดยไม่รู้ตัว)
  const [returnType, setReturnType] = useState<StockReturnType | "">("");
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  // กดบันทึกแล้วยังกรอกไม่ครบ: ค่อยขึ้นข้อความเตือนสีแดงใต้ช่องที่ขาด (ไม่เตือนตั้งแต่เปิดหน้า)
  const [tried, setTried] = useState(false);
  // เลือกสินค้าที่ "เปลี่ยนเป็น" ให้บรรทัดไหนอยู่ (key ของบรรทัด)
  const [targetFor, setTargetFor] = useState<string | null>(null);
  const guard = useSaveGuard();
  const saving = guard.locked;
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [scannedTokensByVariant, setScannedTokensByVariant] = useState<Record<string, string[]>>({});
  const [scanLog, setScanLog] = useState<{ id: string; time: string; label: string; ok: boolean }[]>([]);

  function logScan(label: string, ok: boolean) {
    const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setScanLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, time, label, ok }, ...prev].slice(0, 30));
  }

  const dirty = !saved && (lines.length > 0 || note.trim().length > 0);
  useUnsavedChangesGuard(dirty);

  // เก็บร่างไว้ในเครื่อง: ปิดแอป/สลับแอปแล้วกลับมา รายการที่สแกนค้างไว้ไม่หาย
  const draftValue = useMemo(
    () => ({ warehouseId, returnType, channel, note, lines, scannedTokensByVariant }),
    [warehouseId, returnType, channel, note, lines, scannedTokensByVariant]
  );
  const draft = useDraft({
    key: user ? `issa-draft:stock-return:${user.id}` : null,
    value: draftValue,
    hasContent: dirty,
    onRestore: (v) => {
      const pruned = pruneRestoredTokens(state.unitTokens, v.scannedTokensByVariant ?? {}, (v.lines ?? []).filter((l) => state.variants[l.variantId]), "in");
      if (v.warehouseId && activeWarehouses.some((w) => w.id === v.warehouseId)) setWarehouseId(v.warehouseId);
      setReturnType(v.returnType && isStockReturnType(v.returnType) ? v.returnType : "");
      setChannel(v.channel ?? "");
      setNote(v.note ?? "");
      setLines(
        pruned.lines.map((l) => {
          const x = l as Partial<Line>;
          return {
            key: l.key,
            variantId: l.variantId,
            qty: l.qty,
            unitPrice: typeof x.unitPrice === "number" ? x.unitPrice : (state.variants[l.variantId]?.sellingPrice ?? 0),
            reason: isReturnReason(x.reason) ? x.reason : "",
            tags: x.tags ?? [],
            exchangeToId: x.exchangeToId ?? "",
          };
        })
      );
      setScannedTokensByVariant(pruned.scanned);
      if (pruned.dropped > 0) toastError(`ตัดป้าย ${pruned.dropped} ใบที่ถูกบันทึกไปแล้วโดยเครื่องอื่นออกจากรายการ`);
    },
  });

  function addLine(variantId: string) {
    if (lines.some((l) => l.variantId === variantId)) {
      toastError("เพิ่มรายการนี้ไว้แล้ว");
      return;
    }
    setLines((prev) => [...prev, newLine(variantId, state.variants[variantId]?.sellingPrice ?? 0)]);
  }

  // สแกนบาร์โค้ด SKU ซ้ำ = จำนวน +1 (บาร์โค้ดรหัสเดียวกันทุกชิ้นของตัวเลือกนั้น)
  function scanSku(variantId: string) {
    if (lines.some((l) => l.variantId === variantId)) {
      setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l)));
      return;
    }
    addLine(variantId);
  }

  function handleScanToken(token: UnitToken, variant: ProductVariant) {
    const product = state.products[variant.productId];
    const label = `${product?.sellingName ?? variant.sku} ${variant.color}/${variant.size}`;
    const alreadyScanned = Object.values(scannedTokensByVariant).some((ids) => ids.includes(token.id));
    if (alreadyScanned) {
      playBeep("duplicate");
      toastError(`ป้ายใบนี้ (รหัส ${token.code ?? token.id.slice(0, 8).toUpperCase()}) สแกนไปแล้วในรายการนี้`);
      logScan(`${label} — สแกนซ้ำ`, false);
      return;
    }
    const check = checkScannedToken(state.unitTokens, token, "in");
    if (!check.ok) {
      playBeep("error");
      toastError(check.message);
      logScan(`${label} — ${check.message}`, false);
      return;
    }
    setScannedTokensByVariant((prev) => ({ ...prev, [variant.id]: [...(prev[variant.id] ?? []), token.id] }));
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, newLine(variant.id, variant.sellingPrice ?? 0)];
    });
    playBeep("success");
    toastSuccess(`${label} — เพิ่ม 1 ชิ้น`);
    logScan(`${label} +1`, true);
  }

  function updateLine(key: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
  }

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function toggleTag(key: string, tag: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, tags: l.tags.includes(tag) ? l.tags.filter((t) => t !== tag) : [...l.tags, tag] } : l)));
  }

  // ตั้งเหตุผลเดียวกันให้ทุกบรรทัดทีเดียว (ใบที่คืนมาหลายชิ้นด้วยเหตุผลเดียวกัน)
  function applyReasonToAll(reason: ReturnReasonCode) {
    setLines((prev) => prev.map((l) => ({ ...l, reason })));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setScannedTokensByVariant((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const totalQty = lines.reduce((s, l) => s + (l.qty || 0), 0);
  const totalValue = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);

  function handleSubmit() {
    if (!returnType) {
      toastError("กรุณาเลือกประเภทสินค้าที่คืน (ตีกลับ / คืน / ตำหนิ / เปลี่ยน)");
      return;
    }
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่รับสินค้าคืนเข้า");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    setTried(true);
    const missingReason = lines.findIndex((l) => !l.reason);
    if (missingReason >= 0) {
      toastError(`รายการที่ ${missingReason + 1} ยังไม่ได้เลือกเหตุผลที่ลูกค้าคืน`);
      return;
    }
    const missingTarget = returnType === "return_exchange" ? lines.findIndex((l) => !l.exchangeToId) : -1;
    if (missingTarget >= 0) {
      toastError(`รายการที่ ${missingTarget + 1} ยังไม่ได้เลือกว่าเปลี่ยนเป็นสินค้าอะไร`);
      return;
    }
    if (!user) return;
    const similar = findRecentSimilarDoc(
      Object.values(state.stockInDocs)
        .filter((d) => d.returnType === returnType && d.receivedBy === user.id && d.warehouseId === warehouseId)
        .map((d) => ({ no: d.docNo, createdAt: d.createdAt, lines: d.lines })),
      lines.map((l) => ({ itemId: l.variantId, qty: l.qty }))
    );
    guard.run(save, similar);
  }

  function save(): "keep" | "release" {
    if (!user || !returnType) return "release";
    try {
      const doc = stockReturn({
        date: dateInputToISO(date),
        warehouseId,
        returnType,
        channel: channel || undefined,
        receivedBy: user.id,
        receivedByName: user.name,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.variantId, qty: l.qty, unitPrice: l.unitPrice || 0, reason: l.reason, tags: l.tags, exchangeToId: l.exchangeToId || undefined })),
      });
      for (const tokenIds of Object.values(scannedTokensByVariant)) {
        for (const tokenId of tokenIds) {
          try {
            recordUnitScanIn(tokenId);
          } catch (e) {
            toastError(e instanceof Error ? e.message : "บันทึกสถานะป้ายบางใบไม่สำเร็จ");
          }
        }
      }
      draft.clear();
      toastSuccess("บันทึกการรับคืนสินค้าเรียบร้อยแล้ว");
      setSaved({ docNo: doc.docNo, totalQty, lineCount: lines.length });
      return "keep";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "release";
    }
  }

  if (saved) {
    return <SaveSuccessCard title="บันทึกการรับคืนสินค้าแล้ว" info={saved} againLabel="รับคืนสินค้าต่อ" onAgain={onAgain} backHref="/products/all" backLabel="ไปหน้าสินค้า" />;
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      {draft.draft && (
        <DraftBanner
          savedAt={draft.draft.savedAt}
          summary={`${formatNumber((draft.draft.value.lines ?? []).reduce((s, l) => s + (l.qty || 0), 0))} ชิ้น`}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>1. ลูกค้าส่งอะไรกลับมา</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="ประเภทสินค้าที่คืน">
            {STOCK_RETURN_TYPES.map((t) => {
              const active = returnType === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setReturnType(t)}
                  className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left ${
                    active
                      ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary-container)]"
                      : "border-[var(--color-border)] text-[var(--color-on-surface)] hover:border-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {active ? "✓ " : ""}
                    {STOCK_RETURN_LABEL_TH[t]}
                  </span>
                  <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">{STOCK_RETURN_HINT_TH[t]}</span>
                </button>
              );
            })}
          </div>
          {!returnType && <p className="text-xs text-[var(--color-warning)]">เลือกประเภทก่อนบันทึก</p>}
          {returnType === "return_defective" && activeWarehouses.length > 1 && (
            <p className="text-xs text-[var(--color-on-surface-variant)]">สินค้าตำหนิ แนะนำให้รับเข้าคลังแยก เพื่อไม่ให้ปนกับของพร้อมขาย (เลือกคลังด้านล่าง)</p>
          )}
          {returnType === "return_defective" && activeWarehouses.length <= 1 && (
            <p className="text-xs text-[var(--color-warning)]">มีคลังเดียว สินค้าตำหนิจะถูกนับรวมเป็นของพร้อมขาย ถ้าต้องการแยก ให้เพิ่มคลังใหม่ในหน้าตั้งค่า</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. ข้อมูลการรับคืน</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="วันที่รับคืน" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="คลังปลายทาง" required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="ช่องทางที่ขาย">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {Object.entries(SALES_CHANNEL_LABEL_TH).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. สินค้าที่ได้รับกลับมา และเหตุผล</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <VariantPicker warehouseId={warehouseId} onSelect={addLine} onScanSku={scanSku} onScanToken={handleScanToken} />

          {scanLog.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-2 text-xs">
              {scanLog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 px-1 py-0.5">
                  <span className="shrink-0 text-[var(--color-on-surface-variant)]">{entry.time}</span>
                  <span className={entry.ok ? "text-[var(--color-on-surface)]" : "text-[var(--color-danger)]"}>{entry.label}</span>
                </div>
              ))}
            </div>
          )}

          {lines.length === 0 ? (
            <EmptyState icon={<Undo2 className="h-10 w-10" />} title="ยังไม่มีรายการสินค้า" description="ค้นหาหรือสแกนสินค้าด้านบนเพื่อเพิ่มลงในรายการรับคืน" />
          ) : (
            <>
              {lines.length > 1 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container)]/50 p-3">
                  <p className="mb-2 text-xs font-medium">เหตุผลเดียวกันทุกรายการ? กดอันเดียวตั้งให้ทุกบรรทัดได้เลย</p>
                  <div className="flex flex-wrap gap-2">
                    {RETURN_REASONS.map((r) => (
                      <Chip key={r.code} active={lines.every((l) => l.reason === r.code)} onClick={() => applyReasonToAll(r.code)}>
                        {r.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {lines.map((l, i) => {
                const variant = state.variants[l.variantId];
                const product = variant ? state.products[variant.productId] : undefined;
                const target = l.exchangeToId ? state.variants[l.exchangeToId] : undefined;
                const targetProduct = target ? state.products[target.productId] : undefined;
                const noReason = tried && !l.reason;
                const noTarget = tried && returnType === "return_exchange" && !l.exchangeToId;
                return (
                  <div key={l.key} className="rounded-xl border border-[var(--color-border)] p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {i + 1}. {product?.sellingName} {variant?.color} {variant?.size}
                        </p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{variant?.sku}</p>
                      </div>
                      <button type="button" onClick={() => removeLine(l.key)} className="shrink-0 text-[var(--color-danger)]" aria-label="ลบรายการ">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-0.5 block text-[11px] text-[var(--color-on-surface-variant)]">จำนวน (ชิ้น)</label>
                        <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(l.key, Number(e.target.value))} className="h-9 w-24" aria-label={`จำนวนรายการที่ ${i + 1}`} />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-[var(--color-on-surface-variant)]">ราคาต่อชิ้น (บาท)</label>
                        <Input type="number" min={0} value={l.unitPrice} onChange={(e) => patchLine(l.key, { unitPrice: Number(e.target.value) })} className="h-9 w-32" aria-label={`ราคาต่อชิ้นรายการที่ ${i + 1}`} />
                      </div>
                      <p className="pb-2 text-sm text-[var(--color-on-surface-variant)]">
                        มูลค่า <span className="font-semibold text-[var(--color-on-surface)]">{formatTHB((l.qty || 0) * (l.unitPrice || 0))}</span>
                      </p>
                    </div>

                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-medium">
                        เหตุผลที่ลูกค้าคืน <span className="text-[var(--color-danger)]">*</span> <span className="font-normal text-[var(--color-on-surface-variant)]">(เลือก 1 ข้อ)</span>
                      </p>
                      <div className="flex flex-wrap gap-2" role="group" aria-label={`เหตุผลรายการที่ ${i + 1}`}>
                        {RETURN_REASONS.map((r) => (
                          <Chip key={r.code} active={l.reason === r.code} onClick={() => patchLine(l.key, { reason: r.code })}>
                            {r.label}
                          </Chip>
                        ))}
                      </div>
                      {noReason && <p className="mt-1 text-xs text-[var(--color-danger)]">กรุณาเลือกเหตุผล</p>}
                    </div>

                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-medium">
                        ลูกค้าพูดว่า <span className="font-normal text-[var(--color-on-surface-variant)]">(ไม่บังคับ เลือกได้หลายข้อ)</span>
                      </p>
                      <div className="flex flex-wrap gap-2" role="group" aria-label={`ลูกค้าพูดว่า รายการที่ ${i + 1}`}>
                        {RETURN_TAGS.map((t) => (
                          <Chip key={t} active={l.tags.includes(t)} onClick={() => toggleTag(l.key, t)}>
                            {t}
                          </Chip>
                        ))}
                      </div>
                    </div>

                    {returnType === "return_exchange" && (
                      <div className="mt-3 rounded-lg bg-[var(--color-surface-container)]/60 p-3">
                        <p className="mb-1.5 text-xs font-medium">
                          เปลี่ยนเป็นสินค้าอะไร <span className="text-[var(--color-danger)]">*</span>{" "}
                          <span className="font-normal text-[var(--color-on-surface-variant)]">(ใส่ไว้เป็นข้อมูล ไม่ตัดสต็อก ต้องยิงของที่ส่งให้ลูกค้าออกเองตามปกติ)</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {target ? (
                            <span className="text-sm font-medium">
                              → {targetProduct?.sellingName} {target.color} {target.size}
                            </span>
                          ) : (
                            <span className="text-sm text-[var(--color-on-surface-variant)]">ยังไม่ได้เลือก</span>
                          )}
                          <Button type="button" size="sm" variant="secondary" onClick={() => setTargetFor(l.key)}>
                            {target ? "เปลี่ยนสินค้า" : "เลือกสินค้าที่เปลี่ยนเป็น"}
                          </Button>
                        </div>
                        {noTarget && <p className="mt-1 text-xs text-[var(--color-danger)]">กรุณาเลือกสินค้าที่เปลี่ยนเป็น</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {lines.length > 0 && (
            <div className="flex items-center justify-end gap-6 border-t border-[var(--color-border)] pt-4 text-sm">
              <span>
                จำนวนรวม: <span className="font-semibold">{formatNumber(totalQty)}</span> ชิ้น
              </span>
              <span>
                มูลค่าของที่ถูกคืน: <span className="font-semibold">{formatTHB(totalValue)}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FormField label="หมายเหตุเพิ่มเติม (ไม่บังคับ)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลูกค้าบอกว่า... เลขพัสดุ หรืออะไรที่อยากให้ทีมรู้" />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            draft.clear();
            router.replace("/products/all");
          }}
        >
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          บันทึกการรับคืน
        </Button>
      </div>
      <PendingSaveBar totalQty={totalQty} lineCount={lines.length} saveLabel="บันทึกการรับคืน" onSave={handleSubmit} saving={saving} />
      <DuplicateSaveDialog guard={guard} docLabel="ใบรับคืน" />
      <Dialog open={targetFor !== null} onClose={() => setTargetFor(null)} title="เลือกสินค้าที่เปลี่ยนเป็น" description="ค้นหารุ่น สี ไซซ์ หรือ SKU ของสินค้าใหม่ที่ส่งให้ลูกค้า (ไม่ตัดสต็อก)" size="md">
        <VariantPicker
          onSelect={(id) => {
            if (targetFor) patchLine(targetFor, { exchangeToId: id });
            setTargetFor(null);
          }}
        />
      </Dialog>
    </div>
  );
}

export default function StockReturnPage() {
  // เปลี่ยน key เพื่อเริ่มฟอร์มใหม่ทั้งหมด (ปุ่ม "รับคืนสินค้าต่อ" หลังบันทึกสำเร็จ)
  const [round, setRound] = useState(0);
  return (
    <>
      <Header title="สต็อกคืนสินค้า" description="รับสินค้าที่กลับมาเข้าคลัง: ตีกลับ คืน ตำหนิ หรือเปลี่ยน (แยกจากการรับสินค้าเข้าใหม่)" actions={
          <div className="flex flex-wrap items-center gap-1">
            <Link href="/stock-return/summary" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]">
              <BarChart3 className="h-4 w-4" /> ดูสรุปสินค้าคืน/เปลี่ยน
            </Link>
            <CancelStockInLink />
          </div>
        }
      />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.in">
          <StockReturnForm key={round} onAgain={() => setRound((n) => n + 1)} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
