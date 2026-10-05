"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PackageMinus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { VariantPicker } from "@/components/stock/VariantPicker";
import { useStore, useActions } from "@/lib/store";
import { checkUnitTokenScan } from "@/lib/store/engine";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";
import { playBeep } from "@/lib/utils/beep";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { MOVEMENT_TYPE_LABEL_TH, SALES_CHANNEL_LABEL_TH, STOCK_OUT_REASONS, type SalesChannel, type UnitToken, type ProductVariant } from "@/lib/types";

interface Line {
  key: string;
  variantId: string;
  qty: number;
  unitPrice: number;
}

function StockOutForm() {
  const state = useStore();
  const { stockOut, recordUnitScanOut } = useActions();
  const user = useCurrentUser();
  const router = useRouter();

  const activeWarehouses = useMemo(() => Object.values(state.warehouses).filter((w) => w.active), [state.warehouses]);

  const brands = useMemo(() => Object.values(state.brands), [state.brands]);

  const [date, setDate] = useState(todayInputValue());
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id ?? "");
  const [brandId, setBrandId] = useState("");
  const [reasonType, setReasonType] = useState<(typeof STOCK_OUT_REASONS)[number]>("sale");
  const [channel, setChannel] = useState<SalesChannel>("shopee");
  const [orderNo, setOrderNo] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [scannedTokensByVariant, setScannedTokensByVariant] = useState<Record<string, string[]>>({});
  const [scanLog, setScanLog] = useState<{ id: string; time: string; label: string; ok: boolean }[]>([]);

  function logScan(label: string, ok: boolean) {
    const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setScanLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, time, label, ok }, ...prev].slice(0, 30));
  }

  const dirty = lines.length > 0 || note.trim().length > 0;
  useUnsavedChangesGuard(dirty);

  function addLine(variantId: string) {
    if (lines.some((l) => l.variantId === variantId)) {
      toastError("เพิ่มรายการนี้ไว้แล้ว");
      return;
    }
    const variant = state.variants[variantId];
    setLines((prev) => [...prev, { key: variantId, variantId, qty: 1, unitPrice: variant?.sellingPrice ?? 0 }]);
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
      toastError("ใบนี้สแกนไปแล้วในรายการนี้");
      logScan(`${label} — สแกนซ้ำ`, false);
      return;
    }
    const check = checkUnitTokenScan(state.unitTokens, token.id, "out");
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
      return [...prev, { key: variant.id, variantId: variant.id, qty: 1, unitPrice: variant.sellingPrice }];
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
  const totalAmount = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);

  function handleSubmit() {
    if (!warehouseId) {
      toastError("กรุณาเลือกคลังที่เบิกออก");
      return;
    }
    if (lines.length === 0) {
      toastError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      stockOut({
        itemType: "product",
        date: dateInputToISO(date),
        warehouseId,
        reasonType,
        actorId: user.id,
        actorName: user.name,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.variantId, qty: l.qty, unitPrice: l.unitPrice })),
        channel: reasonType === "sale" ? channel : undefined,
        orderNo: reasonType === "sale" ? orderNo || undefined : undefined,
        brandId: reasonType === "sale" ? brandId || undefined : undefined,
      });
      for (const tokenIds of Object.values(scannedTokensByVariant)) {
        for (const tokenId of tokenIds) {
          try {
            recordUnitScanOut(tokenId);
          } catch (e) {
            toastError(e instanceof Error ? e.message : "บันทึกสถานะ QR บางใบไม่สำเร็จ");
          }
        }
      }
      toastSuccess("บันทึกการเบิกสินค้าออกเรียบร้อยแล้ว");
      router.replace("/products/all");
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
          <CardTitle>ข้อมูลการเบิกออก</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="วันที่เบิกออก" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="คลังต้นทาง" required>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">เลือกคลัง</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="เหตุผลการเบิกออก" required>
            <Select value={reasonType} onChange={(e) => setReasonType(e.target.value as (typeof STOCK_OUT_REASONS)[number])}>
              {STOCK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {MOVEMENT_TYPE_LABEL_TH[r]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="แบรนด์/ร้าน" hint="กรองรายการสินค้าให้แสดงเฉพาะแบรนด์นี้">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">ทุกแบรนด์</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          {reasonType === "sale" && (
            <>
              <FormField label="ช่องทางการขาย">
                <Select value={channel} onChange={(e) => setChannel(e.target.value as SalesChannel)}>
                  {Object.entries(SALES_CHANNEL_LABEL_TH).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="เลขที่ออเดอร์" hint="เว้นว่างเพื่อสร้างอัตโนมัติ">
                <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
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
          <VariantPicker warehouseId={warehouseId} brandId={brandId || undefined} onSelect={addLine} onScanSku={scanSku} onScanToken={handleScanToken} />

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
            <EmptyState icon={<PackageMinus className="h-10 w-10" />} title="ยังไม่มีรายการสินค้า" description="ค้นหาและเลือกสินค้าด้านบนเพื่อเพิ่มลงในรายการเบิกออก" />
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="flex flex-col gap-2 sm:hidden">
                {lines.map((l) => {
                  const variant = state.variants[l.variantId];
                  const product = variant ? state.products[variant.productId] : undefined;
                  const onHand = warehouseId ? state.variantStock[`${l.variantId}::${warehouseId}`]?.qtyOnHand ?? 0 : 0;
                  const insufficient = l.qty > onHand;
                  return (
                    <div key={l.key} className="rounded-lg border border-[var(--color-border)] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{product?.sellingName}</p>
                          <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                            {variant?.color} / {variant?.size} · {variant?.sku}
                          </p>
                          <p className={`text-xs ${insufficient ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-on-surface-variant)]"}`}>คงเหลือ {formatNumber(onHand)}</p>
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
                            value={l.unitPrice}
                            onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                            className="h-8 px-2 py-1 text-sm"
                          />
                        </div>
                        <p className="h-8 shrink-0 pl-1 pt-1.5 text-sm font-semibold">{formatTHB(l.qty * l.unitPrice)}</p>
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
                      <Th>คงเหลือ</Th>
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
                      const onHand = warehouseId ? state.variantStock[`${l.variantId}::${warehouseId}`]?.qtyOnHand ?? 0 : 0;
                      const insufficient = l.qty > onHand;
                      return (
                        <Tr key={l.key}>
                          <Td>
                            <p className="font-medium">{product?.sellingName}</p>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">
                              {variant?.color} / {variant?.size} · {variant?.sku}
                            </p>
                          </Td>
                          <Td className={insufficient ? "font-semibold text-[var(--color-danger)]" : ""}>{formatNumber(onHand)}</Td>
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
                              value={l.unitPrice}
                              onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                              className="w-28"
                            />
                          </Td>
                          <Td>{formatTHB(l.qty * l.unitPrice)}</Td>
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
                มูลค่ารวม: <span className="font-semibold">{formatTHB(totalAmount)}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.replace("/products/all")}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          บันทึกการเบิกออก
        </Button>
      </div>
    </div>
  );
}

export default function StockOutPage() {
  return (
    <>
      <Header title="เบิกสินค้าออก" description="บันทึกการเบิกสินค้าออกจากคลัง เช่น การขาย ส่งหน้าร้าน หรือสาเหตุอื่น ๆ" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.out">
          <StockOutForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
