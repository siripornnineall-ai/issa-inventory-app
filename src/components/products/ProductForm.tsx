"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Tabs } from "@/components/ui/Tabs";
import { VariantMatrixBuilder, type DraftVariant } from "./VariantMatrixBuilder";
import { ColorImageManager } from "./ColorImageManager";
import { SupplierCombobox } from "./SupplierCombobox";
import { useStore, useActions } from "@/lib/store";
import { productVariants } from "@/lib/store/selectors";
import type { Product, ProductImage, ProductStatus } from "@/lib/types";
import { PRODUCT_SHAPE_OPTIONS, type ProductShape } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";
import { todayInputValue } from "@/lib/utils/date";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { suggestModelCode } from "@/lib/utils/ids";

const CATEGORY_OPTIONS = ["กางเกงขายาว", "กางเกงขาสั้น", "เสื้อ", "เดรส", "กระโปรง", "เครื่องประดับ", "อื่น ๆ"];

export function ProductForm({ existing }: { existing?: Product }) {
  const router = useRouter();
  const state = useStore();
  const suppliers = state.suppliers;
  const brandsMap = state.brands;
  const shapeOptionsMap = state.productShapeOptions;
  const { createProduct, updateProduct, removeProduct, addVariant, upsertProductShape, upsertSupplier } = useActions();
  const isEdit = Boolean(existing);
  const brands = useMemo(() => Object.values(brandsMap).filter((b) => b.active), [brandsMap]);
  const shapeOptions = useMemo(() => {
    const fromRegistry = Object.values(shapeOptionsMap).sort((a, b) => a.sortOrder - b.sortOrder);
    if (fromRegistry.length > 0) return fromRegistry.map((s) => s.label);
    return [...PRODUCT_SHAPE_OPTIONS];
  }, [shapeOptionsMap]);

  const [sourceSupplierId, setSourceSupplierId] = useState(existing?.sourceSupplierId ?? "");
  const [sourceModelName, setSourceModelName] = useState(existing?.sourceModelName ?? "");
  const [sourcePurchasePrice, setSourcePurchasePrice] = useState(existing?.sourcePurchasePrice ?? 0);
  const [sourceDescription, setSourceDescription] = useState(existing?.sourceDescription ?? "");
  const [sourceCode, setSourceCode] = useState(existing?.sourceCode ?? "");
  const [firstReceivedDate, setFirstReceivedDate] = useState(existing?.firstReceivedDate ?? todayInputValue());
  const [sourceNote, setSourceNote] = useState(existing?.sourceNote ?? "");
  const [sourceImages, setSourceImages] = useState<ProductImage[]>(existing?.images.filter((i) => i.kind === "source") ?? []);

  const [sellingName, setSellingName] = useState(existing?.sellingName ?? "");
  const [sellingPrice, setSellingPrice] = useState(existing?.sellingPrice ?? 0);
  const [sellingDescription, setSellingDescription] = useState(existing?.sellingDescription ?? "");
  const [category, setCategory] = useState(existing?.category ?? CATEGORY_OPTIONS[0]);
  const [status, setStatus] = useState<ProductStatus>(existing?.status ?? "active");
  const [sellStartDate, setSellStartDate] = useState(existing?.sellStartDate ?? todayInputValue());
  const [shape, setShape] = useState<ProductShape | "">((existing?.shape as ProductShape) ?? "");
  const [newShapeLabel, setNewShapeLabel] = useState("");
  const [addingShape, setAddingShape] = useState(false);
  const [brandId, setBrandId] = useState(existing?.brandId ?? "");
  const [modelCode, setModelCode] = useState(existing?.modelCode ?? "");
  const [modelCodeTouched, setModelCodeTouched] = useState(Boolean(existing?.modelCode));
  const [sellingImages, setSellingImages] = useState<ProductImage[]>(
    existing?.images.filter((i) => i.kind === "selling" && !i.color) ?? []
  );
  const [colorImages, setColorImages] = useState<ProductImage[]>(existing?.images.filter((i) => i.kind === "selling" && i.color) ?? []);

  const selectedBrand = brandId ? brandsMap[brandId] : undefined;
  const siblingModelCodes = useMemo(
    () =>
      Object.values(state.products)
        .filter((p) => p.brandId === brandId && p.id !== existing?.id && p.modelCode)
        .map((p) => p.modelCode as string),
    [state.products, brandId, existing?.id]
  );

  const [variantRows, setVariantRows] = useState<DraftVariant[]>([]);
  const existingVariants = useMemo(() => (existing ? productVariants(state, existing.id) : []), [state, existing]);
  const existingVariantColors = useMemo(() => Array.from(new Set(existingVariants.map((v) => v.color))), [existingVariants]);
  const usedColors = useMemo(
    () => Array.from(new Set([...variantRows.map((r) => r.color), ...existingVariantColors])),
    [variantRows, existingVariantColors]
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "sales">("details");
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingColors, setPendingColors] = useState<string[]>([]);

  function handleSellingNameChange(value: string) {
    setSellingName(value);
    if (!modelCodeTouched) setModelCode(suggestModelCode(value, siblingModelCodes));
  }

  function handleBrandChange(value: string) {
    setBrandId(value);
    if (!modelCodeTouched && sellingName) {
      const codes = Object.values(state.products)
        .filter((p) => p.brandId === value && p.id !== existing?.id && p.modelCode)
        .map((p) => p.modelCode as string);
      setModelCode(suggestModelCode(sellingName, codes));
    }
  }

  function handleCreateSupplier(name: string): string {
    const existingMatch = Object.values(suppliers).find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
    if (existingMatch) return existingMatch.id;
    try {
      const id = upsertSupplier({ name });
      toastSuccess("เพิ่มร้านที่รับมาใหม่เรียบร้อยแล้ว");
      return id;
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "";
    }
  }

  function handleAddShape() {
    if (!newShapeLabel.trim()) {
      toastError("กรุณาระบุชื่อทรงสินค้า");
      return;
    }
    setAddingShape(true);
    try {
      upsertProductShape(newShapeLabel);
      setShape(newShapeLabel.trim());
      setNewShapeLabel("");
      toastSuccess("เพิ่มทรงสินค้าใหม่เรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setAddingShape(false);
    }
  }

  useUnsavedChangesGuard(
    !submitted && (sellingName.trim().length > 0 || sourceImages.length > 0 || sellingImages.length > 0 || colorImages.length > 0 || variantRows.length > 0)
  );

  // เปลี่ยนหน้า (รายละเอียด <-> ข้อมูลการขาย) แล้วเลื่อนกลับขึ้นบนสุดของฟอร์ม
  function goToTab(tab: "details" | "sales") {
    setActiveTab(tab);
    formRef.current?.scrollIntoView({ block: "start" });
  }

  function validate(): string | null {
    if (!sellingName.trim()) return "กรุณาระบุชื่อรุ่นที่ใช้ขาย";
    if (sellingPrice <= 0) return "กรุณาระบุราคาขายให้ถูกต้อง";
    // สีที่เลือกไว้แต่ยังไม่ได้สร้างตัวเลือก จะไม่ถูกบันทึก ต้องให้ผู้ใช้กดสร้างก่อนเสมอ ไม่ปล่อยให้สีหายเงียบ ๆ
    if (pendingColors.length > 0) return `ยังไม่ได้สร้างตัวเลือกของสี ${pendingColors.join(", ")} กรุณากดปุ่ม "สร้างตัวเลือกสี/ไซซ์" ก่อนบันทึก`;
    if (!isEdit && variantRows.length === 0) return "กรุณาเพิ่มตัวเลือกสี/ไซซ์อย่างน้อย 1 รายการ";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toastError(err);
      return;
    }
    setSaving(true);
    try {
      const images = [...sourceImages, ...sellingImages, ...colorImages];
      const payload = {
        sourceSupplierId: sourceSupplierId || undefined,
        sourceModelName: sourceModelName || undefined,
        sourcePurchasePrice: sourcePurchasePrice || undefined,
        sourceDescription: sourceDescription || undefined,
        sourceCode: sourceCode || undefined,
        firstReceivedDate: firstReceivedDate || undefined,
        sourceNote: sourceNote || undefined,
        sellingName: sellingName.trim(),
        sellingPrice,
        sellingDescription: sellingDescription || undefined,
        category,
        status,
        sellStartDate: sellStartDate || undefined,
        shape: shape || undefined,
        brandId: brandId || undefined,
        modelCode: modelCode.trim() || undefined,
        images,
      };

      const addRows = (productId: string, rows: DraftVariant[]) => {
        for (const row of rows) {
          addVariant(productId, {
            color: row.color,
            colorCode: row.colorCode || undefined,
            isDefective: row.isDefective,
            size: row.size,
            sku: row.sku,
            purchasePrice: row.purchasePrice,
            sellingPrice: row.sellingPrice,
            reorderPoint: row.reorderPoint,
            storageLocation: row.storageLocation || undefined,
          });
        }
      };

      if (isEdit && existing) {
        // ตัวเลือกที่เพิ่มใหม่ในหน้านี้ (ข้ามสี/ไซซ์ที่มีอยู่แล้ว ไม่ให้ซ้ำ)
        const have = new Set(existingVariants.map((v) => `${v.color}|${v.size}|${v.isDefective}`));
        const newRows = variantRows.filter((r) => !have.has(`${r.color}|${r.size}|${r.isDefective}`));
        updateProduct(existing.id, payload);
        addRows(existing.id, newRows);
        setSubmitted(true);
        toastSuccess(newRows.length > 0 ? `บันทึกการแก้ไขและเพิ่มตัวเลือก ${newRows.length} รายการเรียบร้อยแล้ว` : "บันทึกการแก้ไขสินค้าเรียบร้อยแล้ว");
        router.replace(`/products/${existing.id}`);
      } else {
        const id = createProduct(payload);
        try {
          addRows(id, variantRows);
        } catch (addErr) {
          // ไม่ทิ้งสินค้าที่ไม่มีตัวเลือกค้างไว้ในระบบ ถ้าสร้างตัวเลือกไม่สำเร็จให้ยกเลิกทั้งชุด
          removeProduct(id);
          throw addErr;
        }
        setSubmitted(true);
        toastSuccess("เพิ่มสินค้าใหม่เรียบร้อยแล้ว");
        router.replace(`/products/${id}`);
      }
    } catch (e2) {
      toastError(e2 instanceof Error ? e2.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex scroll-mt-4 flex-col gap-6">
      <Tabs
        tabs={[
          { id: "details", label: "รายละเอียด" },
          { id: "sales", label: "ข้อมูลการขาย" },
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as "details" | "sales")}
      />

      <div className={activeTab === "details" ? "flex flex-col gap-6" : "hidden"}>
      <Card>
        <CardHeader>
          <CardTitle>ส่วนที่ 1: ข้อมูลสินค้าที่รับมา</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">ข้อมูลต้นทางก่อนนำมาแปรรูปขาย ใช้สำหรับอ้างอิงต้นทุนและแหล่งที่มา</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:gap-4">
          <FormField label="ร้านที่รับมา" hint="พิมพ์เพื่อค้นหาร้านที่มีอยู่ หรือพิมพ์ชื่อร้านใหม่แล้วเลือก &quot;เพิ่มร้านใหม่&quot;">
            <SupplierCombobox suppliers={suppliers} value={sourceSupplierId} onChange={setSourceSupplierId} onCreate={handleCreateSupplier} />
          </FormField>
          <FormField label="ชื่อรุ่นจากร้านต้นทาง">
            <Input value={sourceModelName} onChange={(e) => setSourceModelName(e.target.value)} />
          </FormField>
          <FormField label="ราคาซื้อ (บาท)">
            <Input type="number" min={0} step="0.01" value={sourcePurchasePrice} onChange={(e) => setSourcePurchasePrice(Number(e.target.value))} />
          </FormField>
          <FormField label="รหัสสินค้าจากร้านต้นทาง">
            <Input value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} />
          </FormField>
          <FormField label="วันที่รับครั้งแรก">
            <Input type="date" value={firstReceivedDate} onChange={(e) => setFirstReceivedDate(e.target.value)} />
          </FormField>
          <FormField label="รายละเอียดสินค้าที่รับมา" className="col-span-2">
            <Textarea value={sourceDescription} onChange={(e) => setSourceDescription(e.target.value)} />
          </FormField>
          <FormField label="หมายเหตุ" className="col-span-2">
            <Textarea value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} />
          </FormField>
          <div className="col-span-2">
            <ImageUploader images={sourceImages} onChange={setSourceImages} kind="source" label="รูปภาพสินค้าที่รับมา" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ส่วนที่ 2: ข้อมูลสินค้าที่ใช้ขาย</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">ข้อมูลที่จะแสดงต่อลูกค้าและใช้ในการขายจริง</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0 sm:gap-4">
          <FormField label="ชื่อรุ่นที่ใช้ขาย" required>
            <Input value={sellingName} onChange={(e) => handleSellingNameChange(e.target.value)} required />
          </FormField>
          <FormField label="ราคาขาย (บาท)" required>
            <Input type="number" min={0} step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} required />
          </FormField>
          <FormField label="แบรนด์">
            <Select value={brandId} onChange={(e) => handleBrandChange(e.target.value)}>
              <option value="">ไม่ระบุแบรนด์</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="รหัสรุ่น" hint="ใช้สร้างรหัส SKU ใหม่ (ต้องไม่ซ้ำกันในแบรนด์เดียวกัน)">
            <Input
              value={modelCode}
              onChange={(e) => {
                setModelCode(e.target.value.toUpperCase());
                setModelCodeTouched(true);
              }}
              placeholder="เช่น WEN, BS, BW"
            />
          </FormField>
          <FormField label="ทรง" className="col-span-2">
            <Select value={shape} onChange={(e) => setShape(e.target.value as ProductShape | "")}>
              <option value="">ไม่ระบุ</option>
              {shapeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex gap-2">
              <Input
                value={newShapeLabel}
                onChange={(e) => setNewShapeLabel(e.target.value)}
                placeholder="เพิ่มทรงใหม่ เช่น ทรงขาม้า"
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={handleAddShape} loading={addingShape}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </FormField>
          <FormField label="หมวดหมู่สินค้า">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="สถานะสินค้า">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
              <option value="active">พร้อมขาย</option>
              <option value="inactive">ปิดการขายชั่วคราว</option>
              <option value="discontinued">เลิกขาย</option>
            </Select>
          </FormField>
          <FormField label="วันที่เริ่มขาย">
            <Input type="date" value={sellStartDate} onChange={(e) => setSellStartDate(e.target.value)} />
          </FormField>
          {selectedBrand && modelCode && (
            <p className="col-span-2 text-xs text-[var(--color-on-surface-variant)]">
              ตัวอย่างรูปแบบ SKU: <span className="font-mono font-medium text-[var(--color-on-surface)]">{selectedBrand.code}-{modelCode}-[สี]-[ไซซ์]</span>{" "}
              (มีตำหนิ: <span className="font-mono">{selectedBrand.code}-{modelCode}-DF-[สี]-[ไซซ์]</span>)
            </p>
          )}
          <FormField label="รายละเอียดสำหรับขาย" className="col-span-2">
            <Textarea value={sellingDescription} onChange={(e) => setSellingDescription(e.target.value)} />
          </FormField>
          <div className="col-span-2">
            <ImageUploader images={sellingImages} onChange={setSellingImages} kind="selling" label="รูปภาพหลักสำหรับขาย (เลือกรูปหลักได้)" />
          </div>
        </CardContent>
      </Card>
      </div>

      <div className={activeTab === "sales" ? "flex flex-col gap-6" : "hidden"}>
      {isEdit && (
        <Card>
          <CardHeader>
            <CardTitle>ตัวเลือกสินค้าที่มีอยู่แล้ว ({existingVariants.length} รายการ)</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              {existingVariants.length > 0
                ? "แก้ไข SKU ราคา และสต็อกของแต่ละตัวเลือกได้ที่หน้ารายละเอียดสินค้า"
                : "สินค้านี้ยังไม่มีตัวเลือกสี/ไซซ์ในระบบ เพิ่มได้ในช่องด้านล่างแล้วกดบันทึกการแก้ไข"}
            </p>
          </CardHeader>
          {existingVariants.length > 0 && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1.5">
                {existingVariants.map((v) => (
                  <span key={v.id} className="rounded-lg bg-[var(--color-surface-container)] px-2 py-1 text-xs">
                    {v.color} / {v.size}
                    {v.isDefective ? " (ตำหนิ)" : ""} · {v.sku}
                  </span>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "เพิ่มตัวเลือกสินค้าใหม่ (สี / ไซซ์)" : "ตัวเลือกสินค้า (สี / ไซซ์)"}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">แต่ละตัวเลือกจะมี SKU จำนวนคงเหลือ ราคา และจุดแจ้งเตือนของตัวเอง</p>
        </CardHeader>
        <CardContent className="pt-0">
          <VariantMatrixBuilder
            productName={sellingName || "ISSA"}
            brand={selectedBrand}
            modelCode={modelCode || undefined}
            rows={variantRows}
            onChange={setVariantRows}
            defaultPurchasePrice={sourcePurchasePrice}
            defaultSellingPrice={sellingPrice}
            onPendingChange={setPendingColors}
          />
        </CardContent>
      </Card>
      {usedColors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>รูปภาพแยกตามสี</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">อัปโหลดรูปภาพสำหรับแต่ละสีของสินค้า</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ColorImageManager colors={usedColors} images={colorImages} onChange={setColorImages} availableImages={sellingImages} />
          </CardContent>
        </Card>
      )}
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          ยกเลิก
        </Button>
        {activeTab === "details" ? (
          <>
            {isEdit && (
              <Button key="details-save" type="submit" variant="secondary" loading={saving}>
                บันทึกการแก้ไข
              </Button>
            )}
            {/* key แยกกันทุกปุ่มสำคัญมาก: ถ้าไม่มี React จะใช้ <button> ตัวเดิมซ้ำแล้วเปลี่ยนจาก "ถัดไป" (button)
                เป็น "บันทึก" (submit) กลางจังหวะคลิก ทำให้เบราว์เซอร์ส่งฟอร์มบันทึกทันทีที่กดถัดไป */}
            <Button key="go-sales" type="button" onClick={() => goToTab("sales")}>
              ถัดไป: ข้อมูลการขาย
            </Button>
          </>
        ) : (
          <>
            <Button key="go-details" type="button" variant="secondary" onClick={() => goToTab("details")}>
              ย้อนกลับ
            </Button>
            <Button key="sales-save" type="submit" loading={saving}>
              {isEdit ? "บันทึกการแก้ไข" : "บันทึกสินค้าใหม่"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
