"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Wand2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { genSku, genSkuV2, normalizeThaiColor, suggestColorCode } from "@/lib/utils/ids";
import { filterColorOptions, listColorOptions } from "@/lib/utils/colorOptions";
import { SIZE_PRESETS } from "@/lib/utils/sizes";
import { useStore, useActions } from "@/lib/store";
import { toastError } from "@/lib/toast";
import type { Brand } from "@/lib/types";
import { ColorSwatch } from "./ColorSwatch";

export interface DraftVariant {
  key: string;
  color: string;
  colorCode: string;
  size: string;
  sku: string;
  isDefective: boolean;
  purchasePrice: number;
  sellingPrice: number;
  reorderPoint: number;
  storageLocation: string;
}

function buildSku(opts: {
  brand?: Brand;
  modelCode?: string;
  color: string;
  colorCode: string;
  size: string;
  isDefective: boolean;
  productName: string;
  seq: number;
}): string {
  if (opts.brand && opts.modelCode && opts.colorCode) {
    return genSkuV2({ brandCode: opts.brand.code, modelCode: opts.modelCode, colorCode: opts.colorCode, size: opts.size, isDefective: opts.isDefective });
  }
  return genSku({ productName: opts.productName, color: opts.color, size: opts.size, seq: opts.seq });
}

