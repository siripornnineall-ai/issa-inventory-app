"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { createClient } from "@/lib/supabase/client";
import { fetchUnitTokenById } from "@/lib/supabase/fetch";
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

  function selectProduct(p: Product) {
    setSelectedProductId(p.id);
    setProductQuery(p.sellingName);
    setProductOpen(false);
    setCounts({});
    setScannedTokenIds(new Set());
  }

  function resetProduct() {
    setSelectedProductId(null);
    setProductQuery("");
    setCounts({});
    setScannedTokenIds(new Set());
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
    const fetchedToken = await fetchUnitTokenById(createClient(), trimmed);
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
    return { variant: v, system, counted, touched, diff: counted - system };
  });
  const touchedCount = rows.filter((r) => r.touched).length;
  const diffRows = rows.filter((r) => r.touched && r.diff !== 0);
  const touchedRows = rows.filter((r) => r.touched);
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
      <Card>
        <CardHeader>
          <CardTitle>เริ่มนับสต็อก</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4">
          <FormField label="คลังที่นับ" required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
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
            {/* การ์ดสำหรับจอมือถือ */}
            <div className="flex flex-col gap-2 sm:hidden">
              {rows.map(({ variant: v, system, counted, touched, diff }) => (
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
                  <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{v.sku} · สต็อกในระบบ {system}</p>
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
                    <Th>สต็อกในระบบ</Th>
                    <Th>นับได้</Th>
                    <Th>ผลต่าง</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map(({ variant: v, system, counted, touched, diff }) => (
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
        <Table>
          <Thead>
            <Tr>
              <Th>สี / ไซซ์</Th>
              <Th>เดิม</Th>
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
                <Td>{r.system}</Td>
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
          <Link href="/products/all" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Link>
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
