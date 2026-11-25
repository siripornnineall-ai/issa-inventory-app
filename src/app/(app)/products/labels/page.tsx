"use client";

import { useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { ArrowLeft, Printer, Trash2, Barcode as Barcode2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { VariantPicker } from "@/components/stock/VariantPicker";
import { PrintableQrLabels, type PrintLabelItem } from "@/components/products/PrintableQrLabels";
import { LabelCalibrationPanel } from "@/components/products/LabelCalibrationPanel";
import { BulkQtyControl } from "@/components/products/BulkQtyControl";
import { useStore, useActions } from "@/lib/store";
import { useLabelCalibration } from "@/lib/utils/labelCalibration";
import { preloadImages } from "@/lib/utils/preloadImages";
import { toastError } from "@/lib/toast";
import { buildPrintLogos } from "@/lib/utils/printLogo";
import type { UnitToken } from "@/lib/types";

interface CartLine {
  key: string;
  variantId: string;
  qty: number;
  price?: number; // ราคาป้าย Sale ของรายการนี้ (ว่าง = ยังไม่ใส่)
}

export default function PrintLabelsBatchPage() {
  const state = useStore();
  const { mintUnitTokens } = useActions();
  const { calibration, update: updateCalibration, reset: resetCalibration } = useLabelCalibration();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [printBatch, setPrintBatch] = useState<PrintLabelItem[] | null>(null);
  const [minting, setMinting] = useState(false);
  const [saleMode, setSaleMode] = useState(false); // ป้าย Sale: แสดงราคาแทนสี/ไซซ์
  const [bulkPrice, setBulkPrice] = useState("");

  useEffect(() => {
    if (!printBatch || printBatch.length === 0) return;
    let cancelled = false;
    preloadImages(printBatch.map((b) => b.brandLogoUrl)).then(() => {
      if (!cancelled) requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelled = true;
    };
  }, [printBatch]);

  function addLine(variantId: string) {
    if (cart.some((l) => l.variantId === variantId)) {
      toastError("เพิ่มรุ่นนี้ไว้ในรายการแล้ว ปรับจำนวนในรายการด้านล่างได้เลย");
      return;
    }
    setCart((prev) => [...prev, { key: variantId, variantId, qty: 1 }]);
  }

  // เพิ่มหลายตัวเลือกพร้อมกัน (ช่องติ๊ก "เลือกทุกไซซ์ของสีนี้") ข้ามตัวที่อยู่ในรายการแล้วเงียบ ๆ แทนการเด้ง error ทีละตัว
  function addLines(variantIds: string[]): number {
    const inCart = new Set(cart.map((l) => l.variantId));
    const fresh = variantIds.filter((id) => !inCart.has(id));
    if (fresh.length === 0) return 0;
    setCart((prev) => {
      const have = new Set(prev.map((l) => l.variantId));
      return [...prev, ...fresh.filter((id) => !have.has(id)).map((id) => ({ key: id, variantId: id, qty: 1 }))];
    });
    return fresh.length;
  }

  function updateQty(key: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
  }

  function updatePrice(key: string, raw: string) {
    const n = Number(raw);
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, price: raw.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n } : l)));
  }

  // ป้าย Sale: รุ่นเดียวกันพิมพ์ได้หลายราคา เพิ่มบรรทัดใหม่ของรุ่นเดิมให้ใส่ราคา/จำนวนใบแยก (รหัสป้ายยังสร้างใหม่ทุกใบ)
  function addPriceLine(key: string) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      if (i < 0) return prev;
      const copy: CartLine = { key: `${prev[i].variantId}#${Date.now().toString(36)}${prev.length}`, variantId: prev[i].variantId, qty: 1 };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const totalQty = cart.reduce((sum, l) => sum + (l.qty > 0 ? l.qty : 0), 0);

  async function handlePrint() {
    setMinting(true);
    try {
      const batch: PrintLabelItem[] = [];
      if (saleMode) {
        const missing = cart.findIndex((l) => l.qty > 0 && !(l.price !== undefined && l.price >= 0));
        if (missing >= 0) {
          toastError(`รายการที่ ${missing + 1} ยังไม่ได้ใส่ราคา (ป้าย Sale ต้องมีราคาทุกใบ)`);
          return;
        }
      }
      for (const line of cart) {
        if (line.qty <= 0) continue;
        const variant = state.variants[line.variantId];
        const product = variant ? state.products[variant.productId] : undefined;
        if (!variant || !product) continue;
        const brand = product.brandId ? state.brands[product.brandId] : undefined;
        // ทั้งบาร์โค้ดและ QR สร้างรหัสเฉพาะใบใหม่ทุกครั้งที่พิมพ์ (บาร์โค้ดใช้รหัสสั้น 8 ตัว QR ใช้ id เต็ม)
        const tokens: UnitToken[] = mintUnitTokens(line.variantId, line.qty);
        for (const token of tokens) batch.push({ product, variant, token, brandLogoUrl: brand?.logoUrl, salePrice: saleMode ? line.price : undefined });
      }
      if (batch.length === 0) {
        toastError("กรุณาเพิ่มรุ่นสินค้าและระบุจำนวนอย่างน้อย 1 ใบ");
        return;
      }
      // เครื่องพิมพ์ฉลากพิมพ์ได้แค่ขาวดำ: แปลงโลโก้กลาง QR เป็นขาวดำที่ตัดกันชัด ไม่งั้นโลโก้พื้นสีอ่อนจะกลายเป็นช่องว่าง
      let finalBatch = batch;
      if (calibration.paper === "roll" && batch.some((b) => b.token && b.brandLogoUrl)) {
        const logos = await buildPrintLogos(batch.map((b) => b.brandLogoUrl));
        finalBatch = batch.map((b) => (b.brandLogoUrl ? { ...b, brandLogoUrl: logos.get(b.brandLogoUrl) ?? b.brandLogoUrl } : b));
      }
      setPrintBatch(finalBatch);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="qr-print-root pt-safe mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <BackLink href="/products" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </BackLink>
        <Button onClick={handlePrint} disabled={totalQty === 0} loading={minting}>
          <Printer className="h-4 w-4" /> พิมพ์ป้าย ({totalQty} ใบ)
        </Button>
      </div>

      <h1 className="mb-1 text-lg font-semibold print:hidden">พิมพ์บาร์โค้ด — หลายรุ่นพร้อมกัน</h1>
      <p className="mb-4 text-xs text-[var(--color-on-surface-variant)] print:hidden">
        ค้นหาแต่ละรุ่น เลือกสี/ไซซ์ แล้วใส่จำนวนที่ต้องการ ทำซ้ำได้หลายรุ่น แล้วพิมพ์รวมกันในครั้งเดียว <b>ต้องการกี่ใบให้ใส่จำนวนใบในช่องด้านล่าง ห้ามใช้ตัวเลือกจำนวนสำเนา (Copies) ของเครื่องพิมพ์</b> เพราะสำเนาจะมีรหัสเดียวกันและสแกนซ้ำไม่ได้
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4 print:hidden">
        <p className="text-sm font-medium">ค้นหารุ่นสินค้าที่ต้องการเพิ่ม</p>
        <VariantPicker onSelect={addLine} onSelectMany={addLines} placeholder="ค้นหาสินค้าด้วยชื่อรุ่น..." />
      </div>

      <div className="print:hidden">
        {cart.length === 0 ? (
          <EmptyState icon={<Barcode2 className="h-10 w-10" />} title="ยังไม่มีรุ่นในรายการ" description="ค้นหาสินค้าด้านบนแล้วเลือกสี/ไซซ์เพื่อเพิ่มลงรายการพิมพ์" />
        ) : (
          <>
            <BulkQtyControl className="mb-3" onApply={(qty) => setCart((prev) => prev.map((l) => ({ ...l, qty })))} />
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={saleMode} onChange={(e) => setSaleMode(e.target.checked)} />
                ป้าย Sale (แสดงราคาแทนสี/ไซซ์ เช่น สินค้าตัวอย่างที่เอามาขาย)
              </label>
              {saleMode && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[var(--color-on-surface-variant)]">ราคาเดียวกันทุกรายการ</span>
                  <Input type="number" min={0} value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="บาท" aria-label="ราคาเดียวกันทุกรายการ" className="h-8 w-28 px-2 py-1" />
                  <Button type="button" size="sm" variant="secondary" disabled={bulkPrice.trim() === ""} onClick={() => setCart((prev) => prev.map((l) => ({ ...l, price: Number(bulkPrice) >= 0 ? Number(bulkPrice) : l.price })))}>
                    ใส่ให้ทุกรายการ
                  </Button>
                  <span className="text-xs text-[var(--color-on-surface-variant)]">หรือใส่ราคาแยกแต่ละรายการในช่องด้านล่าง</span>
                </div>
              )}
            </div>
            {/* การ์ดสำหรับจอมือถือ */}
            <div className="mb-6 flex flex-col gap-2 sm:hidden">
              {cart.map((line) => {
                const variant = state.variants[line.variantId];
                const product = variant ? state.products[variant.productId] : undefined;
                return (
                  <div key={line.key} className="rounded-lg border border-[var(--color-border)] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{product?.sellingName}</p>
                        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                          {variant?.color} / {variant?.size} · {variant?.sku}
                        </p>
                      </div>
                      <button onClick={() => removeLine(line.key)} className="shrink-0 text-[var(--color-danger)]" aria-label="ลบรายการ">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5">
                      <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">จำนวนใบที่พิมพ์</label>
                      <Input
                        type="number"
                        min={0}
                        value={line.qty}
                        onChange={(e) => updateQty(line.key, Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                        aria-label="จำนวนใบที่พิมพ์"
                        className="h-8 w-24 px-2 py-1 text-sm"
                      />
                    </div>
                    {saleMode && (
                      <div className="mt-1.5">
                        <label className="mb-0.5 block text-[10px] text-[var(--color-on-surface-variant)]">ราคา Sale (บาท)</label>
                        <div className="flex items-center gap-2">
                          <Input type="number" min={0} value={line.price ?? ""} onChange={(e) => updatePrice(line.key, e.target.value)} aria-label="ราคา Sale" className="h-8 w-28 px-2 py-1 text-sm" />
                          <button type="button" onClick={() => addPriceLine(line.key)} className="text-xs text-[var(--color-primary)] underline">
                            + อีกราคา
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ตารางสำหรับจอกว้าง */}
            <div className="mb-6 hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    <Th>สินค้า</Th>
                    <Th>จำนวนใบที่พิมพ์</Th>
                    {saleMode && <Th>ราคา Sale (บาท)</Th>}
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {cart.map((line) => {
                    const variant = state.variants[line.variantId];
                    const product = variant ? state.products[variant.productId] : undefined;
                    return (
                      <Tr key={line.key}>
                        <Td>
                          <p className="font-medium">{product?.sellingName}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">
                            {variant?.color} / {variant?.size} · {variant?.sku}
                          </p>
                        </Td>
                        <Td>
                          <Input
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) => updateQty(line.key, Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                            aria-label="จำนวนใบที่พิมพ์"
                            className="w-24"
                          />
                        </Td>
                        {saleMode && (
                          <Td>
                            <div className="flex items-center gap-3">
                              <Input type="number" min={0} value={line.price ?? ""} onChange={(e) => updatePrice(line.key, e.target.value)} aria-label="ราคา Sale" className="w-28" />
                              <button type="button" onClick={() => addPriceLine(line.key)} className="whitespace-nowrap text-xs text-[var(--color-primary)] underline">
                                + เพิ่มอีกราคา
                              </button>
                            </div>
                          </Td>
                        )}
                        <Td>
                          <button onClick={() => removeLine(line.key)} className="text-[var(--color-danger)]" aria-label="ลบรายการ">
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
      </div>

      <LabelCalibrationPanel calibration={calibration} onChange={updateCalibration} onReset={resetCalibration} />

      {!printBatch || printBatch.length === 0 ? (
        <p className="text-sm text-[var(--color-on-surface-variant)] print:hidden">ยังไม่ได้ปริ้น — เพิ่มรายการแล้วกด &quot;พิมพ์ป้าย&quot;</p>
      ) : (
        <PrintableQrLabels items={printBatch} calibration={calibration} />
      )}
    </div>
  );
}