export function VariantMatrixBuilder({
  productName,
  brand,
  modelCode,
  rows,
  onChange,
  defaultPurchasePrice,
  defaultSellingPrice,
  onPendingChange,
}: {
  productName: string;
  brand?: Brand;
  modelCode?: string;
  rows: DraftVariant[];
  onChange: (rows: DraftVariant[]) => void;
  defaultPurchasePrice: number;
  defaultSellingPrice: number;
  // รายชื่อสีที่เลือก/พิมพ์ไว้แล้วแต่ยังไม่ได้กด "สร้างตัวเลือกสี/ไซซ์" (ใช้กันบันทึกแล้วสีหาย)
  onPendingChange?: (pending: string[]) => void;
}) {
  const colorCodes = useStore((s) => s.colorCodes);
  const customSizes = useStore((s) => s.customSizes);
  const { upsertColorCode, upsertCustomSize } = useActions();

  const [colorNameInput, setColorNameInput] = useState("");
  const [colorCodeInput, setColorCodeInput] = useState("");
  const [colors, setColors] = useState<{ name: string; code: string }[]>([]);
  const [sizes, setSizes] = useState<string[]>(["S", "M", "L"]);
  const [customSize, setCustomSize] = useState("");

  const pendingColors = useMemo(() => {
    const have = new Set(rows.map((r) => r.color));
    const names = colors.filter((c) => !have.has(c.name)).map((c) => c.name);
    const typed = colorNameInput.trim();
    if (typed && !have.has(typed) && !names.includes(typed)) names.push(`${typed} (พิมพ์ไว้แต่ยังไม่ได้กดปุ่ม +)`);
    return names;
  }, [rows, colors, colorNameInput]);
  const pendingKey = pendingColors.join("\u0000");
  useEffect(() => {
    onPendingChange?.(pendingKey ? pendingKey.split("\u0000") : []);
  }, [pendingKey, onPendingChange]);

  const [showAllColors, setShowAllColors] = useState(false);
  const colorOptions = useMemo(() => listColorOptions(colorCodes), [colorCodes]);
  const colorSuggestions = useMemo(() => {
    const used = new Set(colors.map((c) => normalizeThaiColor(c.name)));
    return filterColorOptions(colorOptions, colorNameInput, used, showAllColors || colorNameInput.trim() ? 60 : 12);
  }, [colorOptions, colorNameInput, colors, showAllColors]);

  const customSizeSuggestions = useMemo(() => {
    const used = new Set(sizes);
    return Object.values(customSizes)
      .filter((s) => !used.has(s.label))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [customSizes, sizes]);

  function addColorEntry(name: string, code: string) {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!trimmedName) {
      toastError("กรุณาระบุชื่อสี");
      return;
    }
    if (colors.some((c) => c.name === trimmedName)) {
      toastError("มีสีนี้อยู่แล้ว");
      return;
    }
    let finalCode = trimmedCode;
    if (!finalCode) {
      const existing = Object.values(colorCodes).find((c) => c.thaiName === trimmedName);
      finalCode = existing ? existing.code : suggestColorCode(trimmedName, colorCodes);
    }
    try {
      upsertColorCode(finalCode, trimmedName);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return;
    }
    setColors((prev) => [...prev, { name: trimmedName, code: finalCode }]);
    setColorNameInput("");
    setColorCodeInput("");
  }

  function toggleSize(s: string) {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function addCustomSize() {
    const s = customSize.trim();
    if (!s) return;
    if (sizes.includes(s)) {
      toastError("มีไซซ์นี้อยู่แล้ว");
      return;
    }
    try {
      upsertCustomSize(s);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return;
    }
    setSizes((prev) => [...prev, s]);
    setCustomSize("");
  }

  function generate() {
    if (colors.length === 0 || sizes.length === 0) {
      toastError("กรุณาระบุสีและไซซ์อย่างน้อย 1 รายการ");
      return;
    }
    const next = [...rows];
    let seq = rows.length + 1;
    for (const color of colors) {
      for (const size of sizes) {
        if (next.some((r) => r.color === color.name && r.size === size)) continue;
        next.push({
          key: `${color.name}-${size}-${Date.now()}-${seq}`,
          color: color.name,
          colorCode: color.code,
          size,
          sku: buildSku({ brand, modelCode, color: color.name, colorCode: color.code, size, isDefective: false, productName, seq }),
          isDefective: false,
          purchasePrice: defaultPurchasePrice,
          sellingPrice: defaultSellingPrice,
          reorderPoint: 5,
          storageLocation: "",
        });
        seq += 1;
      }
    }
    onChange(next);
  }

  function updateRow(key: string, patch: Partial<DraftVariant>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleDefective(key: string) {
    const idx = rows.findIndex((r) => r.key === key);
    if (idx === -1) return;
    const row = rows[idx];
    const isDefective = !row.isDefective;
    const sku = buildSku({
      brand,
      modelCode,
      color: row.color,
      colorCode: row.colorCode,
      size: row.size,
      isDefective,
      productName,
      seq: idx + 1,
    });
    updateRow(key, { isDefective, sku });
  }

  function regenerateAllSkus() {
    onChange(
      rows.map((r, idx) => ({
        ...r,
        sku: buildSku({ brand, modelCode, color: r.color, colorCode: r.colorCode, size: r.size, isDefective: r.isDefective, productName, seq: idx + 1 }),
      }))
    );
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  const rowGroups = useMemo(() => {
    const map = new Map<string, DraftVariant[]>();
    for (const r of rows) {
      if (!map.has(r.color)) map.set(r.color, []);
      map.get(r.color)!.push(r);
    }
    return Array.from(map.entries()).map(([color, groupRows]) => ({ color, rows: groupRows }));
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="สี" hint="พิมพ์ชื่อสีแล้วกดเพิ่มได้เลย ไม่ต้องใส่รหัส ระบบสร้างให้อัตโนมัติ (แก้เองได้ถ้าต้องการ)">
          <div className="flex gap-2">
            <Input
              value={colorNameInput}
              onChange={(e) => setColorNameInput(e.target.value)}
              placeholder="ชื่อสี เช่น ดำ, ครีม"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addColorEntry(colorNameInput, colorCodeInput);
                }
              }}
            />
            <Input
              value={colorCodeInput}
              onChange={(e) => setColorCodeInput(e.target.value.toUpperCase())}
              placeholder="ไม่บังคับ"
              className="w-24"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addColorEntry(colorNameInput, colorCodeInput);
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={() => addColorEntry(colorNameInput, colorCodeInput)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {colorSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {colorSuggestions.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => addColorEntry(c.name, c.code)}
                  className="rounded-lg border border-dashed border-[var(--color-border-strong)] px-2 py-1 text-xs text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
                >
                  {c.name} ({c.code})
                </button>
              ))}
              {!colorNameInput.trim() && !showAllColors && (
                <button type="button" onClick={() => setShowAllColors(true)} className="px-2 py-1 text-xs font-medium text-[var(--color-primary-container)]">
                  ดูสีทั้งหมด
                </button>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <span key={c.name} className="flex items-center gap-1 rounded-lg bg-[var(--color-surface-container)] px-2 py-1 text-xs">
                {c.name} ({c.code})
                <button type="button" onClick={() => setColors(colors.filter((x) => x.name !== c.name))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </FormField>

        <FormField label="ไซซ์">
          <div className="flex flex-wrap gap-1.5">
            {SIZE_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  sizes.includes(s) ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              placeholder="ไซซ์อื่น ๆ เช่น 28, 30, Free Size"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSize())}
            />
            <Button type="button" variant="secondary" onClick={addCustomSize}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {customSizeSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {customSizeSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSizes((prev) => [...prev, s.label])}
                  className="rounded-lg border border-dashed border-[var(--color-border-strong)] px-2 py-1 text-xs text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary-container)] hover:text-[var(--color-primary-container)]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {sizes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <span key={s} className="flex items-center gap-1 rounded-lg bg-[var(--color-surface-container)] px-2 py-1 text-xs">
                  {s}
                  <button type="button" onClick={() => setSizes(sizes.filter((x) => x !== s))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </FormField>
      </div>

      {pendingColors.length > 0 && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ยังไม่ได้สร้างตัวเลือกของสี: <b>{pendingColors.join(", ")}</b> — กดปุ่ม &quot;สร้างตัวเลือกสี/ไซซ์&quot; ก่อน ไม่งั้นสีเหล่านี้จะไม่ถูกบันทึก
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={generate} className="w-fit">
          <Wand2 className="h-4 w-4" /> สร้างตัวเลือกสี/ไซซ์
        </Button>
        {rows.length > 0 && (
          <Button type="button" variant="ghost" onClick={regenerateAllSkus} className="w-fit">
            <RefreshCw className="h-4 w-4" /> สร้าง SKU ใหม่ทั้งหมด
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <Table>
          <Thead>
            <Tr>
              <Th>สี</Th>
              <Th>ไซซ์</Th>
              <Th>มีตำหนิ</Th>
              <Th>SKU</Th>
              <Th>ราคาซื้อ</Th>
              <Th>ราคาขาย</Th>
              <Th>จุดแจ้งเตือน</Th>
              <Th>ตำแหน่งจัดเก็บ</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {rowGroups.map((group) => (
              group.rows.map((r, idx) => (
                <Tr key={r.key} className={idx === 0 ? "border-t-2 border-t-[var(--color-border-strong)]" : undefined}>
                  {idx === 0 && (
                    <Td rowSpan={group.rows.length} className="align-top">
                      <div className="flex items-center gap-2">
                        <ColorSwatch name={group.color} size={32} />
                        <span className="font-medium">{group.color}</span>
                      </div>
                    </Td>
                  )}
                  <Td>{r.size}</Td>
                  <Td>
                    <input type="checkbox" checked={r.isDefective} onChange={() => toggleDefective(r.key)} className="h-4 w-4" />
                  </Td>
                  <Td>
                    <Input value={r.sku} onChange={(e) => updateRow(r.key, { sku: e.target.value })} className="w-44 font-mono text-xs" />
                  </Td>
                  <Td>
                    <Input type="number" min={0} value={r.purchasePrice} onChange={(e) => updateRow(r.key, { purchasePrice: Number(e.target.value) })} className="w-24" />
                  </Td>
                  <Td>
                    <Input type="number" min={0} value={r.sellingPrice} onChange={(e) => updateRow(r.key, { sellingPrice: Number(e.target.value) })} className="w-24" />
                  </Td>
                  <Td>
                    <Input type="number" min={0} value={r.reorderPoint} onChange={(e) => updateRow(r.key, { reorderPoint: Number(e.target.value) })} className="w-20" />
                  </Td>
                  <Td>
                    <Input value={r.storageLocation} onChange={(e) => updateRow(r.key, { storageLocation: e.target.value })} className="w-28" />
                  </Td>
                  <Td>
                    <button type="button" onClick={() => removeRow(r.key)} className="text-[var(--color-danger)]">
                      <X className="h-4 w-4" />
                    </button>
                  </Td>
                </Tr>
              ))
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
