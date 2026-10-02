"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Camera } from "lucide-react";
import { useStore, useActions } from "@/lib/store";
import { getStockLevel } from "@/lib/store/engine";
import { resolveUnitToken } from "@/lib/store/selectors";
import { Input } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { ColorSwatch } from "@/components/products/ColorSwatch";
import { formatNumber } from "@/lib/utils/money";
import { compareSizes } from "@/lib/utils/sizes";
import { playBeep, primeAudio } from "@/lib/utils/beep";
import { CameraScanner } from "./CameraScanner";
import { toastError, toastSuccess } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { fetchUnitTokenById } from "@/lib/supabase/fetch";
import type { UnitToken, ProductVariant, Product } from "@/lib/types";

export function VariantPicker({
  warehouseId,
  brandId,
  onSelect,
  onSelectMany,
  onScanSku,
  onScanToken,
  placeholder = "ค้นหาสินค้าด้วยชื่อ สี ไซซ์ หรือ SKU / สแกนบาร์โค้ด...",
}: {
  warehouseId?: string;
  brandId?: string;
  onSelect: (variantId: string) => void;
  // ถ้าส่งมา หน้าต่างเลือกไซซ์จะมีช่องติ๊ก "เลือกทุกไซซ์ของสีนี้" เพิ่มทั้งสีในครั้งเดียว
  // คืนจำนวนที่เพิ่มเข้ารายการจริง (ข้ามตัวที่มีในรายการอยู่แล้ว) เพื่อใช้แสดงข้อความแจ้ง
  onSelectMany?: (variantIds: string[]) => number;
  // เรียกเมื่อ "สแกน/ยิง" บาร์โค้ด SKU (เครื่องยิงพิมพ์ SKU + Enter หรือกล้อง) ต่างจากการเลือกจากรายการ
  // บาร์โค้ดทุกชิ้นของตัวเลือกเดียวกันเป็นรหัสเดียวกัน หน้าที่ใช้อาจนับเป็น +1 ได้ ถ้าไม่ส่งมาจะใช้ onSelect เหมือนเดิม
  onScanSku?: (variantId: string) => void;
  // เรียกเมื่อสแกนได้ป้าย QR ที่มีรหัสเฉพาะตัว (ต่อชิ้นจริง) — ถ้าไม่ส่งมาจะ fallback ไปที่ onSelect แบบเดิม
  onScanToken?: (token: UnitToken, variant: ProductVariant) => void;
  placeholder?: string;
}) {
  const state = useStore();
  const { mergeUnitTokens } = useActions();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pickerGroup, setPickerGroup] = useState<{ product: Product; variants: ProductVariant[] } | null>(null);
  const [pickerColor, setPickerColor] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  function findBySku(sku: string) {
    const scanned = sku.trim().toLowerCase();
    if (!scanned) return undefined;
    return Object.values(state.variants).find((v) => v.active && v.sku.toLowerCase() === scanned);
  }

  function fireToken(token: UnitToken, variant: ProductVariant) {
    if (onScanToken) {
      onScanToken(token, variant);
    } else {
      onSelect(variant.id);
      playBeep("success");
      toastSuccess(`เพิ่ม ${state.products[variant.productId]?.sellingName ?? variant.sku} แล้ว`);
    }
  }

  async function handleCameraDetect(value: string) {
    const trimmed = value.trim();
    const resolved = resolveUnitToken(state, trimmed);
    if (resolved) {
      fireToken(resolved.token, resolved.variant);
      return;
    }

    const bySku = findBySku(value);
    if (bySku) {
      (onScanSku ?? onSelect)(bySku.id);
      playBeep("success");
      toastSuccess(`เพิ่ม ${state.products[bySku.productId]?.sellingName ?? bySku.sku} แล้ว`);
      return;
    }

    // อาจเป็นป้ายที่เพิ่งปริ้นจากอุปกรณ์/แท็บอื่น ซึ่งเครื่องนี้ยังไม่มีข้อมูล (โหลด state ครั้งเดียวตอนเปิดแอป
    // ไม่ได้ sync แบบเรียลไทม์ข้ามอุปกรณ์) ลองถามฐานข้อมูลตรง ๆ เฉพาะโทเคนนี้ก่อนจะสรุปว่าไม่พบ
    const fetchedToken = await fetchUnitTokenById(createClient(), trimmed);
    const fetchedVariant = fetchedToken ? state.variants[fetchedToken.variantId] : undefined;
    if (fetchedToken && fetchedVariant) {
      mergeUnitTokens([fetchedToken]);
      fireToken(fetchedToken, fetchedVariant);
      return;
    }

    playBeep("error");
    toastError(`ไม่พบสินค้าที่ตรงกับ "${value}"`);
  }

  // จัดกลุ่มผลค้นหาตามรุ่นสินค้า (1 รุ่น = 1 แถว) แทนที่จะแตกเป็นทุกสี/ไซซ์ ป้องกันลิสต์ยาวจนหาไม่เจอ
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // all = ทุกตัวเลือกของรุ่นนั้น ส่วน variants = เฉพาะที่ตรงกับคำค้น
    // หน้าต่างเลือกสี/ไซซ์ต้องโชว์ครบทุกสีของรุ่น (all) ไม่ใช่เฉพาะสีที่ตรงกับคำที่พิมพ์ค้นหา
    const allByProduct = new Map<string, ProductVariant[]>();
    for (const v of Object.values(state.variants)) {
      if (!v.active) continue;
      if (!allByProduct.has(v.productId)) allByProduct.set(v.productId, []);
      allByProduct.get(v.productId)!.push(v);
    }
    const groups = new Map<string, { product: Product; variants: ProductVariant[]; all: ProductVariant[] }>();
    for (const v of Object.values(state.variants)) {
      if (!v.active) continue;
      const product = state.products[v.productId];
      if (!product) continue;
      if (brandId && product.brandId !== brandId) continue;
      const matches =
        product.sellingName.toLowerCase().includes(q) ||
        v.color.toLowerCase().includes(q) ||
        v.size.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q);
      if (!matches) continue;
      if (!groups.has(product.id)) groups.set(product.id, { product, variants: [], all: allByProduct.get(product.id) ?? [] });
      groups.get(product.id)!.variants.push(v);
    }
    return Array.from(groups.values()).slice(0, 20);
  }, [query, state, brandId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openPicker(group: { product: Product; variants: ProductVariant[]; all: ProductVariant[] }) {
    // เลือกสีแรกที่ตรงกับคำค้นไว้ให้ก่อน แต่แสดงครบทุกสีของรุ่น
    setPickerColor(group.variants[0]?.color ?? group.all[0]?.color ?? null);
    setPickerGroup({ product: group.product, variants: group.all });
    setAddedIds(new Set());
    setOpen(false);
  }

  function closePicker() {
    setPickerGroup(null);
    setQuery("");
  }

  function colorImageFor(product: Product, color: string) {
    return (
      product.images.find((i) => i.kind === "selling" && i.color === color && i.isMain) ??
      product.images.find((i) => i.kind === "selling" && i.color === color)
    );
  }

  const pickerColors = pickerGroup ? Array.from(new Set(pickerGroup.variants.map((v) => v.color))) : [];
  const pickerSizeRows = pickerGroup
    ? [...pickerGroup.variants].filter((v) => v.color === pickerColor).sort((a, b) => compareSizes(a.size, b.size))
    : [];
  const allSizesAdded = pickerSizeRows.length > 0 && pickerSizeRows.every((v) => addedIds.has(v.id));

  function addAllSizes() {
    if (!pickerGroup || !onSelectMany || allSizesAdded) return;
    const pending = pickerSizeRows.filter((v) => !addedIds.has(v.id)).map((v) => v.id);
    const added = onSelectMany(pending);
    setAddedIds((prev) => new Set([...prev, ...pending]));
    toastSuccess(
      added > 0
        ? `เพิ่ม ${pickerGroup.product.sellingName} สี${pickerColor} ทุกไซซ์ (${added} ไซซ์) แล้ว`
        : `ทุกไซซ์ของสี${pickerColor} อยู่ในรายการแล้ว`
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const exact = findBySku(query);
            if (exact) {
              e.preventDefault();
              (onScanSku ?? onSelect)(exact.id);
              setQuery("");
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="pl-9 pr-10"
        />
        <button
          type="button"
          onClick={() => {
            primeAudio();
            setScanning(true);
          }}
          title="สแกนด้วยกล้องมือถือ"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>
      {scanning && (
        <CameraScanner
          onDetect={handleCameraDetect}
          onClose={() => setScanning(false)}
        />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-[var(--shadow-micro)]">
          {results.map(({ product, variants, all }) => {
            const totalStock = warehouseId
              ? variants.reduce((sum, v) => sum + getStockLevel(state.variantStock, v.id, warehouseId).qtyOnHand, 0)
              : undefined;
            const colorCount = new Set(variants.map((v) => v.color)).size;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => openPicker({ product, variants, all })}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-surface-container)]"
              >
                <span>
                  <span className="block font-medium text-[var(--color-on-surface)]">{product.sellingName}</span>
                  <span className="block text-xs text-[var(--color-on-surface-variant)]">
                    {colorCount} สี · {variants.length} ตัวเลือก
                  </span>
                </span>
                {totalStock !== undefined && (
                  <span className="shrink-0 text-xs font-medium text-[var(--color-on-surface-variant)]">คงเหลือ {formatNumber(totalStock)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-on-surface-variant)] shadow-[var(--shadow-micro)]">
          ไม่พบสินค้าที่ตรงกับคำค้นหา
        </div>
      )}

      <Dialog open={Boolean(pickerGroup)} onClose={closePicker} title={pickerGroup?.product.sellingName ?? ""} size="sm">
        {pickerGroup && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-on-surface)]">สี</p>
              <div className="flex flex-wrap gap-3">
                {pickerColors.map((c) => (
                  <button key={c} type="button" onClick={() => setPickerColor(c)} className="flex flex-col items-center gap-1">
                    <span className={`rounded-lg ${pickerColor === c ? "ring-2 ring-[var(--color-primary-container)]" : ""}`}>
                      <ColorSwatch name={c} imageUrl={colorImageFor(pickerGroup.product, c)?.url} size={44} />
                    </span>
                    <span className="max-w-[56px] truncate text-[11px] text-[var(--color-on-surface-variant)]">{c}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-on-surface)]">ไซซ์ — แตะเพื่อเพิ่ม (เลือกได้หลายไซซ์/สี ค่อยกดปิดเองตอนเสร็จ)</p>
              {onSelectMany && pickerSizeRows.length > 1 && (
                <label
                  htmlFor="picker-select-all-sizes"
                  className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                    allSizesAdded
                      ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary-container)]"
                      : "cursor-pointer border-[var(--color-border)] text-[var(--color-on-surface)] hover:border-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
                  }`}
                >
                  <input
                    id="picker-select-all-sizes"
                    type="checkbox"
                    checked={allSizesAdded}
                    disabled={allSizesAdded}
                    onChange={addAllSizes}
                    className="h-4 w-4 accent-[var(--color-primary-container)]"
                  />
                  <span>
                    เลือกทุกไซซ์ของสี{pickerColor} ({pickerSizeRows.length} ไซซ์)
                    {allSizesAdded && <span className="ml-1 text-xs font-normal">— เพิ่มครบแล้ว ลบออกได้ในรายการด้านล่าง</span>}
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                {pickerSizeRows.map((v) => {
                  const stock = warehouseId ? getStockLevel(state.variantStock, v.id, warehouseId) : undefined;
                  const added = addedIds.has(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (added) return;
                        onSelect(v.id);
                        setAddedIds((prev) => new Set(prev).add(v.id));
                        toastSuccess(`เพิ่ม ${pickerGroup.product.sellingName} ${v.color}/${v.size} แล้ว`);
                      }}
                      className={`flex flex-col items-center rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        added
                          ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary-container)]"
                          : "border-[var(--color-border)] text-[var(--color-on-surface)] hover:border-[var(--color-primary-container)] hover:bg-[var(--color-surface-container)]"
                      }`}
                    >
                      {added ? "✓ " : ""}
                      {v.size}
                      {stock && <span className="text-[10px] font-normal text-[var(--color-on-surface-variant)]">คงเหลือ {formatNumber(stock.qtyOnHand)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={closePicker} className="text-sm font-medium text-[var(--color-primary-container)] hover:underline">
                เสร็จแล้ว ปิดหน้าต่างนี้
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
