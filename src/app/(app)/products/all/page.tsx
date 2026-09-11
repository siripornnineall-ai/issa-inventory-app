"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  PackagePlus,
  LogIn,
  LogOut,
  Download,
  ImageOff,
  Tag,
  Truck,
  CircleCheck,
  BadgeCheck,
  Shapes,
  Check,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, KpiCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/Table";
import { ProductStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { productAggregate, productVariants } from "@/lib/store/selectors";
import { formatNumber, formatTHB, profitPercent } from "@/lib/utils/money";
import { useCan, useCanViewCost } from "@/lib/auth/session";
import { PRODUCT_SHAPE_OPTIONS } from "@/lib/types";

const PAGE_SIZE = 10;

export default function ProductsAllPage() {
  const state = useStore();
  const searchParams = useSearchParams();
  const canWrite = useCan("product.write");
  const canViewCost = useCanViewCost();
  const products = Object.values(state.products);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "all");
  const [supplierId, setSupplierId] = useState("all");
  const [status, setStatus] = useState("all");
  const [brandId, setBrandId] = useState(() => searchParams.get("brand") ?? "all");
  const [shape, setShape] = useState("all");
  const [page, setPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const activeBrand = brandId !== "all" ? state.brands[brandId] : undefined;

  const shapeOptions = useMemo(() => {
    const fromRegistry = Object.values(state.productShapeOptions).sort((a, b) => a.sortOrder - b.sortOrder);
    if (fromRegistry.length > 0) return fromRegistry.map((s) => s.label);
    return [...PRODUCT_SHAPE_OPTIONS];
  }, [state.productShapeOptions]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const brands = useMemo(() => Object.values(state.brands), [state.brands]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const variants = productVariants(state, p.id);
      const matchesSearch =
        !q ||
        p.sellingName.toLowerCase().includes(q) ||
        (p.modelCode ?? "").toLowerCase().includes(q) ||
        variants.some((v) => v.sku.toLowerCase().includes(q) || v.color.toLowerCase().includes(q) || v.size.toLowerCase().includes(q));
      const matchesCategory = category === "all" || p.category === category;
      const matchesSupplier = supplierId === "all" || p.sourceSupplierId === supplierId;
      const matchesStatus = status === "all" || p.status === status;
      const matchesBrand = brandId === "all" || p.brandId === brandId;
      const matchesShape = shape === "all" || p.shape === shape;
      return matchesSearch && matchesCategory && matchesSupplier && matchesStatus && matchesBrand && matchesShape;
    });
  }, [products, state, search, category, supplierId, status, brandId, shape]);

  const totalValue = useMemo(
    () =>
      products.reduce((sum, p) => {
        const agg = productAggregate(state, p.id);
        return sum + agg.onHand * p.sellingPrice;
      }, 0),
    [products, state]
  );
  const outOfStockCount = useMemo(
    () => products.filter((p) => productAggregate(state, p.id).onHand === 0).length,
    [products, state]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const rows = filtered.map((p) => {
      const agg = productAggregate(state, p.id);
      const variants = productVariants(state, p.id);
      return {
        "ชื่อสินค้า": p.sellingName,
        "หมวดหมู่": p.category,
        "สถานะ": p.status,
        "จำนวนตัวเลือก": variants.length,
        "คงเหลือทั้งหมด": agg.onHand,
        "จอง": agg.reserved,
        "พร้อมขาย": agg.available,
        "ราคาขาย": p.sellingPrice,
        "มูลค่าคงเหลือ": agg.onHand * p.sellingPrice,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สินค้าทั้งหมด");
    XLSX.writeFile(wb, `สินค้าทั้งหมด-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const filterTiles = [
    {
      key: "category",
      label: "หมวดหมู่",
      icon: Tag,
      value: category,
      onSelect: (v: string) => { setCategory(v); setPage(1); },
      options: [{ value: "all", label: "หมวดหมู่ทั้งหมด" }, ...categories.map((c) => ({ value: c, label: c }))],
    },
    {
      key: "supplier",
      label: "ผู้ผลิต",
      icon: Truck,
      value: supplierId,
      onSelect: (v: string) => { setSupplierId(v); setPage(1); },
      options: [{ value: "all", label: "ผู้ผลิตทั้งหมด" }, ...Object.values(state.suppliers).map((s) => ({ value: s.id, label: s.name }))],
    },
    {
      key: "status",
      label: "สถานะ",
      icon: CircleCheck,
      value: status,
      onSelect: (v: string) => { setStatus(v); setPage(1); },
      options: [
        { value: "all", label: "สถานะทั้งหมด" },
        { value: "active", label: "พร้อมขาย" },
        { value: "inactive", label: "ปิดการขายชั่วคราว" },
        { value: "discontinued", label: "เลิกขาย" },
      ],
    },
    {
      key: "brand",
      label: "แบรนด์",
      icon: BadgeCheck,
      value: brandId,
      onSelect: (v: string) => { setBrandId(v); setPage(1); },
      options: [{ value: "all", label: "แบรนด์ทั้งหมด" }, ...brands.map((b) => ({ value: b.id, label: b.name }))],
    },
    {
      key: "shape",
      label: "ทรง",
      icon: Shapes,
      value: shape,
      onSelect: (v: string) => { setShape(v); setPage(1); },
      options: [{ value: "all", label: "ทรงทั้งหมด" }, ...shapeOptions.map((s) => ({ value: s, label: s }))],
    },
  ];
  const openFilterTile = filterTiles.find((f) => f.key === openFilter);

  return (
    <>
      <Header
        title={activeBrand ? activeBrand.name : "สินค้าทั้งหมด"}
        description="จัดการรายการสินค้าและตัวเลือกสี/ไซซ์ทั้งหมดของ ISSA Apparel"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหาตามชื่อสินค้า หรือ SKU..." className="w-72 pl-9" />
            </div>
          </div>
        }
      />
      <PageContainer>
        <Link href="/products" className="flex w-fit items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรกสินค้า
        </Link>

        <div className="flex flex-wrap gap-3">
          {canWrite && (
            <Link href="/products/new">
              <Button>
                <PackagePlus className="h-4 w-4" /> เพิ่มสินค้าใหม่
              </Button>
            </Link>
          )}
          <Link href="/stock-in">
            <Button variant="secondary">
              <LogIn className="h-4 w-4" /> รับสินค้าเข้า
            </Button>
          </Link>
          <Link href="/stock-out">
            <Button variant="secondary">
              <LogOut className="h-4 w-4" /> เบิกสินค้าออก
            </Button>
          </Link>
          <Button variant="ghost" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
          <KpiCard label="สินค้าทั้งหมด" value={formatNumber(products.length)} unit="รุ่น" />
          <KpiCard label="สินค้าหมดสต็อก" value={<span className="text-[var(--color-danger)]">{outOfStockCount}</span>} unit="รุ่น" />
          {canViewCost && <KpiCard label="มูลค่าคงเหลือรวม" value={formatTHB(totalValue, { compact: true })} />}
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
            <SlidersHorizontal className="h-4 w-4" /> ตัวกรองละเอียด
          </div>

          {/* มุมมองมือถือ — ไอคอนทางเข้าตัวกรอง กดแล้วเปิดชีตเลือกด้านล่าง แทนดรอปดาวน์ยาว ๆ ที่เปลืองพื้นที่ */}
          <div className="grid grid-cols-3 gap-2 sm:hidden">
            {filterTiles.map((f) => {
              const Icon = f.icon;
              const activeLabel = f.value !== "all" ? f.options.find((o) => o.value === f.value)?.label : undefined;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setOpenFilter(f.key)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center ${
                    activeLabel ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/5" : "border-[var(--color-border)]"
                  }`}
                >
                  <Icon className="h-5 w-5 text-[var(--color-primary-container)]" />
                  <span className="text-[11px] font-medium text-[var(--color-on-surface)]">{f.label}</span>
                  {activeLabel && <span className="max-w-full truncate text-[10px] text-[var(--color-on-surface-variant)]">{activeLabel}</span>}
                </button>
              );
            })}
          </div>

          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="all">หมวดหมู่ทั้งหมด</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPage(1); }}>
              <option value="all">ผู้ผลิตทั้งหมด</option>
              {Object.values(state.suppliers).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">สถานะทั้งหมด</option>
              <option value="active">พร้อมขาย</option>
              <option value="inactive">ปิดการขายชั่วคราว</option>
              <option value="discontinued">เลิกขาย</option>
            </Select>
            <Select value={brandId} onChange={(e) => { setBrandId(e.target.value); setPage(1); }}>
              <option value="all">แบรนด์ทั้งหมด</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select value={shape} onChange={(e) => { setShape(e.target.value); setPage(1); }}>
              <option value="all">ทรงทั้งหมด</option>
              {shapeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card>
          {paged.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<ImageOff className="h-10 w-10" />} title="ไม่พบสินค้าที่ตรงกับเงื่อนไข" description="ลองปรับตัวกรองหรือคำค้นหาใหม่อีกครั้ง" />
            </div>
          ) : (
            <>
              {/* กริดรูปสินค้า 2 คอลัมน์ — สำหรับจอมือถือ ดูสินค้าเป็นภาพเหมือนแอปช้อปปิ้ง */}
              <div className="grid grid-cols-2 gap-2.5 p-3 sm:hidden">
                {paged.map((p) => {
                  const agg = productAggregate(state, p.id);
                  const sellingImages = p.images.filter((i) => i.kind === "selling");
                  const mainImage = sellingImages.find((i) => i.isMain) ?? sellingImages[0];
                  return (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                    >
                      <div className="relative aspect-square w-full bg-[var(--color-surface-container)]">
                        {mainImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mainImage.url} alt={p.sellingName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageOff className="h-6 w-6 text-[var(--color-on-surface-variant)]" />
                          </div>
                        )}
                        <span className="absolute left-1.5 top-1.5">
                          <ProductStatusBadge status={p.status} />
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 text-xs font-medium leading-tight text-[var(--color-on-surface)]">{p.sellingName}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          {canViewCost && <span className="text-sm font-semibold text-[var(--color-on-surface)]">{formatTHB(p.sellingPrice)}</span>}
                          <span className={agg.available <= 5 ? "text-[11px] font-semibold text-[var(--color-danger)]" : "text-[11px] text-[var(--color-on-surface-variant)]"}>
                            สต็อก {formatNumber(agg.available)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* ตารางแบบเต็ม — สำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>รูป</Th>
                      <Th>ชื่อสินค้า</Th>
                      <Th>หมวดหมู่</Th>
                      <Th>สต็อก</Th>
                      {canViewCost && <Th>ราคาขาย</Th>}
                      {canViewCost && <Th>กำไร</Th>}
                      <Th>สถานะ</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map((p) => {
                      const agg = productAggregate(state, p.id);
                      const variants = productVariants(state, p.id);
                      const sellingImages = p.images.filter((i) => i.kind === "selling");
                      const mainImage = sellingImages.find((i) => i.isMain) ?? sellingImages[0];
                      return (
                        <Tr key={p.id} className="cursor-pointer">
                          <Td>
                            <Link href={`/products/${p.id}`}>
                              {mainImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mainImage.url} alt={p.sellingName} className="h-12 w-12 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-surface-container)]">
                                  <ImageOff className="h-5 w-5 text-[var(--color-on-surface-variant)]" />
                                </div>
                              )}
                            </Link>
                          </Td>
                          <Td>
                            <Link href={`/products/${p.id}`} className="font-medium text-[var(--color-on-surface)] hover:text-[var(--color-primary-container)]">
                              {p.sellingName}
                            </Link>
                            <p className="text-xs text-[var(--color-on-surface-variant)]">{variants.length} ตัวเลือก</p>
                          </Td>
                          <Td>{p.category}</Td>
                          <Td>
                            <span className={agg.available <= 5 ? "font-semibold text-[var(--color-danger)]" : "font-semibold"}>{formatNumber(agg.available)}</span>
                          </Td>
                          {canViewCost && <Td className="font-medium">{formatTHB(p.sellingPrice)}</Td>}
                          {canViewCost && <Td>{profitPercent(p.sellingPrice, p.sourcePurchasePrice ?? 0)}%</Td>}
                          <Td>
                            <ProductStatusBadge status={p.status} />
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </Card>
      </PageContainer>

      {openFilterTile && (
        <FilterSheet
          title={openFilterTile.label}
          options={openFilterTile.options}
          value={openFilterTile.value}
          onSelect={openFilterTile.onSelect}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </>
  );
}

function FilterSheet({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--color-on-surface)]">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]" aria-label="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                onClose();
              }}
              className="flex w-full items-center justify-between py-3 text-left text-sm"
            >
              <span className={opt.value === value ? "font-semibold text-[var(--color-primary-container)]" : "text-[var(--color-on-surface)]"}>{opt.label}</span>
              {opt.value === value && <Check className="h-4 w-4 text-[var(--color-primary-container)]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
