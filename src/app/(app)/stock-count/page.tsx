"use client";

import { useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { ArrowLeft, Camera, ClipboardCheck, RotateCcw, ClipboardList } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { CameraScanner } from "@/components/stock/CameraScanner";
import { ColorSwatch } from "@/components/products/ColorSwatch";
import { useStore, useActions } from "@/lib/store";
import { getStockLevel } from "@/lib/store/engine";
import { productVariants, resolveUnitToken } from "@/lib/store/selectors";
import { compareSizes } from "@/lib/utils/sizes";
import { playBeep, primeAudio } from "@/lib/utils/beep";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { useDraft } from "@/lib/utils/useDraft";
import { refreshAppData } from "@/lib/store/refresh";
import { snapshotSystemQty } from "@/lib/utils/stockCountBaseline";
import { DraftBanner } from "@/components/stock/DraftBanner";
import { createClient } from "@/lib/supabase/client";
import { fetchUnitTokenByScan } from "@/lib/supabase/fetch";
import type { Product, ProductVariant } from "@/lib/types";

function StockCountForm() {
  const state = useStore();
  const { adjustStock, mergeUnitTokens } = useActions();
  const user = useCurrentUser();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");

  const [productQuery, setProductQuery] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = selectedProductId ? state.products[selectedProductId] : null;

  const [counts, setCounts] = useState<Record<string, number>>({});
  // ยอดในระบบ "ตอนเริ่มนับ" ของแต่ละตัวเลือก (ถ่ายภาพไว้ตอนเลือกรุ่น) ใช้เทียบกับยอดปัจจุบันว่ามีรายการเข้า/ออกระหว่างที่นับอยู่ไหม
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [scannedTokenIds, setScannedTokenIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const productResults = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(state.products)
      .filter((p) => p.sellingName.toLowerCase().includes(q) || (p.modelCode ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [productQuery, state.products]);

  const variants = useMemo(
    () =>
      selectedProduct
        ? [...productVariants(state, selectedProduct.id)].sort((a, b) => a.color.localeCompare(b.color) || compareSizes(a.size, b.size))
        : [],
    [state, selectedProduct]
  );

  // ถ่ายภาพยอดในระบบของรุ่นนี้ตอนเริ่มนับ: ดึงข้อมูลล่าสุดจากฐานข้อมูลก่อน เพื่อให้ยอดเริ่มต้นเป็นของจริง ไม่ใช่ข้อมูลเก่าค้างในเครื่อง
  async function startBaseline(productId: string, whId: string) {
    setBaseline(snapshotSystemQty(useStore.getState(), productId, whId));
    await refreshAppData();
    setBaseline(snapshotSystemQty(useStore.getState(), productId, whId));
  }

  function selectProduct(p: Product) {
    setSelectedProductId(p.id);
    setProductQuery(p.sellingName);
    setProductOpen(false);
    setCounts({});
    setScannedTokenIds(new Set());
    if (warehouseId) void startBaseline(p.id, warehouseId);
  }

  function resetProduct() {
    setSelectedProductId(null);
    setProductQuery("");
    setCounts({});
    setBaseline({});
    setScannedTokenIds(new Set());
  }

  // เปลี่ยนคลังกลางคัน: ยอดที่นับไว้เป็นของคลังเดิม ต้องเริ่มนับใหม่ ไม่งั้นจะเอายอดคลังหนึ่งไปปรับอีกคลัง
  function changeWarehouse(id: string) {
    setWarehouseId(id);
    setCounts({});
    setScannedTokenIds(new Set());
    if (selectedProductId && id) void startBaseline(selectedProductId, id);
  }

  function setCount(variantId: string, raw: string) {
    setCounts((prev) => {
      const next = { ...prev };
      if (raw === "") delete next[variantId];
      else next[variantId] = Math.max(0, Math.floor(Number(raw)) || 0);
      return next;
    });
  }

  function applyScan(variant: ProductVariant, tokenId: string | undefined) {
    if (!selectedProduct || variant.productId !== selectedProduct.id) {
      playBeep("error");
      toastError(`สแกนผิดรุ่น — นี่คือ "${state.products[variant.productId]?.sellingName ?? "?"}" ไม่ใช่ "${selectedProduct?.sellingName ?? ""}"`);
      return;
    }
    if (tokenId && scannedTokenIds.has(tokenId)) {
      playBeep("duplicate");
      toastError("ใบนี้นับไปแล้วในรอบนับนี้");
      return;
    }
    if (tokenId) setScannedTokenIds((prev) => new Set(prev).add(tokenId));
    playBeep("success");
    setCounts((prev) => ({ ...prev, [variant.id]: (prev[variant.id] ?? 0) + 1 }));
    toastSuccess(`${variant.color} / ${variant.size} — นับได้ ${(counts[variant.id] ?? 0) + 1} ชิ้น`);
  }

  async function handleScan(value: string) {
    const trimmed = value.trim();
    const resolved = resolveUnitToken(state, trimmed);
    if (resolved) {
      applyScan(resolved.variant, resolved.token.id);
      return;
    }

    const scanned = trimmed.toLowerCase();
    const bySku = Object.values(state.variants).find((v) => v.sku.toLowerCase() === scanned);
    if (bySku) {
      applyScan(bySku, undefined);
      return;
    }

    // อาจเป็นป้ายที่เพิ่งปริ้นจากอุปกรณ์/แท็บอื่น ซึ่งเครื่องนี้ยังไม่มีข้อมูล ลองถามฐานข้อมูลตรง ๆ ก่อนสรุปว่าไม่พบ
    const fetchedToken = await fetchUnitTokenByScan(createClient(), trimmed);
    const fetchedVariant = fetchedToken ? state.variants[fetchedToken.variantId] : undefined;
    if (fetchedToken && fetchedVariant) {
      mergeUnitTokens([fetchedToken]);
      applyScan(fetchedVariant, fetchedToken.id);
      return;
    }

    playBeep("error");
    toastError(`ไม่พบสินค้าที่ตรงกับ "${value}"`);
  }

  const rows = variants.map((v) => {
    const system = warehouseId ? getStockLevel(state.variantStock, v.id, warehouseId).qtyOnHand : 0;
    const touched = v.id in counts;
    const counted = counts[v.id] ?? 0;
    const start = baseline[v.id] ?? system;
    return { variant: v, system, start, changed: start !== system, counted, touched, diff: counted - system };
  });
  const touchedCount = rows.filter((r) => r.touched).length;
  const diffRows = rows.filter((r) => r.touched && r.diff !== 0);
  const touchedRows = rows.filter((r) => r.touched);
  // ยอดในระบบเปลี่ยนไปจากตอนเริ่มนับ (มีรับเข้า/เบิกออก/ปรับยอดจากเครื่องอื่นระหว่างที่นับ) — ยอดที่นับได้อาจไม่ตรงกับของจริง ณ ตอนเริ่ม
  const changedRows = rows.filter((r) => r.changed);
  const zeroableRows = rows.filter((r) => !r.touched);

  function acceptCurrentAsStart() {
    setBaseline((prev) => ({ ...prev, ...Object.fromEntries(changedRows.map((r) => [r.variant.id, r.system])) }));
  }

  // นับรอบเต็ม: รายการที่หาไม่เจอเลยถือว่ามี 0 ชิ้น (ตั้งให้เป็นนับแล้ว = 0)
  function markUncountedAsZero() {
    setCounts((prev) => ({ ...prev, ...Object.fromEntries(zeroableRows.map((r) => [r.variant.id, 0])) }));
  }

  // เก็บร่างการนับไว้ในเครื่อง ปิดแอป/สลับแอปแล้วกลับมา ยอดที่นับค้างไว้ไม่หาย (ถามก่อนว่าจะทำต่อไหม)
  const draftValue = useMemo(
    () => ({ warehouseId, selectedProductId, counts, baseline, scannedTokenIds: Array.from(scannedTokenIds) }),
    [warehouseId, selectedProductId, counts, baseline, scannedTokenIds]
  );
  const draft = useDraft({
    key: user ? `issa-draft:stock-count:${user.id}` : null,
    value: draftValue,
    hasContent: Boolean(selectedProductId) && Object.keys(counts).length > 0,
    onRestore: (v) => {
      const product = v.selectedProductId ? state.products[v.selectedProductId] : undefined;
      if (!product) {
        toastError("สินค้าในร่างที่เก็บไว้ไม่มีในระบบแล้ว");
        return;
      }
      if (v.warehouseId && activeWarehouses.some((w) => w.id === v.warehouseId)) setWarehouseId(v.warehouseId);
      setSelectedProductId(product.id);
      setProductQuery(product.sellingName);
      setCounts(Object.fromEntries(Object.entries(v.counts ?? {}).filter(([variantId]) => state.variants[variantId])));
      setScannedTokenIds(new Set(v.scannedTokenIds ?? []));
      // ยอดเริ่มนับเดิมในร่างต้องคงไว้ ถึงจะเห็นว่าระหว่างที่ปิดแอปไป ยอดในระบบเปลี่ยนไหม
      if (v.baseline) setBaseline(v.baseline);
    },
  });
  const totalSystem = touchedRows.reduce((s, r) => s + r.system, 0);
  const totalCounted = touchedRows.reduce((s, r) => s + r.counted, 0);
  const totalDiff = totalCounted - totalSystem;

  function handleSave() {
    if (!user || !warehouseId || !selectedProduct) return;
    setSaving(true);
    try {
      for (const row of diffRows) {
        adjustStock({
          itemType: "product",
          itemId: row.variant.id,
          warehouseId,
          newQty: row.counted,
          reason: `นับสต็อก — ${selectedProduct.sellingName}`,
          actorId: user.id,
          actorName: user.name,
        });
      }
      draft.clear();
      toastSuccess(`ปรับสต็อกเรียบร้อยแล้ว ${diffRows.length} รายการ`);
      setConfirmOpen(false);
      setCounts({});
      setScannedTokenIds(new Set());
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {draft.draft && (
        <DraftBanner
          savedAt={draft.draft.savedAt}
          summary={`${state.products[draft.draft.value.selectedProductId ?? ""]?.sellingName ?? "ไม่ระบุสินค้า"} · นับแล้ว ${Object.keys(draft.draft.value.counts ?? {}).length} รายการ`}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>เริ่มนับสต็อก</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4">
          <FormField label="คลังที่นับ" required>
            <Select value={warehouseId} onChange={(e) => changeWarehouse(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="สินค้าที่จะนับ" required>
            {selectedProduct ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 truncate rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container)] px-3.5 py-2.5 text-sm font-medium">
                  {selectedProduct.sellingName}
                </div>
                <Button variant="secondary" size="sm" onClick={resetProduct}>
                  <RotateCcw className="h-3.5 w-3.5" /> เปลี่ยน
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setProductOpen(true);
                  }}
                  onFocus={() => setProductOpen(true)}
                  placeholder="พิมพ์ชื่อรุ่นสินค้า..."
                />
                {productOpen && productResults.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProduct(p)}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-container)]"
                      >
                        {p.sellingName}
                      </button>
                    ))}
                  </div>
                )}
                {productOpen && productQuery.trim() && productResults.length === 0 && (
                  <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-on-surface-variant)] shadow-[var(--shadow-micro)]">
                    ไม่พบสินค้าที่ตรงกับคำค้นหา
                  </div>
                )}
              </div>
            )}
          </FormField>
        </CardContent>
      </Card>

      {!selectedProduct && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<ClipboardList className="h-10 w-10" />}
              title="เลือกรุ่นสินค้าที่จะนับก่อน"
              description="พิมพ์ชื่อรุ่นแล้วเลือกจากรายการด้านบน ระบบจะโชว์ตัวเลือกสี/ไซซ์ของรุ่นนั้นให้นับ"
            />
          </CardContent>
        </Card>
      )}

      {selectedProduct && warehouseId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{selectedProduct.sellingName}</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                นับแล้ว {touchedCount} จาก {variants.length} รายการ
              </p>
              {touchedCount > 0 && (
                <p className="mt-1 text-sm">
                  รวมที่นับแล้ว — สต็อกในระบบ <span className="font-semibold text-[var(--color-on-surface)]">{totalSystem}</span> ชิ้น · นับได้จริง{" "}
                  <span className="font-semibold text-[var(--color-on-surface)]">{totalCounted}</span> ชิ้น · ผลต่าง{" "}
                  <span className={`font-semibold ${totalDiff === 0 ? "text-[var(--color-on-surface-variant)]" : totalDiff > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
                  </span>
                </p>
              )}
            </div>
            <Button
              onClick={() => {
                primeAudio();
                setScanning(true);
              }}
            >
              <Camera className="h-4 w-4" /> สแกน QR
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {changedRows.length > 0 && (
              <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-container)] p-3 text-sm">
                <p>
                  <span className="font-semibold">ยอดในระบบเปลี่ยนไประหว่างที่นับ {changedRows.length} รายการ</span> (มีรับเข้า เบิกออก หรือปรับยอดเข้ามาหลังจากเริ่มนับ) ตรวจดูคอลัมน์ &quot;ตอนเริ่มนับ&quot; กับ &quot;ตอนนี้&quot; ก่อนบันทึก
                  ถ้ายืนยันว่าจำนวนที่นับถูกต้อง ณ ตอนนี้ กดรับทราบได้
                </p>
                <Button size="sm" variant="secondary" onClick={acceptCurrentAsStart}>
                  รับทราบ ใช้ยอดปัจจุบัน
                </Button>
              </div>
            )}
            {zeroableRows.length > 0 && touchedCount > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-[var(--color-on-surface-variant)]">ยังไม่ได้นับ {zeroableRows.length} รายการ (ถ้าไม่นับ ยอดเดิมไม่เปลี่ยน)</span>
                <Button size="sm" variant="ghost" onClick={markUncountedAsZero}>
                  ตั้งรายการที่ยังไม่นับเป็น 0
                </Button>
              </div>
            )}
            {/* การ์ดสำหรับจอมือถือ */}
            <div className="flex flex-col gap-2 sm:hidden">
              {rows.map(({ variant: v, system, start, changed, counted, touched, diff }) => (
                <div key={v.id} className="rounded-lg border border-[var(--color-border)] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      <ColorSwatch name={v.color} size={20} />
                      <span className="truncate">{v.color} / {v.size}</span>
                    </span>
                    {touched && diff !== 0 && (
                      <span className={`shrink-0 text-xs font-semibold ${diff > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                    {touched && diff === 0 && <span className="shrink-0 text-xs text-[var(--color-on-surface-variant)]">ตรงกัน</span>}
                  </div>
                  <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                    {v.sku} · ตอนเริ่มนับ {start}
                    {changed ? <span className="font-semibold text-[var(--color-warning)]"> → ตอนนี้ {system} (เปลี่ยน)</span> : ` · ตอนนี้ ${system}`}
                  </p>
                  <div className="mt-1.5">
                    <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">นับได้</label>
                    <Input
                      type="number"
                      min={0}
                      value={touched ? counted : ""}
                      placeholder="ยังไม่นับ"
                      onChange={(e) => setCount(v.id, e.target.value)}
                      className="h-8 w-24 px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ตารางสำหรับจอกว้าง */}
            <div className="hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    <Th>สี</Th>
                    <Th>ไซซ์</Th>
                    <Th>SKU</Th>
                    <Th>ตอนเริ่มนับ</Th>
                    <Th>ตอนนี้</Th>
                    <Th>นับได้</Th>
                    <Th>ผลต่าง</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map(({ variant: v, system, start, changed, counted, touched, diff }) => (
                    <Tr key={v.id}>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <ColorSwatch name={v.color} size={20} />
                          {v.color}
                        </span>
                      </Td>
                      <Td>{v.size}</Td>
                      <Td className="font-mono text-xs">{v.sku}</Td>
                      <Td>{start}</Td>
                      <Td className={changed ? "bg-[var(--color-warning-container)] font-semibold" : undefined}>
                        {system}
                        {changed && <span className="ml-1 text-xs font-normal text-[var(--color-warning)]">เปลี่ยน</span>}
                      </Td>
                      <Td>
                        <Input
                          type="number"
                          min={0}
                          value={touched ? counted : ""}
                          placeholder="ยังไม่นับ"
                          onChange={(e) => setCount(v.id, e.target.value)}
                          className="w-24"
                        />
                      </Td>
                      <Td>
                        {touched && diff !== 0 && (
                          <span className={diff > 0 ? "font-semibold text-[var(--color-success)]" : "font-semibold text-[var(--color-danger)]"}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                        {touched && diff === 0 && <span className="text-[var(--color-on-surface-variant)]">ตรงกัน</span>}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {scanning && <CameraScanner onDetect={handleScan} onClose={() => setScanning(false)} />}

      {selectedProduct && (
        <div className="flex justify-end">
          <Button onClick={() => setConfirmOpen(true)} disabled={diffRows.length === 0}>
            <ClipboardCheck className="h-4 w-4" /> บันทึกปรับสต็อก ({diffRows.length})
          </Button>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="ยืนยันการปรับสต็อก"
        description={`${selectedProduct?.sellingName ?? ""} — คลัง ${state.warehouses[warehouseId]?.name ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} loading={saving}>
              ยืนยันบันทึก
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-[var(--color-on-surface-variant)]">
          ระบบจะตั้งสต็อกของแต่ละรายการ <span className="font-semibold text-[var(--color-on-surface)]">ให้เท่ากับจำนวนที่นับได้</span> (ไม่ใช่บวกเพิ่ม) และบันทึกประวัติปรับยอดให้ทุกรายการ รายการที่ไม่ได้นับหรือนับแล้วตรงกันจะไม่ถูกแตะ
        </p>
        {diffRows.some((r) => r.changed) && (
          <p role="alert" className="mb-3 rounded-xl bg-[var(--color-warning-container)] px-3 py-2 text-sm text-[var(--color-warning)]">
            มี {diffRows.filter((r) => r.changed).length} รายการที่ยอดในระบบเปลี่ยนไปจากตอนเริ่มนับ ตรวจให้แน่ใจก่อนว่าจำนวนที่นับได้คือของจริงตอนนี้
          </p>
        )}
        <Table>
          <Thead>
            <Tr>
              <Th>สี / ไซซ์</Th>
              <Th>ตอนเริ่มนับ</Th>
              <Th>ตอนนี้</Th>
              <Th>นับได้</Th>
              <Th>ผลต่าง</Th>
            </Tr>
          </Thead>
          <Tbody>
            {diffRows.map((r) => (
              <Tr key={r.variant.id}>
                <Td>
                  {r.variant.color} / {r.variant.size}
                </Td>
                <Td>{r.start}</Td>
                <Td className={r.changed ? "font-semibold text-[var(--color-warning)]" : undefined}>{r.system}</Td>
                <Td className="font-semibold">{r.counted}</Td>
                <Td className={r.diff > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>{r.diff > 0 ? `+${r.diff}` : r.diff}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Dialog>
    </div>
  );
}

export default function StockCountPage() {
  return (
    <>
      <Header
        title="นับสต็อก"
        description="เลือกรุ่นสินค้าที่จะนับ แล้วสแกน QR ทีละชิ้นเพื่อนับจำนวนจริง เทียบกับระบบและปรับยอดให้ตรง"
        actions={
          <BackLink href="/products/all" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </BackLink>
        }
      />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.adjust">
          <StockCountForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
