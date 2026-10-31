"use client";

import { Fragment, useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { ArrowLeft, Camera, ClipboardCheck, ClipboardList, Plus, X } from "lucide-react";
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
import { useSaveGuard } from "@/lib/utils/saveGuard";
import { createClient } from "@/lib/supabase/client";
import { fetchUnitTokenByScan } from "@/lib/supabase/fetch";
import type { Product, ProductVariant, StockMovement } from "@/lib/types";

interface CountRow {
  variant: ProductVariant;
  system: number; // ยอดในระบบตอนนี้
  counted: number; // จำนวนที่นับได้บนชั้น
  touched: boolean;
  // ของที่เข้า/ออกหลังจากที่กรอกจำนวนนับ (ยอดในระบบตอนนี้ − ยอดในระบบตอนที่กรอกนับ) เช่น นับแล้วมีคนขายออก 2 ชิ้น = −2
  during: number;
  // ยอดที่จะตั้งให้ตอนบันทึก = จำนวนที่นับ + ของที่เข้า/ออกหลังนับ (ไม่เอาจำนวนนับไปทับของที่ขายไปแล้ว)
  final: number;
  diff: number; // final − system = จำนวนที่ปรับจริง
}

function diffLabel(diff: number) {
  return diff > 0 ? `+${diff}` : String(diff);
}

function StockCountForm() {
  const state = useStore();
  const { adjustStock, mergeUnitTokens } = useActions();
  const user = useCurrentUser();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");

  const [productQuery, setProductQuery] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  // รอบนับหนึ่งรอบนับได้หลายรุ่นพร้อมกัน: เพิ่มรุ่นเข้ารอบได้ทั้งจากการค้นหา และอัตโนมัติเมื่อสแกนป้ายของรุ่นที่ยังไม่อยู่ในรอบ
  const [productIds, setProductIds] = useState<string[]>([]);
  // ล็อกเฉพาะรุ่นที่เลือก (ค่าเริ่มต้น): สแกนป้ายรุ่นอื่นที่ไม่อยู่ในรอบจะไม่ถูกนับและเตือน กันสแกนพลาด
  // ปิดล็อกเมื่ออยากให้การสแกนป้ายรุ่นใหม่เพิ่มรุ่นนั้นเข้ารอบให้เอง
  const [lockToSelected, setLockToSelected] = useState(true);

  const [counts, setCounts] = useState<Record<string, number>>({});
  // ยอดในระบบ "ตอนเริ่มนับ" ของแต่ละตัวเลือก (ถ่ายภาพไว้ตอนเพิ่มรุ่นเข้ารอบ) ใช้เทียบกับยอดปัจจุบันว่ามีรายการเข้า/ออกระหว่างที่นับอยู่ไหม
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  // เวลาที่ "กรอก/สแกนจำนวนนับ" ล่าสุดของแต่ละตัวเลือก (อัปเดตทุกครั้งที่แก้จำนวนนับ) ใช้หาของที่เข้า/ออก "หลังจากนับ"
  // ใช้เวลาของรายการเคลื่อนไหวเทียบ ไม่ใช้ยอดในเครื่อง เพราะเครื่องที่นับอาจมีข้อมูลเก่าค้าง (ไม่เห็นของที่ขายจากเครื่องอื่นก่อนหน้า)
  const [countedAt, setCountedAt] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [scannedTokenIds, setScannedTokenIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ล็อกปุ่มทันทีที่กดบันทึก กันมือถือค้างแล้วบันทึกผลนับซ้ำ
  const guard = useSaveGuard();
  const saving = guard.locked;
  // สรุปผลหลังบันทึก: ใช้ตรวจว่ารอบนี้ครบไหม โดยเฉพาะรายการที่ไม่ได้นับแต่ยังมีสต็อก (ยอดเก่าที่ไม่ถูกแตะ)
  const [summary, setSummary] = useState<{
    adjusted: number;
    matched: number;
    uncounted: { label: string; qty: number }[];
    totalAfter: number;
    products: number;
  } | null>(null);

  const productResults = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(state.products)
      .filter((p) => !productIds.includes(p.id) && (p.sellingName.toLowerCase().includes(q) || (p.modelCode ?? "").toLowerCase().includes(q)))
      .slice(0, 20);
  }, [productQuery, state.products, productIds]);

  // ถ่ายภาพยอดในระบบของรุ่นเหล่านี้ตอนเริ่มนับ: ถ่ายจากข้อมูลในเครื่องทันที แล้วดึงข้อมูลล่าสุดจากฐานข้อมูลมาถ่ายซ้ำ
  // เพื่อให้ยอดเริ่มต้นเป็นของจริง ไม่ใช่ข้อมูลเก่าค้างในเครื่อง (ถ่ายเฉพาะรุ่นที่เพิ่งเพิ่ม ไม่ทับยอดเริ่มนับของรุ่นที่นับอยู่แล้ว)
  function snapshotProducts(ids: string[], whId: string, overwrite: boolean) {
    const snap = () => Object.assign({}, ...ids.map((id) => snapshotSystemQty(useStore.getState(), id, whId)));
    setBaseline((prev) => (overwrite ? { ...prev, ...snap() } : { ...snap(), ...prev }));
    void refreshAppData().then(() => setBaseline((prev) => ({ ...prev, ...snap() })));
  }

  function stampCounted(variantIds: string[]) {
    const at = new Date().toISOString();
    setCountedAt((prev) => ({ ...prev, ...Object.fromEntries(variantIds.map((id) => [id, at])) }));
  }

  function includeProducts(ids: string[]) {
    const fresh = ids.filter((id) => !productIds.includes(id));
    if (fresh.length === 0) return;
    setProductIds((prev) => [...prev, ...fresh.filter((id) => !prev.includes(id))]);
    if (warehouseId) snapshotProducts(fresh, warehouseId, false);
  }

  function addProduct(p: Product) {
    includeProducts([p.id]);
    setProductQuery("");
    setProductOpen(false);
  }

  function addAllWithStock() {
    if (!warehouseId) return;
    const withStock = new Set<string>();
    for (const v of Object.values(state.variants)) {
      if ((state.variantStock[`${v.id}::${warehouseId}`]?.qtyOnHand ?? 0) !== 0) withStock.add(v.productId);
    }
    includeProducts([...withStock].sort((a, b) => (state.products[a]?.sellingName ?? "").localeCompare(state.products[b]?.sellingName ?? "", "th")));
  }

  function removeProduct(id: string) {
    const ids = new Set(productVariants(state, id).map((v) => v.id));
    setProductIds((prev) => prev.filter((p) => p !== id));
    setCounts((prev) => Object.fromEntries(Object.entries(prev).filter(([vid]) => !ids.has(vid))));
    setBaseline((prev) => Object.fromEntries(Object.entries(prev).filter(([vid]) => !ids.has(vid))));
    setCountedAt((prev) => Object.fromEntries(Object.entries(prev).filter(([vid]) => !ids.has(vid))));
  }

  function resetAll() {
    setProductIds([]);
    setProductQuery("");
    setCounts({});
    setBaseline({});
    setCountedAt({});
    setScannedTokenIds(new Set());
  }

  // เปลี่ยนคลังกลางคัน: ยอดที่นับไว้เป็นของคลังเดิม ต้องเริ่มนับใหม่ ไม่งั้นจะเอายอดคลังหนึ่งไปปรับอีกคลัง
  function changeWarehouse(id: string) {
    setWarehouseId(id);
    setCounts({});
    setBaseline({});
    setCountedAt({});
    setScannedTokenIds(new Set());
    if (productIds.length > 0 && id) snapshotProducts(productIds, id, true);
  }

  function setCount(variantId: string, raw: string) {
    setCounts((prev) => {
      const next = { ...prev };
      if (raw === "") delete next[variantId];
      else next[variantId] = Math.max(0, Math.floor(Number(raw)) || 0);
      return next;
    });
    if (raw === "") setCountedAt((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== variantId)));
    else stampCounted([variantId]);
  }

  function applyScan(variant: ProductVariant, tokenId: string | undefined) {
    if (tokenId && scannedTokenIds.has(tokenId)) {
      playBeep("duplicate");
      toastError("ใบนี้นับไปแล้วในรอบนับนี้");
      return;
    }
    if (!productIds.includes(variant.productId) && lockToSelected) {
      playBeep("error");
      toastError(
        `สแกนผิดรุ่น — นี่คือ "${state.products[variant.productId]?.sellingName ?? "?"}" ซึ่งไม่อยู่ในรอบนับนี้ (ไม่ได้นับ) ถ้าต้องการนับรุ่นนี้ด้วย ให้เพิ่มรุ่นจากช่องค้นหา หรือปิดการล็อกด้านบน`
      );
      return;
    }
    // ปิดล็อกไว้: สแกนป้ายของรุ่นที่ยังไม่อยู่ในรอบ แล้วเพิ่มรุ่นนั้นเข้ารอบให้เอง (นับพร้อมกันหลายรุ่นได้)
    if (!productIds.includes(variant.productId)) {
      includeProducts([variant.productId]);
      toastSuccess(`เพิ่มรุ่น "${state.products[variant.productId]?.sellingName ?? "?"}" เข้ารอบนับแล้ว`);
    }
    if (tokenId) setScannedTokenIds((prev) => new Set(prev).add(tokenId));
    playBeep("success");
    setCounts((prev) => ({ ...prev, [variant.id]: (prev[variant.id] ?? 0) + 1 }));
    stampCounted([variant.id]);
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

  // ของที่เข้า/ออกของตัวเลือกนี้ในคลังนี้ "หลังจาก" เวลาที่กรอกจำนวนนับ (รวมที่เครื่องอื่นบันทึก เมื่อข้อมูลถูกดึงล่าสุดแล้ว)
  // รายการที่เกิดก่อนเวลานับถือว่าเห็นอยู่ในของบนชั้นตอนนับแล้ว ไม่หักซ้ำ
  function movedAfterCount(movements: Record<string, StockMovement>, variantId: string, atIso: string | undefined): number {
    if (!atIso || !warehouseId) return 0;
    const at = new Date(atIso).getTime();
    let sum = 0;
    for (const m of Object.values(movements)) {
      if (m.variantId !== variantId) continue;
      if (m.warehouseToId !== warehouseId && m.warehouseFromId !== warehouseId) continue;
      if (new Date(m.createdAt).getTime() > at) sum += m.qtyChange;
    }
    return sum;
  }

  // แถวนับของแต่ละรุ่นที่อยู่ในรอบ
  const groups = productIds
    .map((pid) => state.products[pid])
    .filter((p): p is Product => Boolean(p))
    .map((product) => {
      const variants = [...productVariants(state, product.id)].sort((a, b) => a.color.localeCompare(b.color) || compareSizes(a.size, b.size));
      const rows: CountRow[] = variants.map((v) => {
        const system = warehouseId ? getStockLevel(state.variantStock, v.id, warehouseId).qtyOnHand : 0;
        const touched = v.id in counts;
        const counted = counts[v.id] ?? 0;
        const during = touched ? movedAfterCount(state.movements, v.id, countedAt[v.id]) : 0;
        const final = touched ? Math.max(0, counted + during) : system;
        return { variant: v, system, counted, touched, during, final, diff: final - system };
      });
      return { product, rows };
    });
  const allRows = groups.flatMap((g) => g.rows);
  const touchedRows = allRows.filter((r) => r.touched);
  const diffRows = touchedRows.filter((r) => r.diff !== 0);
  // ยอดในระบบเปลี่ยนไปจากตอนเริ่มนับ (มีรับเข้า/เบิกออก/ปรับยอดจากเครื่องอื่นระหว่างที่นับ) — ยอดที่นับได้อาจไม่ตรงกับของจริง ณ ตอนเริ่ม
  const movedRows = touchedRows.filter((r) => r.during !== 0);
  const uncountedRows = allRows.filter((r) => !r.touched);
  const totalSystem = touchedRows.reduce((s, r) => s + r.system, 0);
  const totalCounted = touchedRows.reduce((s, r) => s + r.counted, 0);
  const totalDiff = touchedRows.reduce((sum, r) => sum + r.diff, 0);

  // นับรอบเต็ม: รายการที่หาไม่เจอเลยถือว่ามี 0 ชิ้น (ตั้งให้เป็นนับแล้ว = 0)
  function markAsZero(rows: CountRow[]) {
    setCounts((prev) => ({ ...prev, ...Object.fromEntries(rows.filter((r) => !r.touched).map((r) => [r.variant.id, 0])) }));
    stampCounted(rows.filter((r) => !r.touched).map((r) => r.variant.id));
  }

  // เก็บร่างการนับไว้ในเครื่อง ปิดแอป/สลับแอปแล้วกลับมา ยอดที่นับค้างไว้ไม่หาย (ถามก่อนว่าจะทำต่อไหม)
  const draftValue = useMemo(
    () => ({ warehouseId, productIds, counts, baseline, countedAt, scannedTokenIds: Array.from(scannedTokenIds) }),
    [warehouseId, productIds, counts, baseline, countedAt, scannedTokenIds]
  );
  const draft = useDraft({
    key: user ? `issa-draft:stock-count:${user.id}` : null,
    value: draftValue,
    hasContent: productIds.length > 0 && Object.keys(counts).length > 0,
    onRestore: (v) => {
      // ร่างรุ่นเก่า (นับทีละรุ่น) เก็บเป็น selectedProductId รุ่นเดียว
      const legacy = v as unknown as { selectedProductId?: string | null };
      const ids = (v.productIds ?? (legacy.selectedProductId ? [legacy.selectedProductId] : [])).filter((id) => state.products[id]);
      if (ids.length === 0) {
        toastError("สินค้าในร่างที่เก็บไว้ไม่มีในระบบแล้ว");
        return;
      }
      if (v.warehouseId && activeWarehouses.some((w) => w.id === v.warehouseId)) setWarehouseId(v.warehouseId);
      setProductIds(ids);
      setCounts(Object.fromEntries(Object.entries(v.counts ?? {}).filter(([variantId]) => state.variants[variantId])));
      setScannedTokenIds(new Set(v.scannedTokenIds ?? []));
      // ยอดเริ่มนับเดิมในร่างต้องคงไว้ ถึงจะเห็นว่าระหว่างที่ปิดแอปไป ยอดในระบบเปลี่ยนไหม
      if (v.baseline) setBaseline(v.baseline);
      // เวลาที่กรอกนับ (ร่างรุ่นเก่าไม่มี: ถือว่าไม่มีของเข้า/ออกหลังนับ)
      if (v.countedAt) setCountedAt(v.countedAt);
    },
  });

  // กดบันทึกผลนับ: ดึงยอดล่าสุดจากฐานข้อมูลก่อน (ให้เห็นของที่เข้า/ออกจากเครื่องอื่นระหว่างนับ) แล้วค่อยเปิดหน้าต่างยืนยัน
  async function openConfirm() {
    setChecking(true);
    try {
      await refreshAppData();
    } finally {
      setChecking(false);
    }
    setConfirmOpen(true);
  }

  function handleSave() {
    if (!user || !warehouseId || touchedRows.length === 0) return;
    guard.run(save);
  }

  function save(): "keep" | "release" {
    if (!user || !warehouseId) return "release";
    try {
      const summaryNow = {
        adjusted: diffRows.length,
        matched: touchedRows.length - diffRows.length,
        uncounted: uncountedRows
          .filter((r) => r.system > 0)
          .map((r) => ({ label: `${state.products[r.variant.productId]?.sellingName ?? ""} ${r.variant.color} / ${r.variant.size}`, qty: r.system })),
        totalAfter: allRows.reduce((s, r) => s + (r.touched ? r.final : r.system), 0),
        products: groups.length,
      };
      // รายการที่นับแล้วตรงกับระบบก็บันทึกด้วย (จำนวนไม่เปลี่ยน) เป็นหลักฐานว่าตรวจนับแล้ว ณ เวลานี้ ไม่ใช่แค่ไม่ได้แตะ
      for (const row of touchedRows) {
        const product = state.products[row.variant.productId];
        // ยอดที่ตั้ง = จำนวนที่นับ + ของที่เข้า/ออกหลังนับ คำนวณจากรายการเคลื่อนไหวล่าสุดจริงตอนบันทึก (ไม่ใช่ค่าในหน้าจอที่อาจค้าง)
        const live = getStockLevel(useStore.getState().variantStock, row.variant.id, warehouseId).qtyOnHand;
        const during = movedAfterCount(useStore.getState().movements, row.variant.id, countedAt[row.variant.id]);
        const finalQty = Math.max(0, row.counted + during);
        const moved = during !== 0 ? ` (นับได้ ${row.counted} ${during > 0 ? "+" : "−"} เข้า/ออกหลังนับ ${Math.abs(during)})` : "";
        adjustStock({
          itemType: "product",
          itemId: row.variant.id,
          warehouseId,
          newQty: finalQty,
          reason: (finalQty === live ? `นับสต็อก (ตรงกับระบบ) — ${product?.sellingName ?? row.variant.sku}` : `นับสต็อก — ${product?.sellingName ?? row.variant.sku}`) + moved,
          actorId: user.id,
          actorName: user.name,
        });
      }
      draft.clear();
      toastSuccess(`บันทึกผลการนับแล้ว: ปรับยอด ${diffRows.length} รายการ, ยืนยันยอดที่ตรง ${touchedRows.length - diffRows.length} รายการ`);
      setConfirmOpen(false);
      setSummary(summaryNow);
      setCounts({});
      setCountedAt({});
      setScannedTokenIds(new Set());
      // เริ่มรอบใหม่ต่อได้เลย: ยอดตอนเริ่มนับของรอบใหม่ = ยอดหลังปรับ
      if (productIds.length > 0) snapshotProducts(productIds, warehouseId, true);
      // รอบนับถูกล้างแล้ว กดซ้ำจะไม่มีรายการให้บันทึก จึงปลดล็อกให้เริ่มรอบใหม่ได้
      return "release";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "release";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {draft.draft && (
        <DraftBanner
          savedAt={draft.draft.savedAt}
          summary={`${Object.keys(draft.draft.value.counts ?? {}).length} รายการ`}
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
          <FormField label="เพิ่มรุ่นที่จะนับ" required hint="นับพร้อมกันได้หลายรุ่น เพิ่มรุ่นจากช่องค้นหา (หรือปิดล็อกด้านล่างเพื่อให้สแกนแล้วเพิ่มรุ่นให้เอง)">
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
                      onClick={() => addProduct(p)}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-container)]"
                    >
                      {p.sellingName}
                    </button>
                  ))}
                </div>
              )}
              {productOpen && productQuery.trim() && productResults.length === 0 && (
                <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-on-surface-variant)] shadow-[var(--shadow-micro)]">
                  ไม่พบสินค้าที่ตรงกับคำค้นหา (หรือเพิ่มรุ่นนี้เข้ารอบแล้ว)
                </div>
              )}
            </div>
          </FormField>
          <div className="col-span-2 flex flex-wrap items-center gap-2">
            {productIds.map((pid) => (
              <span key={pid} className="flex items-center gap-1 rounded-lg bg-[var(--color-surface-container)] px-2 py-1 text-xs font-medium">
                {state.products[pid]?.sellingName ?? "?"}
                <button type="button" onClick={() => removeProduct(pid)} aria-label={`เอารุ่น ${state.products[pid]?.sellingName ?? ""} ออกจากรอบนับ`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={addAllWithStock} disabled={!warehouseId}>
              <Plus className="h-3.5 w-3.5" /> เพิ่มทุกรุ่นที่มีสต็อกในคลังนี้
            </Button>
            {productIds.length > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={resetAll}>
                ล้างรอบนับ
              </Button>
            )}
          </div>
          <label htmlFor="sc-lock" className="col-span-2 flex cursor-pointer items-start gap-2 text-sm">
            <input id="sc-lock" type="checkbox" checked={lockToSelected} onChange={(e) => setLockToSelected(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              ล็อกเฉพาะรุ่นที่เลือก
              <span className="block text-xs text-[var(--color-on-surface-variant)]">
                {lockToSelected ? "สแกนป้ายรุ่นอื่นที่ไม่ได้เลือกไว้ จะไม่ถูกนับและมีเสียง/ข้อความเตือน" : "ปิดล็อกอยู่: สแกนป้ายรุ่นไหนก็ได้ ระบบเพิ่มรุ่นนั้นเข้ารอบนับให้เอง"}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {productIds.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={<ClipboardList className="h-10 w-10" />}
              title="เพิ่มรุ่นสินค้าที่จะนับก่อน"
              description="พิมพ์ชื่อรุ่นแล้วเลือกจากรายการด้านบน (เพิ่มได้หลายรุ่น) แล้วค่อยกดสแกน"
            />
            <div className="mt-4 flex justify-center">
              <Button
                disabled={!warehouseId || lockToSelected}
                onClick={() => {
                  primeAudio();
                  setScanning(true);
                }}
                title={lockToSelected ? "เลือกรุ่นก่อน (หรือปิดการล็อกเพื่อสแกนเริ่มรอบนับ)" : undefined}
              >
                <Camera className="h-4 w-4" /> สแกนป้าย
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length > 0 && warehouseId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>รอบนับนี้ {groups.length} รุ่น</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
                นับแล้ว {touchedRows.length} จาก {allRows.length} รายการ
              </p>
              {touchedRows.length > 0 && (
                <p className="mt-1 text-sm">
                  รวมที่นับแล้ว — สต็อกในระบบ <span className="font-semibold text-[var(--color-on-surface)]">{totalSystem}</span> ชิ้น · นับได้จริง{" "}
                  <span className="font-semibold text-[var(--color-on-surface)]">{totalCounted}</span> ชิ้น · ผลต่าง{" "}
                  <span className={`font-semibold ${totalDiff === 0 ? "text-[var(--color-on-surface-variant)]" : totalDiff > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {diffLabel(totalDiff)}
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
            {movedRows.length > 0 && (
              <div role="alert" className="mb-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-container)] p-3 text-sm">
                <p className="font-semibold">หลังจากที่นับ มีของเข้า/ออก {movedRows.length} รายการ</p>
                <p className="mt-0.5 text-xs">
                  ระบบรวมให้เองตอนบันทึก: ยอดที่ตั้ง = จำนวนที่นับ + ของที่เข้า/ออกหลังนับ (เช่น นับได้ 10 แล้วขายออก 2 → ตั้งเป็น 8) ดูตัวเลขในคอลัมน์ &quot;หลังนับเข้า/ออก&quot; และ &quot;ยอดหลังปรับ&quot; ได้
                </p>
              </div>
            )}
            {uncountedRows.length > 0 && touchedRows.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-[var(--color-on-surface-variant)]">ยังไม่ได้นับ {uncountedRows.length} รายการ (ถ้าไม่นับ ยอดเดิมไม่เปลี่ยน)</span>
                <Button size="sm" variant="ghost" onClick={() => markAsZero(allRows)}>
                  ตั้งรายการที่ยังไม่นับเป็น 0
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-6">
              {groups.map(({ product, rows }) => {
                const gTouched = rows.filter((r) => r.touched).length;
                const gUncounted = rows.filter((r) => !r.touched);
                return (
                  <section key={product.id} aria-label={product.sellingName}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-1.5">
                      <h3 className="text-base font-semibold">
                        {product.sellingName} <span className="text-xs font-normal text-[var(--color-on-surface-variant)]">นับแล้ว {gTouched}/{rows.length}</span>
                      </h3>
                      {gUncounted.length > 0 && gTouched > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => markAsZero(rows)}>
                          ตั้งรุ่นนี้ที่ยังไม่นับเป็น 0
                        </Button>
                      )}
                    </div>

                    {/* การ์ดสำหรับจอมือถือ */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      {rows.map(({ variant: v, system, counted, touched, during, final, diff }) => (
                        <div key={v.id} className="rounded-lg border border-[var(--color-border)] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                              <ColorSwatch name={v.color} size={20} />
                              <span className="truncate">
                                {v.color} / {v.size}
                              </span>
                            </span>
                            {touched && diff !== 0 && (
                              <span className={`shrink-0 text-xs font-semibold ${diff > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{diffLabel(diff)}</span>
                            )}
                            {touched && diff === 0 && <span className="shrink-0 text-xs text-[var(--color-on-surface-variant)]">ตรงกัน</span>}
                          </div>
                          <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                            {v.sku} · ในระบบตอนนี้ {system}
                            {touched && during !== 0 && (
                              <span className="font-semibold text-[var(--color-warning)]">
                                {" "}
                                · หลังนับ {diffLabel(during)} → ยอดหลังปรับ {final}
                              </span>
                            )}
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
                            <Th>ในระบบตอนนี้</Th>
                            <Th>นับได้</Th>
                            <Th>หลังนับเข้า/ออก</Th>
                            <Th>ยอดหลังปรับ</Th>
                            <Th>ผลต่าง</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {rows.map(({ variant: v, system, counted, touched, during, final, diff }) => (
                            <Tr key={v.id}>
                              <Td>
                                <span className="flex items-center gap-1.5">
                                  <ColorSwatch name={v.color} size={20} />
                                  {v.color}
                                </span>
                              </Td>
                              <Td>{v.size}</Td>
                              <Td className="font-mono text-xs">{v.sku}</Td>
                              <Td>{system}</Td>
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
                              <Td className={touched && during !== 0 ? "bg-[var(--color-warning-container)] font-semibold" : undefined}>{touched ? (during !== 0 ? diffLabel(during) : "-") : ""}</Td>
                              <Td className="font-semibold">{touched ? final : ""}</Td>
                              <Td>
                                {touched && diff !== 0 && (
                                  <span className={diff > 0 ? "font-semibold text-[var(--color-success)]" : "font-semibold text-[var(--color-danger)]"}>{diffLabel(diff)}</span>
                                )}
                                {touched && diff === 0 && <span className="text-[var(--color-on-surface-variant)]">ตรงกัน</span>}
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </div>
                  </section>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {scanning && <CameraScanner onDetect={handleScan} onClose={() => setScanning(false)} />}

      {productIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* กดบันทึกได้ทันทีที่นับแล้วอย่างน้อย 1 รายการ แม้ทุกรายการจะตรงกับระบบ (ตรงกัน = บันทึกเป็นการยืนยันยอด จำนวนไม่เปลี่ยน) */}
          {touchedRows.length === 0 && (
            <p role="status" className="text-sm text-[var(--color-on-surface-variant)]">
              ยังไม่ได้นับรายการไหนเลย สแกนหรือกรอกจำนวนที่นับได้ก่อน
            </p>
          )}
          <Button onClick={() => void openConfirm()} disabled={touchedRows.length === 0} loading={checking}>
            <ClipboardCheck className="h-4 w-4" /> บันทึกผลการนับ ({touchedRows.length})
          </Button>
        </div>
      )}

      <Dialog
        open={summary !== null}
        onClose={() => setSummary(null)}
        title="สรุปผลการนับสต็อก"
        description={summary ? `${summary.products} รุ่น — ยอดรวมหลังนับ ${summary.totalAfter} ชิ้น` : ""}
        footer={<Button onClick={() => setSummary(null)}>ปิด</Button>}
      >
        {summary && (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              ✓ ปรับยอดตามที่นับ <span className="font-semibold">{summary.adjusted}</span> รายการ (ยอดในระบบตอนนี้เท่ากับที่นับแล้ว)
            </p>
            <p>
              ✓ นับแล้วตรงกับระบบอยู่แล้ว (บันทึกเป็นการยืนยันยอด) <span className="font-semibold">{summary.matched}</span> รายการ
            </p>
            {summary.uncounted.length === 0 ? (
              <p className="rounded-xl bg-[var(--color-success-container)] px-3 py-2 font-medium text-[var(--color-success)]">ทุกรายการที่มีสต็อกถูกนับครบในรอบนี้ ไม่มียอดเก่าค้าง</p>
            ) : (
              <div className="rounded-xl bg-[var(--color-warning-container)] px-3 py-2">
                <p className="font-semibold text-[var(--color-warning)]">
                  ⚠ มี {summary.uncounted.length} รายการที่ไม่ได้นับในรอบนี้แต่ยังมีสต็อกในระบบ (ยังเป็นยอดเดิม ไม่ได้ตรวจกับของจริง)
                </p>
                <ul className="mt-2 max-h-48 list-inside list-disc overflow-y-auto text-xs">
                  {summary.uncounted.map((u) => (
                    <li key={u.label}>
                      {u.label} — ระบบ {u.qty} ชิ้น
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">ถ้านับครบแล้วและของเหล่านี้ไม่มีจริง ให้กลับไปกด &quot;ตั้งรายการที่ยังไม่นับเป็น 0&quot; ก่อนบันทึก ถ้ายังนับไม่ครบ ให้สแกนต่อ</p>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="ยืนยันการปรับสต็อก"
        description={`${groups.length} รุ่น — คลัง ${state.warehouses[warehouseId]?.name ?? ""}`}
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
          ระบบจะตั้งสต็อกของแต่ละรายการ <span className="font-semibold text-[var(--color-on-surface)]">ให้เท่ากับจำนวนที่นับได้ รวมของที่เข้า/ออกหลังนับ</span> (ไม่ใช่บวกเพิ่ม) และบันทึกประวัติทุกรายการที่นับ รายการที่ไม่ได้นับจะไม่ถูกแตะ
        </p>
        <p className="mb-3 text-sm">
          ปรับยอด <span className="font-semibold">{diffRows.length}</span> รายการ · นับแล้วตรงกับระบบ <span className="font-semibold">{touchedRows.length - diffRows.length}</span> รายการ (บันทึกเป็นการยืนยันยอด จำนวนไม่เปลี่ยน)
        </p>
        {movedRows.length > 0 && (
          <p role="alert" className="mb-3 rounded-xl bg-[var(--color-warning-container)] px-3 py-2 text-sm text-[var(--color-warning)]">
            มี {movedRows.length} รายการที่หลังนับมีของเข้า/ออก ระบบรวมให้ในคอลัมน์ &quot;ยอดหลังปรับ&quot; แล้ว ตรวจให้แน่ใจว่าจำนวนที่นับยังถูกต้อง ตรวจให้แน่ใจก่อนว่าจำนวนที่นับได้คือของจริงตอนนี้
          </p>
        )}
        <Table>
          <Thead>
            <Tr>
              <Th>สี / ไซซ์</Th>
              <Th>ในระบบตอนนี้</Th>
              <Th>นับได้</Th>
              <Th>หลังนับเข้า/ออก</Th>
              <Th>ยอดหลังปรับ</Th>
              <Th>ผลต่าง</Th>
            </Tr>
          </Thead>
          <Tbody>
            {groups.map(({ product, rows }) => {
              const changedInGroup = rows.filter((r) => r.touched && r.diff !== 0);
              if (changedInGroup.length === 0) return null;
              return (
                <Fragment key={product.id}>
                  {groups.length > 1 && (
                    <Tr className="bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-container)]">
                      <Td colSpan={6} className="py-2 text-xs font-semibold">
                        {product.sellingName}
                      </Td>
                    </Tr>
                  )}
                  {changedInGroup.map((r) => (
                    <Tr key={r.variant.id}>
                      <Td>
                        {r.variant.color} / {r.variant.size}
                      </Td>
                      <Td>{r.system}</Td>
                      <Td className="font-semibold">{r.counted}</Td>
                      <Td className={r.during !== 0 ? "font-semibold text-[var(--color-warning)]" : undefined}>{r.during !== 0 ? diffLabel(r.during) : "-"}</Td>
                      <Td className="font-semibold">{r.final}</Td>
                      <Td className={r.diff > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>{diffLabel(r.diff)}</Td>
                    </Tr>
                  ))}
                </Fragment>
              );
            })}
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
        description="เพิ่มรุ่นสินค้าที่จะนับ (หลายรุ่นพร้อมกันได้) แล้วสแกน QR ทีละชิ้นเพื่อนับจำนวนจริง เทียบกับระบบและปรับยอดให้ตรง"
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
