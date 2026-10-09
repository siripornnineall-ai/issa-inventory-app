// Engine ชั้นตรรกะทางธุรกิจล้วน (pure) ไม่ผูกกับ React/Zustand
// ทุกฟังก์ชันรับ "draft" ที่ต้องถูกเรียกภายใน immer.produce() เท่านั้น
// เพื่อให้ได้คุณสมบัติ "atomic": ถ้ามี error ถูก throw ระหว่างทาง immer จะไม่ commit การเปลี่ยนแปลงใด ๆ เลย
import type { Draft } from "immer";
import type {
  AppNotification,
  AppUser,
  Brand,
  CompanyInfo,
  Equipment,
  EquipmentRequisition,
  Invoice,
  MovementItemType,
  MovementType,
  Order,
  OrderLine,
  Product,
  ProductVariant,
  StockDocLine,
  StockInDoc,
  StockLevel,
  StockMovement,
  StockOutDoc,
  StorefrontSettings,
  Supplier,
  SupplierImage,
  Transfer,
  UnitToken,
  UnitTokenAction,
  Warehouse,
} from "@/lib/types";
import { AppState, stockKey } from "./state";
import { NO_TAX_INVOICE_BUYER_LABEL } from "@/lib/types";
import { newId, genDocNo, genSku, genSkuV2, suggestColorCode } from "@/lib/utils/ids";
import { nowISO, todayInputValue, formatThaiDateTime } from "@/lib/utils/date";

export class BusinessRuleError extends Error {}

function nextSeq(draft: Draft<AppState>, prefix: string): number {
  const n = (draft.docSeq[prefix] ?? 0) + 1;
  draft.docSeq[prefix] = n;
  return n;
}

function getStockMap(draft: Draft<AppState>, itemType: MovementItemType) {
  return itemType === "product" ? draft.variantStock : draft.equipmentStock;
}

export function getStockLevel(
  map: Record<string, StockLevel>,
  itemId: string,
  warehouseId: string
): StockLevel {
  return map[stockKey(itemId, warehouseId)] ?? { itemId, warehouseId, qtyOnHand: 0, qtyReserved: 0 };
}

function writeStockLevel(
  draft: Draft<AppState>,
  map: Record<string, StockLevel>,
  itemId: string,
  warehouseId: string,
  next: StockLevel
) {
  map[stockKey(itemId, warehouseId)] = next;
}

function pushMovement(draft: Draft<AppState>, m: Omit<StockMovement, "id" | "createdAt"> & { createdAt?: string }) {
  const id = newId();
  draft.movements[id] = { ...m, id, createdAt: m.createdAt ?? nowISO() } as StockMovement;
}

// ===================== ร้านค้า / คลัง =====================
export function upsertWarehouse(draft: Draft<AppState>, input: Partial<Warehouse> & { id?: string }): string {
  const id = input.id ?? newId();
  const existing = draft.warehouses[id];
  draft.warehouses[id] = {
    id,
    name: input.name ?? existing?.name ?? "",
    type: input.type ?? existing?.type ?? "other",
    address: input.address ?? existing?.address,
    active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? nowISO(),
  };
  return id;
}

// เหตุผลที่ลบคลังไม่ได้ (null = ลบได้) ใช้ทั้งใน removeWarehouse และหน้าตั้งค่า เพื่อบอกเหตุผลก่อนเปิดหน้าต่างยืนยัน
// กฎ: ต้องเหลืออย่างน้อย 1 คลัง, ต้องไม่มีสินค้า/อุปกรณ์คงเหลือหรือจองไว้, และต้องไม่เคยมีประวัติทำรายการ
// (ประวัติการเคลื่อนไหว/ใบรับเข้า/ใบเบิกออก/ใบโอนย้าย/คำสั่งซื้อ อ้างอิงคลัง และฐานข้อมูลห้ามลบเพื่อรักษาประวัติ)
export function warehouseRemovalBlocker(state: AppState, id: string): string | null {
  const wh = state.warehouses[id];
  if (!wh) return "ไม่พบคลังนี้";
  if (Object.keys(state.warehouses).length <= 1) return "ต้องมีคลังอย่างน้อย 1 แห่ง จึงลบคลังสุดท้ายไม่ได้";

  const stocks = [...Object.values(state.variantStock), ...Object.values(state.equipmentStock)].filter((s) => s.warehouseId === id);
  const units = stocks.reduce((n, s) => n + s.qtyOnHand, 0);
  if (units > 0 || stocks.some((s) => s.qtyReserved > 0)) {
    return 'คลัง "' + wh.name + '" ยังมีสินค้า/อุปกรณ์คงเหลือหรือถูกจองอยู่ กรุณาโอนย้ายหรือเบิกออกให้หมดก่อน';
  }

  const hasHistory =
    Object.values(state.movements).some((m) => m.warehouseFromId === id || m.warehouseToId === id) ||
    Object.values(state.stockInDocs).some((d) => d.warehouseId === id) ||
    Object.values(state.stockOutDocs).some((d) => d.warehouseId === id) ||
    Object.values(state.transfers).some((t) => t.fromWarehouseId === id || t.toWarehouseId === id) ||
    Object.values(state.orders).some((o) => o.warehouseId === id);
  if (hasHistory) {
    return 'คลัง "' + wh.name + '" มีประวัติการทำรายการแล้ว จึงลบไม่ได้ เพราะลบแล้วประวัติจะเสีย กรุณาใช้การปิดการใช้งานแทน';
  }
  return null;
}

export function removeWarehouse(draft: Draft<AppState>, id: string) {
  const blocker = warehouseRemovalBlocker(draft as unknown as AppState, id);
  if (blocker) throw new BusinessRuleError(blocker);
  delete draft.warehouses[id];
  // แถวสต็อกของคลังนี้ล้วนเป็น 0 (ตรวจแล้วข้างบน) เอาออกจากหน่วยความจำ ฐานข้อมูลลบตามเองอัตโนมัติ (on delete cascade)
  for (const key of Object.keys(draft.variantStock)) if (draft.variantStock[key].warehouseId === id) delete draft.variantStock[key];
  for (const key of Object.keys(draft.equipmentStock)) if (draft.equipmentStock[key].warehouseId === id) delete draft.equipmentStock[key];
}

