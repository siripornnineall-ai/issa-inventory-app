"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PackagePlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { VariantPicker } from "@/components/stock/VariantPicker";
import { NameCombobox } from "@/components/ui/NameCombobox";
import { useStore, useActions } from "@/lib/store";
import { checkScannedToken } from "@/lib/store/engine";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { playBeep } from "@/lib/utils/beep";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { useDraft } from "@/lib/utils/useDraft";
import { pruneRestoredTokens } from "@/lib/utils/draftRestore";
import { DraftBanner } from "@/components/stock/DraftBanner";
import { PendingSaveBar } from "@/components/stock/PendingSaveBar";
import { DuplicateSaveDialog } from "@/components/stock/DuplicateSaveDialog";
import { SaveSuccessCard, type SavedInfo } from "@/components/stock/SaveSuccessCard";
import { findRecentSimilarDoc, useSaveGuard } from "@/lib/utils/saveGuard";
import type { UnitToken, ProductVariant } from "@/lib/types";

interface Line {
  key: string;
  variantId: string;
  qty: number;
  unitCost: number;
}

function StockInForm({ onAgain }: { onAgain: () => void }) {
  const state = useStore();
  const { stockIn, upsertPoSignatory, recordUnitScanIn } = useActions();
  const signatories = useMemo(() => Object.values(state.poSignatories), [state.poSignatories]);
  const user = useCurrentUser();
  const router = useRouter();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const [date, setDate] = useState(todayInputValue());
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [issuePo, setIssuePo] = useState(false);
  const [issuedByName, setIssuedByName] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  // ล็อกปุ่มบันทึกทันทีที่กด (กันมือถือค้างแล้วบันทึกซ้ำ) และขึ้นหน้ายืนยันเมื่อสำเร็จ
  const guard = useSaveGuard();
  const saving = guard.locked;
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [scannedTokensByVariant, setScannedTokensByVariant] = useState<Record<string, string[]>>({});
  const [scanLog, setScanLog] = useState<{ id: string; time: string; label: string; ok: boolean }[]>([]);

  function logScan(label: string, ok: boolean) {
    const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setScanLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, time, label, ok }, ...prev].slice(0, 30));
  }

  const dirty = !saved && (lines.length > 0 || note.trim().length > 0 || poNumber.trim().length > 0);
  useUnsavedChangesGuard(dirty);

  // เก็บร่างไว้ในเครื่อง: ปิดแอป/สลับแอปแล้วกลับมา รายการที่สแกนค้างไว้ไม่หาย (ถามก่อนว่าจะทำต่อไหม)
  const draftValue = useMemo(
    () => ({ warehouseId, supplierId, poNumber, issuePo, issuedByName, approvedByName, billNumber, note, lines, scannedTokensByVariant }),
    [warehouseId, supplierId, poNumber, issuePo, issuedByName, approvedByName, billNumber, note, lines, scannedTokensByVariant]
  );
  const draft = useDraft({
    key: user ? `issa-draft:stock-in:${user.id}` : null,
    value: draftValue,
    hasContent: dirty,
    onRestore: (v) => {
      const pruned = pruneRestoredTokens(state.unitTokens, v.scannedTokensByVariant ?? {}, (v.lines ?? []).filter((l) => state.variants[l.variantId]), "in");
      if (v.warehouseId && activeWarehouses.some((w) => w.id === v.warehouseId)) setWarehouseId(v.warehouseId);
      setSupplierId(v.supplierId ?? "");
      setPoNumber(v.poNumber ?? "");
      setIssuePo(Boolean(v.issuePo));
      setIssuedByName(v.issuedByName ?? "");
      setApprovedByName(v.approvedByName ?? "");
      setBillNumber(v.billNumber ?? "");
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
    const variant = state.variants[variantId];
    setLines((prev) => [...prev, { key: variantId, variantId, qty: 1, unitCost: variant?.purchasePrice ?? 0 }]);
  }

  // สแกนบาร์โค้ด SKU ซ้ำ = จำนวน +1 (บาร์โค้ดรหัสเดียวกันทุกชิ้นของตัวเลือกนั้น) ต่างจากการเลือกจากรายการที่ถือว่าซ้ำ
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
      toastError(`ป้ายใบนี้ (รหัส ${token.code ?? token.id.slice(0, 8).toUpperCase()}) สแกนไปแล้วในรายการนี้ — ถ้าชิ้นนี้เป็นชิ้นใหม่ ป้ายอาจถูกถ่ายสำเนามา ให้พิมพ์ป้ายใหม่จากระบบแทนการสั่งพิมพ์หลายสำเนา`);
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
      return [...prev, { key: variant.id, variantId: variant.id, qty: 1, unitCost: variant.purchasePrice }];
    });
    playBeep("success");
    toastSuccess(`${label} — เพิ่ม 1 ชิ้น`);
    logScan(`${label} +1`, true);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
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
  const totalCost = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitCost || 0), 0);

  function handleSubmit() {
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่รับสินค้าเข้า");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    if (!user) return;
    const similar = findRecentSimilarDoc(
      Object.values(state.stockInDocs)
        .filter((d) => d.itemType === "product" && !d.returnType && d.receivedBy === user.id && d.warehouseId === warehouseId)
        .map((d) => ({ no: d.docNo, createdAt: d.createdAt, lines: d.lines })),
      lines.map((l) => ({ itemId: l.variantId, qty: l.qty }))
    );
    guard.run(save, similar);
  }

  function save(): "keep" | "release" {
    if (!user) return "release";
    try {
      const doc = stockIn({
        itemType: "product",
        date: dateInputToISO(date),
        warehouseId,
        supplierId: supplierId || undefined,
        poNumber: poNumber || undefined,
        issuePo,
        issuedByName: issuedByName || undefined,
        approvedByName: approvedByName || undefined,
        billNumber: billNumber || undefined,
        receivedBy: user.id,
        receivedByName: user.name,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.variantId, qty: l.qty, unitCost: l.unitCost })),
      });
      for (const tokenIds of Object.values(scannedTokensByVariant)) {
        for (const tokenId of tokenIds) {
          try {
            recordUnitScanIn(tokenId);
          } catch (e) {
            toastError(e instanceof Error ? e.message : "บันทึกสถานะ QR บางใบไม่สำเร็จ");
          }
        }
      }
      draft.clear();
      toastSuccess("บันทึกการรับสินค้าเข้าเรียบร้อยแล้ว");
      if (issuePo) {
        router.replace(`/stock-in/${doc.id}/po`);
      } else {
        setSaved({ docNo: doc.docNo, totalQty, lineCount: lines.length });
      }
      return "keep";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "release";
    }
  }

  if (saved) {
    return (
      <SaveSuccessCard title="บันทึกการรับสินค้าเข้าแล้ว" info={saved} againLabel="รับสินค้าเข้าต่อ" onAgain={onAgain} backHref="/products/all" backLabel="ไปหน้าสินค้า" />
    );
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
          <CardTitle>ข้อมูลการรับเข้า</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="วันที่รับเข้า" required>
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
          <FormField label="ผู้ผลิต / ซัพพลายเออร์">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {Object.values(state.suppliers).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="เลขที่ PO" hint={issuePo ? "ระบบจะสร้างเลขที่ PO ให้อัตโนมัติ" : undefined}>
            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} disabled={issuePo} />
          </FormField>
          <FormField label="เลขที่บิล / ใบส่งของ">
            <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
          </FormField>
          <div className="col-span-2 flex items-center gap-2 lg:col-span-3">
            <input
              id="issuePo"
              type="checkbox"
              checked={issuePo}
              onChange={(e) => setIssuePo(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="issuePo" className="text-sm text-[var(--color-on-surface)]">
              ออกใบสั่งซื้อ (PO) อัตโนมัติ สำหรับเบิกจ่าย/เก็บเป็นหลักฐานทางบัญชี
            </label>
          </div>
          {issuePo && (
            <>
              <FormField label="ผู้สั่งซื้อ">
                <NameCombobox
                  options={signatories}
                  value={issuedByName}
                  onChange={setIssuedByName}
                  onCreate={(name) => upsertPoSignatory(name)}
                  placeholder="เลือกหรือพิมพ์ชื่อผู้สั่งซื้อ..."
                />
              </FormField>
              <FormField label="ผู้อนุมัติ">
                <NameCombobox
                  options={signatories}
                  value={approvedByName}
                  onChange={setApprovedByName}
                  onCreate={(name) => upsertPoSignatory(name)}
                  placeholder="เลือกหรือพิมพ์ชื่อผู้อนุมัติ..."
                />
              </FormField>
            </>
          )}
          <FormField label="หมายเหตุ" className="col-span-2 lg:col-span-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
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
            <EmptyState icon={<PackagePlus className="h-10 w-10" />} title="ยังไม่มีรายการสินค้า" description="ค้นหาและเลือกสินค้าด้านบนเพื่อเพิ่มลงในรายการรับเข้า" />
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
                      <div className="mt-1.5 flex items-end gap-1.5">
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">จำนวน</label>
                          <Input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                            className="h-8 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">ราคาต่อหน่วย</label>
                          <Input
                            type="number"
                            min={0}
                            value={l.unitCost}
                            onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                            className="h-8 px-2 py-1 text-sm"
                          />
                        </div>
                        <p className="h-8 shrink-0 pl-1 pt-1.5 text-sm font-semibold">{formatTHB(l.qty * l.unitCost)}</p>
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
                      <Th>ราคาต่อหน่วย</Th>
                      <Th>รวม</Th>
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
                            <Input
                              type="number"
                              min={1}
                              value={l.qty}
                              onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                              className="w-24"
                            />
                          </Td>
                          <Td>
                            <Input
                              type="number"
                              min={0}
                              value={l.unitCost}
                              onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                              className="w-28"
                            />
                          </Td>
                          <Td>{formatTHB(l.qty * l.unitCost)}</Td>
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
              <span>
                มูลค่ารวม: <span className="font-semibold">{formatTHB(totalCost)}</span>
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
          บันทึกการรับเข้า
        </Button>
      </div>
      <PendingSaveBar totalQty={totalQty} lineCount={lines.length} saveLabel="บันทึกการรับเข้า" onSave={handleSubmit} saving={saving} />
      <DuplicateSaveDialog guard={guard} docLabel="ใบรับเข้า" />
    </div>
  );
}

export default function StockInPage() {
  // เปลี่ยน key เพื่อเริ่มฟอร์มใหม่ทั้งหมด (ปุ่ม "รับสินค้าเข้าต่อ" หลังบันทึกสำเร็จ)
  const [round, setRound] = useState(0);
  return (
    <>
      <Header title="รับสินค้าเข้า" description="บันทึกการรับสินค้าเข้าคลัง พร้อมอ้างอิงผู้ผลิตและเอกสาร" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.in">
          <StockInForm key={round} onAgain={() => setRound((n) => n + 1)} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
