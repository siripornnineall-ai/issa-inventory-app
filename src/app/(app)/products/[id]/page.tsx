"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, LogIn, LogOut, ArrowLeftRight, ImageOff, Barcode as Barcode2, RefreshCw, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ProductStatusBadge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { VariantDialog } from "@/components/products/VariantDialog";
import { ColorSwatch } from "@/components/products/ColorSwatch";
import { ColorImageManager } from "@/components/products/ColorImageManager";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { useStore, useActions } from "@/lib/store";
import { productVariants, variantStockAcrossWarehouses } from "@/lib/store/selectors";
import { compareSizes } from "@/lib/utils/sizes";
import { formatTHB, profitPercent, profitPerUnit } from "@/lib/utils/money";
import { formatThaiDate } from "@/lib/utils/date";
import { useCan, useCanViewCost } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import type { ProductVariant } from "@/lib/types";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const state = useStore();
  const { removeVariant, removeProduct, updateProduct, regenerateProductSkus } = useActions();
  const canWrite = useCan("product.write");
  const canViewCost = useCanViewCost();

  const product = state.products[params.id];
  const variants = useMemo(() => (product ? productVariants(state, product.id) : []), [state, product]);
  const variantGroups = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      if (!map.has(v.color)) map.set(v.color, []);
      map.get(v.color)!.push(v);
    }
    return Array.from(map.entries()).map(([color, rows]) => ({ color, rows: [...rows].sort((a, b) => compareSizes(a.size, b.size)) }));
  }, [variants]);
  const warehouses = Object.values(state.warehouses);
  const brand = product?.brandId ? state.brands[product.brandId] : undefined;
  // SKU ที่ต้องสร้างใหม่: มีอักษรไทยปน (สร้างบาร์โค้ดไม่ได้) หรือสินค้ามีแบรนด์+รหัสรุ่นแล้ว แต่ SKU ยังไม่ขึ้นต้นด้วย แบรนด์-รหัสรุ่น
  // (เช่นลืมใส่แบรนด์ตอนสร้างสินค้า แล้วมาใส่ทีหลัง SKU เลยยังเป็น ISSA-ชื่อรุ่น-... แบบเก่า)
  const skuNeedsRegen = useMemo(() => {
    const prefix = brand && product?.modelCode ? `${brand.code}-${product.modelCode}-`.toUpperCase() : null;
    return variants.some((v) => /[^\x00-\x7F]/.test(v.sku) || (prefix !== null && !v.sku.toUpperCase().startsWith(prefix)));
  }, [variants, brand, product]);

  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | undefined>(undefined);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [editColorFor, setEditColorFor] = useState<string | null>(null);
  const [regenSkuOpen, setRegenSkuOpen] = useState(false);
  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  const [sheetSize, setSheetSize] = useState<string | null>(null);

  const colorsWithImages = useMemo(
    () => Array.from(new Set((product?.images ?? []).filter((i) => i.kind === "selling" && i.color).map((i) => i.color as string))),
    [product?.images]
  );
  const variantColors = useMemo(() => Array.from(new Set(variants.map((v) => v.color))), [variants]);
  const allColors = useMemo(() => Array.from(new Set([...variantColors, ...colorsWithImages])), [variantColors, colorsWithImages]);

  // แสดงเฉพาะรูปภาพที่ใช้ขายจริง (kind === "selling") ในแกลเลอรีหลัก ไม่ปนกับรูปอ้างอิงจากร้านต้นทาง (kind === "source")
  const mainImages = useMemo(() => (product?.images ?? []).filter((i) => i.kind === "selling" && !i.color), [product?.images]);
  const sourceImages = useMemo(() => (product?.images ?? []).filter((i) => i.kind === "source"), [product?.images]);
  const displayedImages = useMemo(() => {
    if (!product) return [];
    if (selectedColor) {
      const forColor = product.images.filter((i) => i.kind === "selling" && i.color === selectedColor);
      if (forColor.length > 0) return forColor;
    }
    return mainImages;
  }, [product, selectedColor, mainImages]);

  function colorImageFor(color: string) {
    return (
      product?.images.find((i) => i.kind === "selling" && i.color === color && i.isMain) ??
      product?.images.find((i) => i.kind === "selling" && i.color === color)
    );
  }

  const activeSheetGroup = variantGroups.find((g) => g.color === selectedColor) ?? variantGroups[0];
  const activeSheetVariant = activeSheetGroup?.rows.find((r) => r.size === sheetSize) ?? activeSheetGroup?.rows[0];
  const activeSheetStock = activeSheetVariant ? variantStockAcrossWarehouses(state, activeSheetVariant.id) : undefined;

  function openStockSheet() {
    if (!selectedColor && variantGroups[0]) setSelectedColor(variantGroups[0].color);
    setSheetSize(null);
    setStockSheetOpen(true);
  }

  if (!product) {
    return (
      <>
        <Header title="ไม่พบสินค้า" />
        <PageContainer>
          <EmptyState title="ไม่พบสินค้านี้ในระบบ" description="สินค้านี้อาจถูกลบไปแล้ว" action={<Link href="/products/all"><Button>กลับไปหน้าสินค้าทั้งหมด</Button></Link>} />
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <Header
        title={product.sellingName}
        description={`${product.category} · เพิ่มเมื่อ ${formatThaiDate(product.createdAt)}`}
        actions={
          canWrite && (
            <div className="flex gap-2">
              <Link href={`/products/${product.id}/labels`}>
                <Button variant="secondary">
                  <Barcode2 className="h-4 w-4" /> พิมพ์บาร์โค้ด
                </Button>
              </Link>
              <Link href={`/products/${product.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="h-4 w-4" /> แก้ไขข้อมูล
                </Button>
              </Link>
              <Button variant="danger" onClick={() => setDeleteProductOpen(true)}>
                <Trash2 className="h-4 w-4" /> ลบสินค้า
              </Button>
            </div>
          )
        }
      />
      <PageContainer>
        {/* มุมมองมือถือ — แกลเลอรีเลื่อนดูรูปได้เต็มจอ + ปุ่มเช็คสต็อกแบบชีตเลื่อนขึ้น (คล้ายหน้าสินค้า Shopee) */}
        <div className="-mx-4 sm:hidden">
          <MobileGallery images={displayedImages} alt={product.sellingName} />
          <div className="px-4 pt-3">
            <h1 className="text-lg font-semibold text-[var(--color-on-surface)]">{product.sellingName}</h1>
            <p className="mt-1 text-xl font-bold text-[var(--color-on-surface)]">{formatTHB(product.sellingPrice)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/stock-in?productId=${product.id}`}>
            <Button variant="secondary">
              <LogIn className="h-4 w-4" /> รับเข้า
            </Button>
          </Link>
          <Link href={`/stock-out?productId=${product.id}`}>
            <Button variant="secondary">
              <LogOut className="h-4 w-4" /> เบิกออก
            </Button>
          </Link>
          <Link href={`/transfer?productId=${product.id}`}>
            <Button variant="secondary">
              <ArrowLeftRight className="h-4 w-4" /> โอนย้าย
            </Button>
          </Link>
          <ProductStatusBadge status={product.status} />
        </div>

        <div className="hidden gap-4 sm:grid sm:grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>รูปภาพ</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              {allColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedColor(null)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                      selectedColor === null
                        ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white"
                        : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                    }`}
                  >
                    รูปหลัก
                  </button>
                  {allColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        selectedColor === c
                          ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white"
                          : "border-[var(--color-border)] text-[var(--color-on-surface-variant)]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {displayedImages.length === 0 && (
                  <div className="col-span-2 flex h-32 items-center justify-center rounded-xl bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
                {displayedImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setPreviewImgUrl(img.url)}
                    className="cursor-zoom-in overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={product.sellingName} className="aspect-square w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 pt-0 sm:grid-cols-2">
              <Info label="ชื่อรุ่นที่ใช้ขาย" value={product.sellingName} />
              <Info label="ราคาขาย" value={formatTHB(product.sellingPrice)} />
              <Info label="แบรนด์" value={brand?.name ?? "-"} />
              {canWrite ? (
                <EditableModelCode
                  value={product.modelCode ?? ""}
                  onSave={(next) => {
                    updateProduct(product.id, { modelCode: next || undefined });
                    toastSuccess("บันทึกรหัสรุ่นเรียบร้อยแล้ว");
                  }}
                />
              ) : (
                <Info label="รหัสรุ่น" value={product.modelCode ?? "-"} />
              )}
              <Info label="ทรง" value={product.shape ?? "-"} />
              <Info label="หมวดหมู่" value={product.category} />
              <Info label="วันที่เริ่มขาย" value={product.sellStartDate ? formatThaiDate(product.sellStartDate) : "-"} />
              {canViewCost && <Info label="ร้านที่รับมา" value={state.suppliers[product.sourceSupplierId ?? ""]?.name ?? "-"} />}
              {canViewCost && <Info label="ราคาซื้อ" value={formatTHB(product.sourcePurchasePrice ?? 0)} />}
              <Info label="รายละเอียดสำหรับขาย" value={product.sellingDescription || "-"} full multiline />
              {canViewCost && <Info label="รายละเอียดที่รับมา" value={product.sourceDescription || "-"} full multiline />}
            </CardContent>
          </Card>
        </div>

        {canViewCost && sourceImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>รูปภาพสินค้าที่รับมา (อ้างอิงจากร้านต้นทาง)</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">รูปนี้ใช้อ้างอิงภายในเท่านั้น ไม่แสดงในแกลเลอรีสำหรับขายด้านบน</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {sourceImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setPreviewImgUrl(img.url)}
                  className="cursor-zoom-in overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="รูปอ้างอิงจากร้านต้นทาง" className="h-24 w-24 rounded-xl object-cover" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ตัวเลือกสินค้า (สี / ไซซ์)</CardTitle>
            {canWrite && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingVariant(undefined);
                  setVariantDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> เพิ่มตัวเลือก
              </Button>
            )}
          </CardHeader>
          {canWrite && skuNeedsRegen && (
            <div className="mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-container)] p-3 text-xs">
              <p>
                {brand && product?.modelCode
                  ? `พบ SKU ที่ยังไม่ตรงกับแบรนด์ ${brand.code} และรหัสรุ่น ${product.modelCode} (หรือมีอักษรไทยปนอยู่) กดปุ่มนี้เพื่อสร้าง SKU ใหม่ตามรูปแบบมาตรฐาน แบรนด์-รหัสรุ่น-รหัสสี-ไซซ์`
                  : "พบ SKU รุ่นเก่าที่มีอักษรไทยปนอยู่ ทำให้สร้างบาร์โค้ดสแกนไม่ได้ กดปุ่มนี้เพื่อสร้าง SKU ใหม่ (รูปแบบมาตรฐาน แบรนด์-รหัสรุ่น-รหัสสี-ไซซ์) ให้สแกนได้"}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setRegenSkuOpen(true)}>
                <RefreshCw className="h-3.5 w-3.5" /> สร้าง SKU ใหม่ให้สแกนได้
              </Button>
            </div>
          )}
          <CardContent className="pt-0">
            {variants.length === 0 ? (
              <EmptyState title="ยังไม่มีตัวเลือกสินค้า" description="เพิ่มสีและไซซ์เพื่อเริ่มบันทึกสต็อก" />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>สี</Th>
                    <Th>ไซซ์</Th>
                    <Th>SKU</Th>
                    <Th>พร้อมขาย/จอง/ทั้งหมด</Th>
                    {warehouses.map((w) => (
                      <Th key={w.id}>{w.name}</Th>
                    ))}
                    {canViewCost && <Th>ทุน/ขาย</Th>}
                    {canViewCost && <Th>กำไร</Th>}
                    <Th>แจ้งเตือน</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {variantGroups.map((group) => {
                    const colorImage =
                      product.images.find((i) => i.kind === "selling" && i.color === group.color && i.isMain) ??
                      product.images.find((i) => i.kind === "selling" && i.color === group.color);
                    return group.rows.map((v, idx) => {
                      const stock = variantStockAcrossWarehouses(state, v.id);
                      return (
                        <Tr key={v.id} className={idx === 0 ? "border-t-2 border-t-[var(--color-border-strong)]" : undefined}>
                          {idx === 0 && (
                            <Td rowSpan={group.rows.length} className="align-top">
                              <button
                                type="button"
                                onClick={() => (canWrite ? setEditColorFor(group.color) : colorImage && setPreviewImgUrl(colorImage.url))}
                                className="flex items-center gap-2 text-left"
                                title={canWrite ? "แก้ไข/ดูรูปสำหรับสีนี้" : "ดูรูปขนาดใหญ่"}
                              >
                                <ColorSwatch name={group.color} imageUrl={colorImage?.url} size={36} />
                                <span className="font-medium">{group.color}</span>
                              </button>
                            </Td>
                          )}
                          <Td>
                            {v.size}
                            {v.isDefective && (
                              <Badge tone="warning" className="ml-2">
                                มีตำหนิ
                              </Badge>
                            )}
                          </Td>
                          <Td className="font-mono text-xs">{v.sku}</Td>
                          <Td>
                            <span className={stock.onHand <= v.reorderPoint ? "font-semibold text-[var(--color-danger)]" : "font-semibold"}>{stock.available}</span>
                            {" / "}
                            {stock.reserved} / {stock.onHand}
                          </Td>
                          {warehouses.map((w) => (
                            <Td key={w.id} className="text-xs text-[var(--color-on-surface-variant)]">
                              {stock.byWarehouse[w.id]?.onHand ?? 0}
                            </Td>
                          ))}
                          {canViewCost && (
                            <Td className="text-xs">
                              {formatTHB(v.purchasePrice)} / {formatTHB(v.sellingPrice)}
                            </Td>
                          )}
                          {canViewCost && (
                            <Td className="text-xs">
                              {formatTHB(profitPerUnit(v.sellingPrice, v.purchasePrice))} ({profitPercent(v.sellingPrice, v.purchasePrice)}%)
                            </Td>
                          )}
                          <Td className="text-xs">{v.reorderPoint}</Td>
                          <Td>
                            {canWrite && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingVariant(v);
                                    setVariantDialogOpen(true);
                                  }}
                                  className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => setDeleteVariantId(v.id)} className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </Td>
                        </Tr>
                      );
                    });
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        {variants.length > 0 && <div className="h-16 sm:hidden" />}
      </PageContainer>

      {variants.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-white p-3 sm:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button className="w-full" onClick={openStockSheet}>
            เช็คสต็อก
          </Button>
        </div>
      )}

      {stockSheetOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStockSheetOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--color-on-surface)]">เช็คสต็อก</h3>
              <button onClick={() => setStockSheetOpen(false)} className="rounded-lg p-1 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]" aria-label="ปิด">
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeSheetVariant && activeSheetGroup ? (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3">
                <ColorSwatch name={activeSheetGroup.color} imageUrl={colorImageFor(activeSheetGroup.color)?.url} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-on-surface)]">
                    {activeSheetGroup.color} / {activeSheetVariant.size}
                  </p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">SKU: {activeSheetVariant.sku}</p>
                </div>
                <p className="shrink-0 text-lg font-bold text-[var(--color-on-surface)]">{formatTHB(product.sellingPrice)}</p>
              </div>
            ) : (
              <EmptyState title="สินค้านี้ยังไม่มีตัวเลือกสี/ไซซ์" />
            )}

            {variantGroups.length > 0 && (
              <>
                <p className="mb-2 text-sm font-medium text-[var(--color-on-surface)]">สี</p>
                <div className="mb-4 flex flex-wrap gap-3">
                  {variantGroups.map((g) => (
                    <button
                      key={g.color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(g.color);
                        setSheetSize(null);
                      }}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className={`rounded-lg ${activeSheetGroup?.color === g.color ? "ring-2 ring-[var(--color-primary-container)]" : ""}`}>
                        <ColorSwatch name={g.color} imageUrl={colorImageFor(g.color)?.url} size={44} />
                      </span>
                      <span className="max-w-[56px] truncate text-[11px] text-[var(--color-on-surface-variant)]">{g.color}</span>
                    </button>
                  ))}
                </div>

                <p className="mb-2 text-sm font-medium text-[var(--color-on-surface)]">ไซซ์</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {activeSheetGroup?.rows.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSheetSize(v.size)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        activeSheetVariant?.id === v.id
                          ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white"
                          : "border-[var(--color-border)] text-[var(--color-on-surface)]"
                      }`}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeSheetVariant && activeSheetStock && (
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--color-surface-container)] p-3 text-center">
                <div>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">พร้อมขาย</p>
                  <p
                    className={`text-lg font-bold ${
                      activeSheetStock.onHand <= activeSheetVariant.reorderPoint ? "text-[var(--color-danger)]" : "text-[var(--color-primary-container)]"
                    }`}
                  >
                    {activeSheetStock.available}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">จอง</p>
                  <p className="text-lg font-bold text-[var(--color-on-surface)]">{activeSheetStock.reserved}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">คงเหลือทั้งหมด</p>
                  <p className="text-lg font-bold text-[var(--color-on-surface)]">{activeSheetStock.onHand}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <VariantDialog
        open={variantDialogOpen}
        onClose={() => setVariantDialogOpen(false)}
        productId={product.id}
        productName={product.sellingName}
        existing={editingVariant}
      />

      <ConfirmDialog
        open={Boolean(deleteVariantId)}
        onClose={() => setDeleteVariantId(null)}
        danger
        title="ลบตัวเลือกสินค้านี้?"
        description="หากมีสต็อกคงเหลืออยู่ ระบบจะไม่อนุญาตให้ลบ"
        onConfirm={() => {
          if (!deleteVariantId) return;
          try {
            removeVariant(deleteVariantId);
            toastSuccess("ลบตัวเลือกสินค้าเรียบร้อยแล้ว");
          } catch (e) {
            toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
          } finally {
            setDeleteVariantId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteProductOpen}
        onClose={() => setDeleteProductOpen(false)}
        danger
        title="ลบสินค้านี้ทั้งหมด?"
        description="การลบจะรวมถึงตัวเลือกสินค้าทั้งหมด หากมีสต็อกคงเหลืออยู่ ระบบจะไม่อนุญาตให้ลบ"
        onConfirm={() => {
          try {
            removeProduct(product.id);
            toastSuccess("ลบสินค้าเรียบร้อยแล้ว");
            router.replace("/products/all");
          } catch (e) {
            toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
          } finally {
            setDeleteProductOpen(false);
          }
        }}
      />

      <ConfirmDialog
        open={regenSkuOpen}
        onClose={() => setRegenSkuOpen(false)}
        title="สร้าง SKU ใหม่ให้สแกนบาร์โค้ดได้?"
        description="ระบบจะเปลี่ยนรหัส SKU ของทุกตัวเลือกสี/ไซซ์ในสินค้านี้เป็นรูปแบบมาตรฐาน (แบรนด์-รหัสรุ่น-รหัสสี-ไซซ์) SKU เดิมที่เคยพิมพ์ป้ายไว้จะใช้ไม่ได้อีก ต้องพิมพ์ป้ายบาร์โค้ดใหม่หลังจากนี้"
        onConfirm={() => {
          try {
            const count = regenerateProductSkus(product.id);
            toastSuccess(count > 0 ? `สร้าง SKU ใหม่เรียบร้อยแล้ว (${count} รายการ)` : "SKU ทุกรายการเป็นรูปแบบมาตรฐานอยู่แล้ว");
          } catch (e) {
            toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
          } finally {
            setRegenSkuOpen(false);
          }
        }}
      />

      {previewImgUrl && <ImageLightbox src={previewImgUrl} alt={product.sellingName} onClose={() => setPreviewImgUrl(null)} />}

      <Dialog open={Boolean(editColorFor)} onClose={() => setEditColorFor(null)} title={`รูปภาพสำหรับสี "${editColorFor}"`} size="lg">
        {editColorFor && (
          <ColorImageManager
            colors={[editColorFor]}
            images={product.images.filter((i) => i.kind === "selling" && i.color)}
            onChange={(nextColorImages) => {
              const otherImages = product.images.filter((i) => !(i.kind === "selling" && i.color));
              updateProduct(product.id, { images: [...otherImages, ...nextColorImages] });
            }}
            availableImages={mainImages}
          />
        )}
      </Dialog>
    </>
  );
}

function EditableModelCode({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [savedValue, setSavedValue] = useState(value);

  if (value !== savedValue) {
    setSavedValue(value);
    setDraft(value);
  }

  function commit() {
    const next = draft.trim().toUpperCase();
    if (next !== value) onSave(next);
    setDraft(next);
  }

  return (
    <div>
      <p className="text-xs text-[var(--color-on-surface-variant)]">รหัสรุ่น</p>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="เช่น WEN, BS, BW"
        className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm font-medium text-[var(--color-on-surface)] focus:border-[var(--color-primary-container)] focus:outline-none"
      />
    </div>
  );
}

function MobileGallery({ images, alt }: { images: { id: string; url: string }[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-[var(--color-surface-container)]">
        <ImageOff className="h-8 w-8 text-[var(--color-on-surface-variant)]" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={trackRef} onScroll={handleScroll} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
        {images.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={img.id} src={img.url} alt={alt} className="aspect-square w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
          {images.map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, full, multiline }: { label: string; value: string; full?: boolean; multiline?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs text-[var(--color-on-surface-variant)]">{label}</p>
      {multiline ? (
        <p className="mt-1.5 whitespace-pre-line rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-3 text-sm leading-relaxed text-[var(--color-on-surface)]">
          {value}
        </p>
      ) : (
        <p className="text-sm font-medium text-[var(--color-on-surface)]">{value}</p>
      )}
    </div>
  );
}
