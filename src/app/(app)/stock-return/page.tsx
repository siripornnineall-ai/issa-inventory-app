"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Undo2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { VariantPicker } from "@/components/stock/VariantPicker";
import { DraftBanner } from "@/components/stock/DraftBanner";
import { PendingSaveBar } from "@/components/stock/PendingSaveBar";
import { DuplicateSaveDialog } from "@/components/stock/DuplicateSaveDialog";
import { SaveSuccessCard, type SavedInfo } from "@/components/stock/SaveSuccessCard";
import { useStore, useActions } from "@/lib/store";
import { checkScannedToken } from "@/lib/store/engine";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";
import { playBeep } from "@/lib/utils/beep";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { useDraft } from "@/lib/utils/useDraft";
import { pruneRestoredTokens } from "@/lib/utils/draftRestore";
import { findRecentSimilarDoc, useSaveGuard } from "@/lib/utils/saveGuard";
import { SALES_CHANNEL_LABEL_TH, STOCK_RETURN_HINT_TH, STOCK_RETURN_LABEL_TH, STOCK_RETURN_TYPES, isStockReturnType, type StockReturnType, type UnitToken, type ProductVariant } from "@/lib/types";

interface Line {
  key: string;
  variantId: string;
  qty: number;
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
      setLines(pruned.lines);
      setScannedTokensByVariant(pruned.scanned);
      if (pruned.dropped > 0) toastError(`ตัดป้าย ${pruned.dropped} ใบที่ถูกบันทึกไปแล้วโดยเครื่องอื่นออกจากรายการ`);
    },
  });

  function addLine(variantId: string) {
    if (lines.some((l) => l.variantId === variantId)) {
      toastError("เพิ่มรายการนี้ไว้แล้ว");
      return;
    }
    setLines((prev) => [...prev, { key: variantId, variantId, qty: 1 }]);
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
      return [...prev, { key: variant.id, variantId: variant.id, qty: 1 }];
    });
    playBeep("success");
    toastSuccess(`${label} — เพิ่ม 1 ชิ้น`);
    logScan(`${label} +1`, true);
  }

  function updateLine(key: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
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
        lines: lines.map((l) => ({ itemId: l.variantId, qty: l.qty })),
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
          <CardTitle>ประเภทสินค้าที่คืน</CardTitle>
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
          <CardTitle>ข้อมูลการรับคืน</CardTitle>
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
          <FormField label="เหตุผล / หมายเหตุ" className="col-span-2 lg:col-span-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ไซซ์ไม่พอดี ส่งผิดสี ซิปเสีย (ถ้ามี)" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการสินค้า</CardTitle>
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
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="flex flex-col gap-2 sm:hidden">
                {lines.map((l) => {
                  const variant = state.variants[l.variantId];
                  const product = variant ? state.products[variant.productId] : undefined;
                  return (
                    <div key={l.key} className="rounded-lg border border-[var(--color-border)] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{product?.sellingName}</p>
                          <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                            {variant?.color} / {variant?.size} · {variant?.sku}
                          </p>
                        </div>
                        <button onClick={() => removeLine(l.key)} className="shrink-0 text-[var(--color-danger)]" aria-label="ลบรายการ">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5">
                        <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">จำนวน</label>
                        <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(l.key, Number(e.target.value))} className="h-8 w-24 px-2 py-1 text-sm" />
                      </div>
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
                      <Th>จำนวน</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {lines.map((l) => {
                      const variant = state.variants[l.variantId];
                      const product = variant ? state.products[variant.productId] : undefined;
                      return (
                        <Tr key={l.key}>
                          <Td>
                            <p className="font-medium">{product?.sellingName}</p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">
                              {variant?.color} / {variant?.size} · {variant?.sku}
                            </p>
                          </Td>
                          <Td>
                            <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(l.key, Number(e.target.value))} className="w-24" />
                          </Td>
                          <Td>
                            <button onClick={() => removeLine(l.key)} className="text-[var(--color-danger)]" aria-label="ลบรายการ">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
          {lines.length > 0 && (
            <div className="flex items-center justify-end gap-6 border-t border-[var(--color-border)] pt-4 text-sm">
              <span>
                จำนวนรวม: <span className="font-semibold">{formatNumber(totalQty)}</span> ชิ้น
              </span>
            </div>
          )}
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
    </div>
  );
}

export default function StockReturnPage() {
  // เปลี่ยน key เพื่อเริ่มฟอร์มใหม่ทั้งหมด (ปุ่ม "รับคืนสินค้าต่อ" หลังบันทึกสำเร็จ)
  const [round, setRound] = useState(0);
  return (
    <>
      <Header title="สต็อกคืนสินค้า" description="รับสินค้าที่กลับมาเข้าคลัง: ตีกลับ คืน ตำหนิ หรือเปลี่ยน (แยกจากการรับสินค้าเข้าใหม่)" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.in">
          <StockReturnForm key={round} onAgain={() => setRound((n) => n + 1)} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