export function upsertUser(draft: Draft<AppState>, input: Partial<AppUser> & { id?: string }): string {
  const id = input.id ?? newId();
  const existing = draft.users[id];
  if (!input.name && !existing) throw new BusinessRuleError("กรุณาระบุชื่อผู้ใช้งาน");
  if (!input.email && !existing) throw new BusinessRuleError("กรุณาระบุอีเมล");
  const email = input.email ?? existing?.email ?? "";
  const dup = Object.values(draft.users).find((u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase());
  if (dup) throw new BusinessRuleError(`อีเมล "${email}" ถูกใช้งานแล้ว`);
  draft.users[id] = {
    id,
    name: input.name ?? existing?.name ?? "",
    email,
    role: input.role ?? existing?.role ?? "viewer",
    active: input.active ?? existing?.active ?? true,
    avatarUrl: input.avatarUrl ?? existing?.avatarUrl,
    canViewCost: input.canViewCost ?? existing?.canViewCost,
    mustChangePassword: input.mustChangePassword ?? existing?.mustChangePassword,
    createdAt: existing?.createdAt ?? nowISO(),
  };
  return id;
}

// ลบผู้ใช้งานออกจากระบบ (สิทธิ์ user.admin — เฉพาะผู้ดูแลระบบ ตรวจที่ store/index.ts)
// ผู้ใช้ที่เคยทำรายการแล้วลบไม่ได้ เพราะประวัติ/เอกสารในฐานข้อมูลอ้างอิงถึง (foreign key) และประวัติการเคลื่อนไหว
// ถูกล็อกห้ามแก้ไข — กรณีนั้นให้ "ปิดการใช้งาน" แทน เพื่อรักษา audit trail ว่าใครเป็นคนทำรายการ
export function removeUser(draft: Draft<AppState>, id: string) {
  const user = draft.users[id];
  if (!user) throw new BusinessRuleError("ไม่พบผู้ใช้งานนี้");
  if (id === draft.currentUserId) throw new BusinessRuleError("ไม่สามารถลบบัญชีของตัวเองได้");
  const hasHistory =
    Object.values(draft.movements).some((m) => m.actorId === id) ||
    Object.values(draft.stockInDocs).some((d) => d.receivedBy === id) ||
    Object.values(draft.stockOutDocs).some((d) => d.actorId === id) ||
    Object.values(draft.transfers).some((t) => t.senderId === id || t.receiverId === id) ||
    Object.values(draft.equipmentRequisitions).some((r) => r.requesterId === id || r.approverId === id);
  if (hasHistory) {
    throw new BusinessRuleError(`"${user.name}" มีประวัติการทำรายการในระบบแล้ว จึงลบไม่ได้ กรุณาใช้การปิดการใช้งานแทน`);
  }
  delete draft.users[id];
  // การแจ้งเตือนของผู้ใช้นี้ถูกลบตามในฐานข้อมูลอัตโนมัติ (on delete cascade) — ลบออกจากหน่วยความจำให้ตรงกัน
  for (const key of Object.keys(draft.notifications)) {
    if (draft.notifications[key].userId === id) delete draft.notifications[key];
  }
}

export function upsertSupplier(draft: Draft<AppState>, input: Partial<Supplier> & { id?: string }): string {
  const id = input.id ?? newId();
  const existing = draft.suppliers[id];
  if (!input.name && !existing) throw new BusinessRuleError("กรุณาระบุชื่อร้านค้า/ซัพพลายเออร์");
  draft.suppliers[id] = {
    id,
    name: input.name ?? existing?.name ?? "",
    category: input.category ?? existing?.category ?? "other",
    contactName: input.contactName ?? existing?.contactName,
    phone: input.phone ?? existing?.phone,
    line: input.line ?? existing?.line,
    email: input.email ?? existing?.email,
    address: input.address ?? existing?.address,
    taxId: input.taxId ?? existing?.taxId,
    paymentTerms: input.paymentTerms ?? existing?.paymentTerms,
    leadTimeDays: input.leadTimeDays ?? existing?.leadTimeDays,
    note: input.note ?? existing?.note,
    active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? nowISO(),
  };
  return id;
}

export function removeSupplier(draft: Draft<AppState>, id: string) {
  if (!draft.suppliers[id]) throw new BusinessRuleError("ไม่พบร้านค้า/ซัพพลายเออร์นี้");
  delete draft.suppliers[id];
  for (const key of Object.keys(draft.supplierImages)) {
    if (draft.supplierImages[key].supplierId === id) delete draft.supplierImages[key];
  }
  // สินค้าที่เคยอ้างอิงร้านนี้ยังอยู่ครบ แค่เอาการอ้างอิงออก (ไม่ลบสินค้า/ประวัติใด ๆ)
  for (const p of Object.values(draft.products)) {
    if (p.sourceSupplierId === id) p.sourceSupplierId = undefined;
  }
}

// ===================== สินค้า =====================
function modelCodeExists(draft: Draft<AppState>, brandId: string, modelCode: string, excludeProductId?: string): boolean {
  return Object.values(draft.products).some(
    (p) => p.id !== excludeProductId && p.brandId === brandId && p.modelCode?.toUpperCase() === modelCode.toUpperCase()
  );
}

export function createProduct(draft: Draft<AppState>, input: Omit<Product, "id" | "createdAt" | "updatedAt">): string {
  if (!input.sellingName?.trim()) throw new BusinessRuleError("กรุณาระบุชื่อรุ่นที่ใช้ขาย");
  if (input.brandId && input.modelCode && modelCodeExists(draft, input.brandId, input.modelCode)) {
    throw new BusinessRuleError(`รหัสรุ่น "${input.modelCode}" ถูกใช้งานแล้วในแบรนด์นี้ กรุณาใช้รหัสอื่น`);
  }
  const id = newId();
  const now = nowISO();
  draft.products[id] = { ...input, id, createdAt: now, updatedAt: now } as Product;
  return id;
}

export function updateProduct(draft: Draft<AppState>, id: string, input: Partial<Product>) {
  const p = draft.products[id];
  if (!p) throw new BusinessRuleError("ไม่พบสินค้านี้ในระบบ");
  const brandId = input.brandId ?? p.brandId;
  const modelCode = input.modelCode ?? p.modelCode;
  if (brandId && modelCode && modelCodeExists(draft, brandId, modelCode, id)) {
    throw new BusinessRuleError(`รหัสรุ่น "${modelCode}" ถูกใช้งานแล้วในแบรนด์นี้ กรุณาใช้รหัสอื่น`);
  }
  Object.assign(p, input, { updatedAt: nowISO() });
}

export function setProductStatus(draft: Draft<AppState>, id: string, status: Product["status"]) {
  const p = draft.products[id];
  if (!p) throw new BusinessRuleError("ไม่พบสินค้านี้ในระบบ");
  p.status = status;
  p.updatedAt = nowISO();
}

function skuExists(draft: Draft<AppState>, sku: string, excludeVariantId?: string): boolean {
  return Object.values(draft.variants).some(
    (v) => v.sku.toLowerCase() === sku.toLowerCase() && v.id !== excludeVariantId
  );
}

export function addVariant(
  draft: Draft<AppState>,
  productId: string,
  input: {
    color: string;
    size: string;
    sku?: string;
    colorCode?: string; // รหัสสีสำหรับสร้าง SKU รูปแบบใหม่ (ต้องมีคู่กับสินค้าที่กำหนดแบรนด์+รหัสรุ่นแล้ว)
    isDefective?: boolean;
    purchasePrice: number;
    sellingPrice: number;
    reorderPoint?: number;
    storageLocation?: string;
  }
): string {
  const product = draft.products[productId];
  if (!product) throw new BusinessRuleError("ไม่พบสินค้านี้ในระบบ");
  const isDefective = input.isDefective ?? false;
  const dup = Object.values(draft.variants).find(
    (v) => v.productId === productId && v.color === input.color && v.size === input.size && v.isDefective === isDefective
  );
  if (dup) throw new BusinessRuleError(`มีตัวเลือกสี "${input.color}" ไซซ์ "${input.size}"${isDefective ? " (มีตำหนิ)" : ""} อยู่แล้ว`);

  let sku = input.sku?.trim();
  if (sku) {
    if (skuExists(draft, sku)) throw new BusinessRuleError(`SKU "${sku}" ถูกใช้งานแล้ว กรุณาใช้ SKU อื่น`);
  } else {
    const brand = product.brandId ? draft.brands[product.brandId] : undefined;
    if (brand && product.modelCode && input.colorCode) {
      let suffix = 0;
      do {
        const base = genSkuV2({ brandCode: brand.code, modelCode: product.modelCode, colorCode: input.colorCode, size: input.size, isDefective });
        sku = suffix === 0 ? base : `${base}-${suffix}`;
        suffix += 1;
      } while (skuExists(draft, sku));
    } else {
      // รูปแบบเดิม ใช้เฉพาะกรณีสินค้ายังไม่ได้กำหนดแบรนด์/รหัสรุ่น/รหัสสี
      let seq = Object.values(draft.variants).filter((v) => v.productId === productId).length + 1;
      do {
        sku = genSku({ productName: product.sellingName, color: input.color, size: input.size, seq });
        seq += 1;
      } while (skuExists(draft, sku));
    }
  }

  const id = newId();
  draft.variants[id] = {
    id,
    productId,
    color: input.color,
    size: input.size,
    sku,
    isDefective,
    purchasePrice: input.purchasePrice,
    sellingPrice: input.sellingPrice,
    reorderPoint: input.reorderPoint ?? 5,
    storageLocation: input.storageLocation,
    active: true,
  };
  for (const wh of Object.values(draft.warehouses)) {
    writeStockLevel(draft, draft.variantStock, id, wh.id, { itemId: id, warehouseId: wh.id, qtyOnHand: 0, qtyReserved: 0 });
  }
  return id;
}

export function updateVariant(draft: Draft<AppState>, variantId: string, input: Partial<ProductVariant>) {
  const v = draft.variants[variantId];
  if (!v) throw new BusinessRuleError("ไม่พบตัวเลือกสินค้านี้");
  if (input.sku && input.sku !== v.sku && skuExists(draft, input.sku, variantId)) {
    throw new BusinessRuleError(`SKU "${input.sku}" ถูกใช้งานแล้ว กรุณาใช้ SKU อื่น`);
  }
  Object.assign(v, input);
}

export function removeVariant(draft: Draft<AppState>, variantId: string) {
  const v = draft.variants[variantId];
  if (!v) return;
  const totalStock = Object.values(draft.variantStock)
    .filter((s) => s.itemId === variantId)
    .reduce((sum, s) => sum + s.qtyOnHand, 0);
  if (totalStock > 0) throw new BusinessRuleError("ไม่สามารถลบตัวเลือกนี้ได้ เนื่องจากยังมีสต็อกคงเหลืออยู่");
  delete draft.variants[variantId];
  for (const key of Object.keys(draft.variantStock)) {
    if (draft.variantStock[key].itemId === variantId) delete draft.variantStock[key];
  }
}

// สร้าง SKU มาตรฐานใหม่ให้ตัวเลือกสินค้าทั้งหมดของสินค้านี้ (รูปแบบ [แบรนด์]-[รหัสรุ่น]-[รหัสสี]-[ไซซ์])
// ใช้แก้ปัญหาสินค้าเก่าที่ SKU ยังเป็นชื่อสีภาษาไทยตรง ๆ (สร้างบาร์โค้ดแบบ CODE128 ไม่ได้ เพราะรองรับแค่ ASCII)
export function regenerateProductSkus(draft: Draft<AppState>, productId: string): number {
  const product = draft.products[productId];
  if (!product) throw new BusinessRuleError("ไม่พบสินค้านี้");
  const brand = product.brandId ? draft.brands[product.brandId] : undefined;
  if (!brand || !product.modelCode) {
    throw new BusinessRuleError("ต้องระบุแบรนด์และรหัสรุ่นของสินค้าก่อน (แก้ไขได้ที่หน้าแก้ไขสินค้า) จึงจะสร้าง SKU มาตรฐานใหม่ได้");
  }
  const variants = Object.values(draft.variants).filter((v) => v.productId === productId);
  let count = 0;
  for (const variant of variants) {
    const existingColor = Object.values(draft.colorCodes).find((c) => c.thaiName === variant.color);
    let colorCode = existingColor?.code;
    if (!colorCode) {
      colorCode = suggestColorCode(variant.color, draft.colorCodes);
      draft.colorCodes[colorCode] = { code: colorCode, thaiName: variant.color, createdAt: nowISO() };
    }
    const newSku = genSkuV2({ brandCode: brand.code, modelCode: product.modelCode, colorCode, size: variant.size, isDefective: variant.isDefective });
    if (newSku !== variant.sku) {
      variant.sku = newSku;
      count += 1;
    }
  }
  return count;
}

export function removeProduct(draft: Draft<AppState>, productId: string) {
  const variantIds = Object.values(draft.variants)
    .filter((v) => v.productId === productId)
    .map((v) => v.id);
  for (const vid of variantIds) removeVariant(draft, vid);
  delete draft.products[productId];
}

// ===================== อุปกรณ์ =====================
export function upsertEquipmentType(draft: Draft<AppState>, code: string, labelTh: string): string {
  const trimmedLabel = labelTh.trim();
  if (!trimmedLabel) throw new BusinessRuleError("กรุณาระบุชื่อประเภทอุปกรณ์");
  const normalizedCode = code.trim()
    ? code.trim().toLowerCase().replace(/\s+/g, "_")
    : trimmedLabel
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .join("_")
        .toLowerCase() || newId().slice(0, 8);
  const existing = draft.equipmentTypeOptions[normalizedCode];
  draft.equipmentTypeOptions[normalizedCode] = {
    code: normalizedCode,
    labelTh: trimmedLabel,
    sortOrder: existing?.sortOrder ?? Object.values(draft.equipmentTypeOptions).length,
    createdAt: existing?.createdAt ?? nowISO(),
  };
  return normalizedCode;
}

// รหัสอุปกรณ์ไม่แสดง/ไม่ให้กรอกแล้ว แต่ฐานข้อมูลยังต้องมีค่าไม่ซ้ำ (คอลัมน์ code unique) และใช้เป็น SKU ในประวัติสต็อก
// จึงสร้างให้เองแบบ EQ-0001, EQ-0002, ... โดยต่อจากเลขสูงสุดที่มีอยู่
export function nextEquipmentCode(draft: Draft<AppState>): string {
  let max = 0;
  for (const e of Object.values(draft.equipment)) {
    const m = /^EQ-(\d+)$/.exec(e.code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `EQ-${String(max + 1).padStart(4, "0")}`;
}

export function createEquipment(
  draft: Draft<AppState>,
  input: Omit<Equipment, "id" | "createdAt" | "updatedAt" | "code"> & { code?: string }
): string {
  if (!input.name?.trim()) throw new BusinessRuleError("กรุณาระบุชื่ออุปกรณ์");
  const code = input.code?.trim() || nextEquipmentCode(draft);
  if (Object.values(draft.equipment).some((e) => e.code.toLowerCase() === code.toLowerCase())) {
    throw new BusinessRuleError(`รหัสอุปกรณ์ "${code}" ถูกใช้งานแล้ว`);
  }
  const id = newId();
  const now = nowISO();
  // รูปต้องได้ id ใหม่เสมอ: ตาราง equipment_images ใช้ id เป็นคีย์หลัก ถ้าหลายรายการ (เช่นหลายไซซ์) ใช้รูปชุดเดียวกัน
  // id ซ้ำกันจะบันทึกลงฐานข้อมูลไม่ได้ และทำให้สต็อกของรายการเหล่านั้นไม่ถูกบันทึกตามไปด้วย
  const images = (input.images ?? []).map((img) => ({ ...img, id: newId() }));
  draft.equipment[id] = { ...input, images, code, id, createdAt: now, updatedAt: now } as Equipment;
  for (const wh of Object.values(draft.warehouses)) {
    writeStockLevel(draft, draft.equipmentStock, id, wh.id, { itemId: id, warehouseId: wh.id, qtyOnHand: 0, qtyReserved: 0 });
  }
  return id;
}

export function updateEquipment(draft: Draft<AppState>, id: string, input: Partial<Equipment>) {
  const e = draft.equipment[id];
  if (!e) throw new BusinessRuleError("ไม่พบอุปกรณ์นี้ในระบบ");
  if (input.code && input.code !== e.code) {
    if (Object.values(draft.equipment).some((x) => x.id !== id && x.code.toLowerCase() === input.code!.toLowerCase())) {
      throw new BusinessRuleError(`รหัสอุปกรณ์ "${input.code}" ถูกใช้งานแล้ว`);
    }
  }
  Object.assign(e, input, { updatedAt: nowISO() });
}

export function removeEquipment(draft: Draft<AppState>, id: string) {
  const totalStock = Object.values(draft.equipmentStock)
    .filter((s) => s.itemId === id)
    .reduce((sum, s) => sum + s.qtyOnHand, 0);
  if (totalStock > 0) throw new BusinessRuleError("ไม่สามารถลบอุปกรณ์นี้ได้ เนื่องจากยังมีสต็อกคงเหลืออยู่");
  delete draft.equipment[id];
  for (const key of Object.keys(draft.equipmentStock)) {
    if (draft.equipmentStock[key].itemId === id) delete draft.equipmentStock[key];
  }
}

// ===================== รับเข้า (Stock In) =====================
export interface StockInInput {
  itemType: MovementItemType;
  date: string;
  warehouseId: string;
  supplierId?: string;
  poNumber?: string;
  issuePo?: boolean;
  issuedByName?: string;
  approvedByName?: string;
  billNumber?: string;
  receiptImages?: string[];
  receivedBy: string;
  receivedByName: string;
  note?: string;
  lines: { itemId: string; qty: number; unitCost?: number }[];
}

function describeItem(draft: Draft<AppState>, itemType: MovementItemType, itemId: string) {
  if (itemType === "product") {
    const v = draft.variants[itemId];
    const p = v ? draft.products[v.productId] : undefined;
    return { name: p?.sellingName ?? "ไม่ทราบชื่อสินค้า", sku: v?.sku ?? "-", color: v?.color, size: v?.size };
  }
  const e = draft.equipment[itemId];
  return { name: e?.name ?? "ไม่ทราบชื่ออุปกรณ์", sku: e?.code ?? "-", color: undefined, size: undefined };
}

export function stockIn(draft: Draft<AppState>, input: StockInInput): StockInDoc {
  if (input.lines.length === 0) throw new BusinessRuleError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
  for (const line of input.lines) {
    if (line.qty <= 0) throw new BusinessRuleError("จำนวนรับเข้าต้องมากกว่า 0");
  }
  const map = getStockMap(draft, input.itemType);
  const docId = newId();
  const docNo = genDocNo("SIN", nextSeq(draft, "SIN"));
  const poNumber = input.issuePo ? genDocNo("PO", nextSeq(draft, "PO")) : input.poNumber;
  const lines: StockDocLine[] = [];

  for (const line of input.lines) {
    const current = getStockLevel(map, line.itemId, input.warehouseId);
    const after = current.qtyOnHand + line.qty;
    writeStockLevel(draft, map, line.itemId, input.warehouseId, { ...current, qtyOnHand: after });
    const info = describeItem(draft, input.itemType, line.itemId);
    pushMovement(draft, {
      refNo: docNo,
      itemType: input.itemType,
      itemId: line.itemId,
      variantId: input.itemType === "product" ? line.itemId : undefined,
      itemName: info.name,
      sku: info.sku,
      color: info.color,
      size: info.size,
      movementType: "stock_in",
      qtyChange: line.qty,
      qtyBefore: current.qtyOnHand,
      qtyAfter: after,
      warehouseToId: input.warehouseId,
      actorId: input.receivedBy,
      actorName: input.receivedByName,
      reason: "รับสินค้าเข้า",
      note: input.note,
      relatedDocNo: docNo,
      createdAt: input.date,
    } as StockMovement);
    lines.push({ id: newId(), itemId: line.itemId, qty: line.qty, unitCost: line.unitCost });
  }

  const doc: StockInDoc = {
    id: docId,
    docNo,
    date: input.date,
    itemType: input.itemType,
    supplierId: input.supplierId,
    poNumber,
    issuePo: input.issuePo,
    issuedByName: input.issuedByName,
    approvedByName: input.approvedByName,
    billNumber: input.billNumber,
    receiptImages: input.receiptImages ?? [],
    warehouseId: input.warehouseId,
    lines,
    receivedBy: input.receivedBy,
    note: input.note,
    status: "confirmed",
    createdAt: nowISO(),
  };
  draft.stockInDocs[docId] = doc;
  return doc;
}

// ===================== เบิกออก (Stock Out) =====================
export interface StockOutLineInput {
  itemId: string;
  qty: number;
  unitPrice?: number;
  discount?: number;
}

export interface StockOutInput {
  itemType: MovementItemType;
  date: string;
  warehouseId: string;
  reasonType: MovementType;
  actorId: string;
  actorName: string;
  note?: string;
  lines: StockOutLineInput[];
  channel?: string; // จำเป็นเมื่อ reasonType === 'sale'
  orderNo?: string;
  brandId?: string; // แบรนด์/ร้านของออเดอร์ (แยกจากช่องทางการขาย)
}

export function stockOut(draft: Draft<AppState>, input: StockOutInput): { doc: StockOutDoc; order?: Order } {
  if (input.lines.length === 0) throw new BusinessRuleError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
  const map = getStockMap(draft, input.itemType);
  const errors: string[] = [];

  for (const line of input.lines) {
    if (line.qty <= 0) {
      errors.push("จำนวนที่เบิกออกต้องมากกว่า 0");
      continue;
    }
    const current = getStockLevel(map, line.itemId, input.warehouseId);
    if (current.qtyOnHand - line.qty < 0) {
      const info = describeItem(draft, input.itemType, line.itemId);
      errors.push(
        `สต็อกไม่เพียงพอสำหรับ "${info.name}" (SKU: ${info.sku}) — คงเหลือ ${current.qtyOnHand} ชิ้น แต่ต้องการเบิก ${line.qty} ชิ้น`
      );
    }
  }
  if (errors.length > 0) {
    throw new BusinessRuleError(errors.join(" / "));
  }

  const docId = newId();
  const docNo = genDocNo("SOUT", nextSeq(draft, "SOUT"));
  const lines: StockDocLine[] = [];

  for (const line of input.lines) {
    const current = getStockLevel(map, line.itemId, input.warehouseId);
    const after = current.qtyOnHand - line.qty;
    writeStockLevel(draft, map, line.itemId, input.warehouseId, { ...current, qtyOnHand: after });
    const info = describeItem(draft, input.itemType, line.itemId);
    pushMovement(draft, {
      refNo: docNo,
      itemType: input.itemType,
      itemId: line.itemId,
      variantId: input.itemType === "product" ? line.itemId : undefined,
      itemName: info.name,
      sku: info.sku,
      color: info.color,
      size: info.size,
      movementType: input.reasonType,
      qtyChange: -line.qty,
      qtyBefore: current.qtyOnHand,
      qtyAfter: after,
      warehouseFromId: input.warehouseId,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: input.reasonType,
      note: input.note,
      relatedDocNo: docNo,
      createdAt: input.date,
    } as StockMovement);
    lines.push({ id: newId(), itemId: line.itemId, qty: line.qty, unitPrice: line.unitPrice });
  }

  const doc: StockOutDoc = {
    id: docId,
    docNo,
    date: input.date,
    itemType: input.itemType,
    reasonType: input.reasonType,
    warehouseId: input.warehouseId,
    lines,
    actorId: input.actorId,
    note: input.note,
    status: "confirmed",
    createdAt: nowISO(),
  };
  draft.stockOutDocs[docId] = doc;

  let order: Order | undefined;
  if (input.reasonType === "sale" && input.itemType === "product") {
    const orderId = newId();
    const orderLines: OrderLine[] = input.lines.map((l) => {
      const variant = draft.variants[l.itemId];
      return {
        id: newId(),
        productId: variant?.productId ?? "",
        variantId: l.itemId,
        qty: l.qty,
        unitPrice: l.unitPrice ?? variant?.sellingPrice ?? 0,
        discount: l.discount ?? 0,
      };
    });
    order = {
      id: orderId,
      orderNo: input.orderNo ?? genDocNo("ORD", nextSeq(draft, "ORD")),
      date: input.date,
      channel: (input.channel as Order["channel"]) ?? "other",
      warehouseId: input.warehouseId,
      lines: orderLines,
      status: "completed",
      note: input.note,
      restocked: false,
      brandId: input.brandId,
      createdAt: nowISO(),
    };
    draft.orders[orderId] = order;
  }

  return { doc, order };
}

// ===================== โอนย้าย (Transfer) =====================
export interface TransferInput {
  itemType: MovementItemType;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  senderId: string;
  senderName: string;
  note?: string;
  lines: { itemId: string; qty: number }[];
}

export function createTransfer(draft: Draft<AppState>, input: TransferInput): Transfer {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new BusinessRuleError("คลังต้นทางและปลายทางต้องไม่ใช่แห่งเดียวกัน");
  }
  if (input.lines.length === 0) throw new BusinessRuleError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
  const map = getStockMap(draft, input.itemType);
  const errors: string[] = [];
  for (const line of input.lines) {
    const current = getStockLevel(map, line.itemId, input.fromWarehouseId);
    if (line.qty <= 0) errors.push("จำนวนที่โอนต้องมากกว่า 0");
    else if (current.qtyOnHand - line.qty < 0) {
      const info = describeItem(draft, input.itemType, line.itemId);
      errors.push(`สต็อกที่คลังต้นทางไม่เพียงพอสำหรับ "${info.name}" (คงเหลือ ${current.qtyOnHand} ต้องการโอน ${line.qty})`);
    }
  }
  if (errors.length > 0) throw new BusinessRuleError(errors.join(" / "));

  const id = newId();
  const transferNo = genDocNo("TRF", nextSeq(draft, "TRF"));
  const lines: StockDocLine[] = [];

  for (const line of input.lines) {
    const current = getStockLevel(map, line.itemId, input.fromWarehouseId);
    const after = current.qtyOnHand - line.qty;
    writeStockLevel(draft, map, line.itemId, input.fromWarehouseId, { ...current, qtyOnHand: after });
    const info = describeItem(draft, input.itemType, line.itemId);
    pushMovement(draft, {
      refNo: transferNo,
      itemType: input.itemType,
      itemId: line.itemId,
      variantId: input.itemType === "product" ? line.itemId : undefined,
      itemName: info.name,
      sku: info.sku,
      color: info.color,
      size: info.size,
      movementType: "transfer_out",
      qtyChange: -line.qty,
      qtyBefore: current.qtyOnHand,
      qtyAfter: after,
      warehouseFromId: input.fromWarehouseId,
      warehouseToId: input.toWarehouseId,
      actorId: input.senderId,
      actorName: input.senderName,
      reason: "โอนย้ายสต็อก",
      note: input.note,
      relatedDocNo: transferNo,
      createdAt: input.date,
    } as StockMovement);
    lines.push({ id: newId(), itemId: line.itemId, qty: line.qty });
  }

  const transfer: Transfer = {
    id,
    transferNo,
    itemType: input.itemType,
    date: input.date,
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    lines,
    senderId: input.senderId,
    note: input.note,
    status: "pending",
    createdAt: nowISO(),
  };
  draft.transfers[id] = transfer;
  return transfer;
}

export function receiveTransfer(draft: Draft<AppState>, transferId: string, receiverId: string, receiverName: string) {
  const t = draft.transfers[transferId];
  if (!t) throw new BusinessRuleError("ไม่พบรายการโอนย้ายนี้");
  if (t.status === "received") throw new BusinessRuleError("รายการโอนย้ายนี้ถูกยืนยันรับแล้ว");
  if (t.status === "cancelled") throw new BusinessRuleError("รายการโอนย้ายนี้ถูกยกเลิกไปแล้ว");

  const map = getStockMap(draft, t.itemType);
  for (const line of t.lines) {
    const current = getStockLevel(map, line.itemId, t.toWarehouseId);
    const after = current.qtyOnHand + line.qty;
    writeStockLevel(draft, map, line.itemId, t.toWarehouseId, { ...current, qtyOnHand: after });
    const info = describeItem(draft, t.itemType, line.itemId);
    pushMovement(draft, {
      refNo: t.transferNo,
      itemType: t.itemType,
      itemId: line.itemId,
      variantId: t.itemType === "product" ? line.itemId : undefined,
      itemName: info.name,
      sku: info.sku,
      color: info.color,
      size: info.size,
      movementType: "transfer_in",
      qtyChange: line.qty,
      qtyBefore: current.qtyOnHand,
      qtyAfter: after,
      warehouseFromId: t.fromWarehouseId,
      warehouseToId: t.toWarehouseId,
      actorId: receiverId,
      actorName: receiverName,
      reason: "ปลายทางยืนยันรับสินค้า",
      relatedDocNo: t.transferNo,
    } as StockMovement);
  }
  t.status = "received";
  t.receivedAt = nowISO();
  t.receiverId = receiverId;
}

export function cancelTransfer(draft: Draft<AppState>, transferId: string, reason: string | undefined, actorId: string, actorName: string) {
  const t = draft.transfers[transferId];
  if (!t) throw new BusinessRuleError("ไม่พบรายการโอนย้ายนี้");
  if (t.status === "received") throw new BusinessRuleError("ไม่สามารถยกเลิกได้ เนื่องจากปลายทางได้รับสินค้าแล้ว");
  if (t.status === "cancelled") throw new BusinessRuleError("รายการนี้ถูกยกเลิกไปแล้ว");

  const map = getStockMap(draft, t.itemType);
  for (const line of t.lines) {
    const current = getStockLevel(map, line.itemId, t.fromWarehouseId);
    const after = current.qtyOnHand + line.qty;
    writeStockLevel(draft, map, line.itemId, t.fromWarehouseId, { ...current, qtyOnHand: after });
    const info = describeItem(draft, t.itemType, line.itemId);
    pushMovement(draft, {
      refNo: t.transferNo,
      itemType: t.itemType,
      itemId: line.itemId,
      variantId: t.itemType === "product" ? line.itemId : undefined,
      itemName: info.name,
      sku: info.sku,
      color: info.color,
      size: info.size,
      movementType: "adjustment",
      qtyChange: line.qty,
      qtyBefore: current.qtyOnHand,
      qtyAfter: after,
      warehouseToId: t.fromWarehouseId,
      actorId,
      actorName,
      reason: "ยกเลิกการโอนย้าย คืนสต็อกกลับต้นทาง",
      note: reason,
      relatedDocNo: t.transferNo,
    } as StockMovement);
  }
  t.status = "cancelled";
  t.cancelledAt = nowISO();
}

// ===================== ยกเลิกออเดอร์ / คืนสต็อก =====================
export function cancelOrder(draft: Draft<AppState>, orderId: string, reason: string, actorId: string, actorName: string) {
  const order = draft.orders[orderId];
  if (!order) throw new BusinessRuleError("ไม่พบคำสั่งซื้อนี้");
  if (order.status === "cancelled") throw new BusinessRuleError("คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว");
  if (order.restocked) throw new BusinessRuleError("คำสั่งซื้อนี้ถูกคืนสต็อกไปแล้ว ป้องกันการคืนสต็อกซ้ำ");

  for (const line of order.lines) {
    const current = getStockLevel(draft.variantStock, line.variantId, order.warehouseId);
    const after = current.qtyOnHand + line.qty;
    writeStockLevel(draft, draft.variantStock, line.variantId, order.warehouseId, { ...current, qtyOnHand: after });
    const info = describeItem(draft, "product", line.variantId);
    pushMovement(draft, {
      refNo: order.orderNo,
      itemType: "product",
      itemId: line.variantId,
      variantId: line.variantId,
      itemName: info.name,
      sku: info.sku,
      color: info.color,
      size: info.size,
      movementType: "cancel_restock",
      qtyChange: line.qty,
      qtyBefore: current.qtyOnHand,
      qtyAfter: after,
      warehouseToId: order.warehouseId,
      actorId,
      actorName,
      reason: `ยกเลิกออเดอร์ ${order.orderNo}: ${reason}`,
      relatedDocNo: order.orderNo,
    } as StockMovement);
  }
  order.status = "cancelled";
  order.cancelReason = reason;
  order.cancelledAt = nowISO();
  order.restocked = true;
}

export interface CreateInvoiceInput {
  orderIds: string[];
  buyerName?: string;
  buyerAddress?: string;
  buyerTaxId?: string;
  note?: string;
}

export function createInvoice(draft: Draft<AppState>, input: CreateInvoiceInput): Invoice {
  if (input.orderIds.length === 0) throw new BusinessRuleError("กรุณาเลือกคำสั่งซื้ออย่างน้อย 1 รายการ");
  for (const orderId of input.orderIds) {
    if (!draft.orders[orderId]) throw new BusinessRuleError("ไม่พบคำสั่งซื้อนี้");
  }
  const invoice: Invoice = {
    id: newId(),
    invoiceNo: genDocNo("INV", nextSeq(draft, "INV")),
    date: todayInputValue(),
    orderIds: input.orderIds,
    buyerName: input.buyerName?.trim() || NO_TAX_INVOICE_BUYER_LABEL,
    buyerAddress: input.buyerAddress?.trim() || undefined,
    buyerTaxId: input.buyerTaxId?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: nowISO(),
  };
  draft.invoices[invoice.id] = invoice;
  return invoice;
}

export function updateCompanyInfo(draft: Draft<AppState>, patch: Partial<CompanyInfo>) {
  draft.companyInfo = { ...draft.companyInfo, ...patch };
}

export function updateStorefrontSettings(draft: Draft<AppState>, patch: Partial<StorefrontSettings>) {
  draft.storefrontSettings = { ...draft.storefrontSettings, ...patch };
}

// ===================== ปรับยอดสต็อก (Admin/Manager) =====================
export function adjustStock(
  draft: Draft<AppState>,
  input: { itemType: MovementItemType; itemId: string; warehouseId: string; newQty: number; reason: string; actorId: string; actorName: string }
) {
  if (input.newQty < 0) throw new BusinessRuleError("จำนวนสต็อกต้องไม่ติดลบ");
  const map = getStockMap(draft, input.itemType);
  const current = getStockLevel(map, input.itemId, input.warehouseId);
  if (input.newQty < current.qtyReserved) {
    throw new BusinessRuleError("ไม่สามารถปรับยอดต่ำกว่าจำนวนที่ถูกจองไว้ได้");
  }
  writeStockLevel(draft, map, input.itemId, input.warehouseId, { ...current, qtyOnHand: input.newQty });
  const info = describeItem(draft, input.itemType, input.itemId);
  pushMovement(draft, {
    refNo: genDocNo("ADJ", nextSeq(draft, "ADJ")),
    itemType: input.itemType,
    itemId: input.itemId,
    variantId: input.itemType === "product" ? input.itemId : undefined,
    itemName: info.name,
    sku: info.sku,
    color: info.color,
    size: info.size,
    movementType: "adjustment",
    qtyChange: input.newQty - current.qtyOnHand,
    qtyBefore: current.qtyOnHand,
    qtyAfter: input.newQty,
    warehouseToId: input.warehouseId,
    actorId: input.actorId,
    actorName: input.actorName,
    reason: input.reason,
  } as StockMovement);
}

// ===================== ป้าย QR ต่อชิ้นจริง (unit tokens) =====================
// ปริ้นทีไรได้รหัสใหม่ไม่ซ้ำใครต่อชิ้น ใช้กันสแกนชิ้นเดิมซ้ำตอนรับเข้า/เบิกออก/นับสต็อก
export const UNIT_TOKEN_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 ชั่วโมง

// รหัสสั้นของป้ายหนึ่งใบ สำหรับพิมพ์เป็นบาร์โค้ด 8 ตัว ตัดตัวอักษรที่อ่านสับสนออก (I, O, 0, 1) เหลือ 32 ตัวพอดี
// 32^8 ≈ 1.1 ล้านล้านแบบ ซ้ำกันแทบเป็นไปไม่ได้ และฐานข้อมูลมี unique index กันซ้ำอีกชั้น
export const UNIT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const UNIT_CODE_LENGTH = 8;
export const UNIT_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function generateUnitCode(): string {
  const bytes = new Uint8Array(UNIT_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => UNIT_CODE_ALPHABET[b & 31]).join("");
}

// ข้อความนี้หน้าตาเหมือนรหัสป้ายรายชิ้นไหม (id เต็มของ QR หรือรหัสสั้น 8 ตัวของบาร์โค้ด) ใช้แยกจากคำค้นหาปกติ
export function isUnitScanCode(value: string): boolean {
  const v = value.trim();
  if (UNIT_CODE_PATTERN.test(normalizeUnitCode(v))) return true;
  const parts = v.split("-");
  return parts.length === 5 && parts.every((p, i) => p.length === [8, 4, 4, 4, 12][i] && p.split("").every((c) => "0123456789abcdefABCDEF".includes(c)));
}

// ทำข้อความที่สแกนได้ (หรือพิมพ์เอง) ให้อยู่ในรูปเดียวกับรหัส: ตัวพิมพ์ใหญ่ ตัดช่องว่างและขีดคั่นออก
export function normalizeUnitCode(input: string): string {
  return input.trim().split(" ").join("").split("-").join("").toUpperCase();
}

export function mintUnitTokens(draft: Draft<AppState>, variantId: string, qty: number): UnitToken[] {
  if (!draft.variants[variantId]) throw new BusinessRuleError("ไม่พบตัวเลือกสินค้านี้");
  if (qty <= 0) throw new BusinessRuleError("จำนวนต้องมากกว่า 0");
  const tokens: UnitToken[] = [];
  const usedCodes = new Set<string>();
  for (const t of Object.values(draft.unitTokens)) if (t.code) usedCodes.add(t.code);
  for (let i = 0; i < qty; i++) {
    let code = generateUnitCode();
    while (usedCodes.has(code)) code = generateUnitCode();
    usedCodes.add(code);
    const token: UnitToken = { id: newId(), code, variantId, createdAt: nowISO() };
    draft.unitTokens[token.id] = token;
    tokens.push(token);
  }
  return tokens;
}

// เช็คอย่างเดียว ไม่แก้ข้อมูล — ใช้ทั้งจากหน้าเว็บ (เช็คทันทีตอนสแกน ก่อน submit จริง)
// และจาก recordUnitScan (เช็คสุดท้ายตอน commit จริง)
export function checkUnitTokenScan(
  tokens: Record<string, UnitToken>,
  tokenId: string,
  action: UnitTokenAction
): { ok: true } | { ok: false; message: string } {
  const token = tokens[tokenId];
  if (!token) return { ok: false, message: "ไม่พบรหัสนี้ในระบบ (อาจยังไม่เคยปริ้นจากระบบนี้)" };
  if (token.lastAction === action && token.lastActionAt) {
    const elapsed = Date.now() - new Date(token.lastActionAt).getTime();
    if (elapsed < UNIT_TOKEN_COOLDOWN_MS) {
      return {
        ok: false,
        message: `ใบนี้สแกน${action === "in" ? "เข้า" : "ออก"}ไปแล้วเมื่อ ${formatThaiDateTime(token.lastActionAt)}`,
      };
    }
  }
  return { ok: true };
}

export function recordUnitScan(draft: Draft<AppState>, input: { tokenId: string; action: UnitTokenAction }): UnitToken {
  const check = checkUnitTokenScan(draft.unitTokens, input.tokenId, input.action);
  if (!check.ok) throw new BusinessRuleError(check.message);
  const token = draft.unitTokens[input.tokenId];
  token.lastAction = input.action;
  token.lastActionAt = nowISO();
  // คืนค่าเป็น snapshot ธรรมดา ไม่ใช่ draft proxy ของ immer — proxy จะถูก revoke ทันทีที่ produce() จบ
  // ถ้า caller อ่านค่าจาก object ที่คืนไปหลังจากนั้นจะพังด้วย "proxy that has been revoked"
  return { ...token };
}

export function setReservation(
  draft: Draft<AppState>,
  itemType: MovementItemType,
  itemId: string,
  warehouseId: string,
  qtyReserved: number
) {
  const map = getStockMap(draft, itemType);
  const current = getStockLevel(map, itemId, warehouseId);
  if (qtyReserved > current.qtyOnHand) throw new BusinessRuleError("จำนวนที่จองต้องไม่เกินจำนวนคงเหลือจริง");
  writeStockLevel(draft, map, itemId, warehouseId, { ...current, qtyReserved });
}

export function addEditedNote(draft: Draft<AppState>, movementId: string, note: string) {
  const m = draft.movements[movementId];
  if (!m) throw new BusinessRuleError("ไม่พบประวัติการเคลื่อนไหวนี้");
  m.editedNote = note;
}

// ===================== แบรนด์ / รหัสสี / ไซซ์กำหนดเอง =====================
export function upsertBrand(draft: Draft<AppState>, input: Partial<Brand> & { id?: string }): string {
  const id = input.id ?? newId();
  const existing = draft.brands[id];
  if (!input.name && !existing) throw new BusinessRuleError("กรุณาระบุชื่อแบรนด์");
  if (!input.code && !existing) throw new BusinessRuleError("กรุณาระบุรหัสแบรนด์");
  const code = (input.code ?? existing?.code ?? "").toUpperCase();
  const dup = Object.values(draft.brands).find((b) => b.id !== id && b.code === code);
  if (dup) throw new BusinessRuleError(`รหัสแบรนด์ "${code}" ถูกใช้งานแล้ว`);
  draft.brands[id] = {
    id,
    name: input.name ?? existing?.name ?? "",
    code,
    active: input.active ?? existing?.active ?? true,
    logoUrl: input.logoUrl ?? existing?.logoUrl,
    createdAt: existing?.createdAt ?? nowISO(),
  };
  return id;
}

export function upsertColorCode(draft: Draft<AppState>, code: string, thaiName: string): string {
  const upperCode = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!upperCode) throw new BusinessRuleError("กรุณาระบุรหัสสี");
  if (!thaiName.trim()) throw new BusinessRuleError("กรุณาระบุชื่อสี");
  const existing = draft.colorCodes[upperCode];
  draft.colorCodes[upperCode] = { code: upperCode, thaiName: thaiName.trim(), createdAt: existing?.createdAt ?? nowISO() };
  return upperCode;
}

export function upsertProductShape(draft: Draft<AppState>, label: string): string {
  const trimmed = label.trim();
  if (!trimmed) throw new BusinessRuleError("กรุณาระบุทรงสินค้า");
  const dup = Object.values(draft.productShapeOptions).find((s) => s.label === trimmed);
  if (dup) return dup.id;
  const id = newId();
  draft.productShapeOptions[id] = { id, label: trimmed, sortOrder: Object.values(draft.productShapeOptions).length, createdAt: nowISO() };
  return id;
}

export function upsertCustomSize(draft: Draft<AppState>, label: string): string {
  const trimmed = label.trim();
  if (!trimmed) throw new BusinessRuleError("กรุณาระบุไซซ์");
  const dup = Object.values(draft.customSizes).find((s) => s.label.toUpperCase() === trimmed.toUpperCase());
  if (dup) return dup.id;
  const id = newId();
  draft.customSizes[id] = { id, label: trimmed, sortOrder: Object.values(draft.customSizes).length, createdAt: nowISO() };
  return id;
}

// ===================== รายชื่อผู้สั่งซื้อ/ผู้อนุมัติสำหรับใบ PO =====================
export function upsertPoSignatory(draft: Draft<AppState>, name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new BusinessRuleError("กรุณาระบุชื่อ");
  const dup = Object.values(draft.poSignatories).find((s) => s.name === trimmed);
  if (dup) return dup.id;
  const id = newId();
  draft.poSignatories[id] = { id, name: trimmed, createdAt: nowISO() };
  return id;
}

// ===================== รูปภาพร้านค้า/ซัพพลายเออร์ =====================
export function setSupplierImages(draft: Draft<AppState>, supplierId: string, images: Omit<SupplierImage, "supplierId">[]) {
  if (!draft.suppliers[supplierId]) throw new BusinessRuleError("ไม่พบร้านค้า/ซัพพลายเออร์นี้");
  for (const key of Object.keys(draft.supplierImages)) {
    if (draft.supplierImages[key].supplierId === supplierId) delete draft.supplierImages[key];
  }
  for (const img of images) {
    draft.supplierImages[img.id] = { ...img, supplierId };
  }
}

// ===================== การแจ้งเตือน =====================
function pushNotification(draft: Draft<AppState>, input: Omit<AppNotification, "id" | "read" | "createdAt">) {
  const id = newId();
  draft.notifications[id] = { ...input, id, read: false, createdAt: nowISO() };
}

export function markNotificationRead(draft: Draft<AppState>, notificationId: string) {
  const n = draft.notifications[notificationId];
  if (!n) return;
  n.read = true;
}

// ===================== คำขอเบิกอุปกรณ์ + อนุมัติ =====================
export interface RequisitionInput {
  requesterId: string;
  requesterName: string;
  department?: string;
  equipmentId: string;
  qtyRequested: number;
  reason?: string;
  note?: string;
}

export function createRequisition(draft: Draft<AppState>, input: RequisitionInput): EquipmentRequisition {
  if (input.qtyRequested <= 0) throw new BusinessRuleError("จำนวนที่ขอเบิกต้องมากกว่า 0");
  const equipment = draft.equipment[input.equipmentId];
  if (!equipment) throw new BusinessRuleError("ไม่พบอุปกรณ์นี้ในระบบ");
  const stockSnapshot = Object.values(draft.equipmentStock)
    .filter((s) => s.itemId === input.equipmentId)
    .reduce((sum, s) => sum + s.qtyOnHand, 0);

  const id = newId();
  const reqNo = genDocNo("REQ", nextSeq(draft, "REQ"));
  const req: EquipmentRequisition = {
    id,
    reqNo,
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    department: input.department,
    equipmentId: input.equipmentId,
    qtyRequested: input.qtyRequested,
    stockSnapshot,
    reason: input.reason,
    note: input.note,
    status: "pending",
    createdAt: nowISO(),
  };
  draft.equipmentRequisitions[id] = req;

  for (const user of Object.values(draft.users)) {
    if (user.active && (user.role === "manager" || user.role === "admin")) {
      pushNotification(draft, {
        userId: user.id,
        type: "requisition_pending",
        title: "มีคำขอเบิกอุปกรณ์ใหม่",
        body: `${input.requesterName} ขอเบิก "${equipment.name}" จำนวน ${input.qtyRequested} ${equipment.unit}`,
        link: `/equipment/requisitions`,
      });
    }
  }
  return req;
}

export function approveRequisition(draft: Draft<AppState>, reqId: string, approverId: string, approverName: string) {
  const req = draft.equipmentRequisitions[reqId];
  if (!req) throw new BusinessRuleError("ไม่พบคำขอเบิกนี้");
  if (req.status !== "pending") throw new BusinessRuleError("คำขอนี้ถูกดำเนินการไปแล้ว");
  const equipment = draft.equipment[req.equipmentId];
  if (!equipment) throw new BusinessRuleError("ไม่พบอุปกรณ์นี้ในระบบ");

  const stockEntries = Object.values(draft.equipmentStock)
    .filter((s) => s.itemId === req.equipmentId)
    .sort((a, b) => b.qtyOnHand - a.qtyOnHand);
  const target = stockEntries[0];
  if (!target || target.qtyOnHand < req.qtyRequested) {
    throw new BusinessRuleError(`สต็อกอุปกรณ์ไม่เพียงพอ (คงเหลือ ${target?.qtyOnHand ?? 0} ต้องการ ${req.qtyRequested})`);
  }
  const after = target.qtyOnHand - req.qtyRequested;
  writeStockLevel(draft, draft.equipmentStock, req.equipmentId, target.warehouseId, { ...target, qtyOnHand: after });
  pushMovement(draft, {
    refNo: req.reqNo,
    itemType: "equipment",
    itemId: req.equipmentId,
    itemName: equipment.name,
    sku: equipment.code,
    movementType: "internal_use",
    qtyChange: -req.qtyRequested,
    qtyBefore: target.qtyOnHand,
    qtyAfter: after,
    warehouseFromId: target.warehouseId,
    actorId: approverId,
    actorName: approverName,
    reason: `อนุมัติคำขอเบิก ${req.reqNo} โดย ${approverName}`,
    relatedDocNo: req.reqNo,
  } as StockMovement);

  req.status = "approved";
  req.approverId = approverId;
  req.approverName = approverName;
  req.decidedAt = nowISO();

  pushNotification(draft, {
    userId: req.requesterId,
    type: "requisition_approved",
    title: "คำขอเบิกอุปกรณ์ได้รับการอนุมัติ",
    body: `คำขอ ${req.reqNo} (${equipment.name} x${req.qtyRequested}) ได้รับการอนุมัติแล้ว`,
    link: `/equipment/requisitions`,
  });
}

export function rejectRequisition(draft: Draft<AppState>, reqId: string, approverId: string, approverName: string, reason: string) {
  const req = draft.equipmentRequisitions[reqId];
  if (!req) throw new BusinessRuleError("ไม่พบคำขอเบิกนี้");
  if (req.status !== "pending") throw new BusinessRuleError("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (!reason.trim()) throw new BusinessRuleError("กรุณาระบุเหตุผลที่ปฏิเสธ");

  req.status = "rejected";
  req.approverId = approverId;
  req.approverName = approverName;
  req.decidedAt = nowISO();
  req.rejectReason = reason.trim();

  const equipment = draft.equipment[req.equipmentId];
  pushNotification(draft, {
    userId: req.requesterId,
    type: "requisition_rejected",
    title: "คำขอเบิกอุปกรณ์ถูกปฏิเสธ",
    body: `คำขอ ${req.reqNo}${equipment ? ` (${equipment.name})` : ""} ถูกปฏิเสธ: ${reason.trim()}`,
    link: `/equipment/requisitions`,
  });
}

export function cancelRequisition(draft: Draft<AppState>, reqId: string) {
  const req = draft.equipmentRequisitions[reqId];
  if (!req) throw new BusinessRuleError("ไม่พบคำขอเบิกนี้");
  if (req.status !== "pending") throw new BusinessRuleError("ยกเลิกได้เฉพาะคำขอที่ยังรออนุมัติเท่านั้น");
  req.status = "cancelled";
}
