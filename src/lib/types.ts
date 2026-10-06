// โครงสร้างข้อมูลหลักของระบบ ISSA Apparel Inventory Manager
// โครงสร้างนี้ถูกออกแบบให้ตรงกับตาราง Supabase ใน supabase/migrations/0001_init.sql
// เพื่อให้ demo data layer (src/lib/store) สลับไปใช้ Supabase จริงได้โดยไม่ต้องเปลี่ยน type

export type UserRole =
  | "admin" // ผู้ดูแลระบบ
  | "manager" // ผู้จัดการ
  | "warehouse" // พนักงานคลัง
  | "sales" // พนักงานขาย
  | "viewer"; // ผู้ดูรายงาน

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  avatarUrl?: string;
  canViewCost?: boolean;
  // true = ผู้ดูแลระบบเพิ่งสร้างบัญชี/ตั้งรหัสผ่านให้ ต้องตั้งรหัสผ่านใหม่เองก่อนถึงจะใช้งานระบบได้
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: "main" | "office" | "store" | "other";
  address?: string;
  active: boolean;
  createdAt: string;
}

export type SupplierCategory = "fabric_mill" | "garment_factory" | "trim_accessory" | "packaging" | "water_gate" | "other";

export interface Supplier {
  id: string;
  name: string;
  category: SupplierCategory;
  contactName?: string;
  phone?: string;
  line?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  note?: string;
  active: boolean;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
  kind: "source" | "selling";
  color?: string; // ถ้าระบุ = รูปเฉพาะของสีนี้ (แบบ Shopee), ถ้าไม่ระบุ = รูปทั่วไป/รูปหลัก
}

export interface Brand {
  id: string;
  name: string;
  code: string; // รหัสแบรนด์สำหรับ SKU เช่น IS, FS, IA
  active: boolean;
  logoUrl?: string; // โลโก้แบรนด์ ใช้แสดงบนป้าย QR/บาร์โค้ด
  createdAt: string;
}

export interface ColorCode {
  code: string; // เช่น BLK, WHT
  thaiName: string;
  createdAt: string;
}

export interface CustomSize {
  id: string;
  label: string;
  sortOrder: number;
  createdAt: string;
}

// รายชื่อผู้สั่งซื้อ/ผู้อนุมัติที่เคยกรอกไว้ ใช้เลือกซ้ำได้แทนการพิมพ์ใหม่ทุกครั้งตอนออกใบ PO
export interface PoSignatory {
  id: string;
  name: string;
  createdAt: string;
}

export interface SupplierImage {
  id: string;
  supplierId: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
}

// รายการทรงสินค้าเริ่มต้น (seed) — ผู้ใช้เพิ่มทรงใหม่เองได้จากฟอร์มสินค้า ดูทะเบียนจริงใน AppState.productShapeOptions
export const PRODUCT_SHAPE_OPTIONS = ["ทรงกระบอกเล็ก", "ทรงขากระบอกกลาง", "ทรงกระบอกใหญ่", "ทรงขาม้า", "ทรงขาบาน", "ทรงขาเดฟ/สกินนี่"] as const;
export type ProductShape = string;

export interface ProductShapeOption {
  id: string;
  label: string;
  sortOrder: number;
  createdAt: string;
}

export type ProductStatus = "active" | "inactive" | "discontinued";

export interface Product {
  id: string;
  // ส่วนที่ 1: ข้อมูลสินค้าที่รับมา
  sourceSupplierId?: string;
  sourceModelName?: string;
  sourcePurchasePrice?: number;
  sourceDescription?: string;
  sourceCode?: string;
  firstReceivedDate?: string;
  sourceNote?: string;
  // ส่วนที่ 2: ข้อมูลสินค้าที่ใช้ขาย
  sellingName: string;
  sellingPrice: number;
  sellingDescription?: string;
  category: string;
  status: ProductStatus;
  sellStartDate?: string;
  images: ProductImage[];
  brandId?: string;
  modelCode?: string; // รหัสรุ่นสำหรับสร้าง SKU เช่น WEN, BS
  shape?: string; // ทรงสินค้า
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  size: string;
  sku: string;
  purchasePrice: number;
  sellingPrice: number;
  reorderPoint: number;
  storageLocation?: string;
  active: boolean;
  isDefective: boolean;
}

// ป้าย QR ต่อชิ้นจริง (ไม่ใช่ต่อ SKU) — ปริ้นทีไรได้รหัสใหม่ไม่ซ้ำใคร ใช้กันสแกนซ้ำชิ้นเดิมตอนรับเข้า/เบิกออก/นับสต็อก
export type UnitTokenAction = "in" | "out";

export interface UnitToken {
  id: string;
  // รหัสสั้น 8 ตัวอักษร (A-Z ไม่มี I/O และ 2-9) ที่พิมพ์เป็นบาร์โค้ด ป้ายที่ทำก่อนมีบาร์โค้ดเฉพาะใบจะไม่มี (QR ใช้ id)
  code?: string;
  variantId: string;
  lastAction?: UnitTokenAction;
  lastActionAt?: string;
  createdAt: string;
}

export interface StockLevel {
  itemId: string; // variantId หรือ equipmentId
  warehouseId: string;
  qtyOnHand: number;
  qtyReserved: number;
}

export type EquipmentUnit =
  | "ชิ้น"
  | "ใบ"
  | "ตัว"
  | "ม้วน"
  | "กล่อง"
  | "แพ็ก"
  | "คู่"
  | "ชุด"
  | "เมตร"
  | "กิโลกรัม";

// รหัสประเภทอุปกรณ์ — ไม่ใช่ union แบบตายตัวอีกต่อไป เพราะผู้ใช้เพิ่มประเภทเองได้จากหน้าฟอร์มอุปกรณ์
// (ดูทะเบียนที่เพิ่มได้จริงใน AppState.equipmentTypeOptions) ค่านี้เก็บ "รหัส" (code) ของประเภท เช่น "hook", "zipper"
export type EquipmentType = string;

export interface EquipmentTypeOption {
  code: string;
  labelTh: string;
  sortOrder: number;
  createdAt: string;
}

export interface Equipment {
  id: string;
  name: string;
  code: string;
  type: EquipmentType;
  size?: string; // ไซซ์ (ไม่บังคับ) แต่ละไซซ์เป็นอุปกรณ์แยกรายการ มีสต็อกของตัวเอง
  description?: string;
  images: ProductImage[];
  supplierId?: string;
  purchasePricePerUnit: number;
  unit: EquipmentUnit;
  reorderPoint: number;
  reorderQty: number;
  storageLocation?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export type MovementItemType = "product" | "equipment";

export type MovementType =
  | "stock_in"
  | "sale"
  | "transfer_out"
  | "transfer_in"
  | "damaged"
  | "lost"
  | "photoshoot"
  | "internal_use"
  | "return_to_source"
  | "adjustment"
  | "size_change"
  | "color_change"
  | "send_to_store"
  | "cancel_restock"
  | "other";

export const MOVEMENT_TYPE_LABEL_TH: Record<MovementType, string> = {
  stock_in: "รับสินค้าเข้า",
  sale: "ขายสินค้า",
  transfer_out: "โอนย้ายออก",
  transfer_in: "โอนย้ายเข้า",
  damaged: "สินค้าเสียหาย",
  lost: "สินค้าสูญหาย",
  photoshoot: "ใช้ถ่ายภาพ",
  internal_use: "ใช้ภายในบริษัท",
  return_to_source: "ส่งคืนร้านต้นทาง",
  adjustment: "ปรับยอด",
  size_change: "เปลี่ยนไซซ์",
  color_change: "เปลี่ยนสี",
  send_to_store: "ส่งหน้าร้าน",
  cancel_restock: "คืนสต็อก (ยกเลิกออเดอร์)",
  other: "อื่น ๆ",
};

export const STOCK_OUT_REASONS: MovementType[] = [
  "sale",
  "send_to_store",
  "transfer_out",
  "size_change",
  "color_change",
  "damaged",
  "lost",
  "photoshoot",
  "internal_use",
  "return_to_source",
  "adjustment",
  "other",
];

export interface StockMovement {
  id: string;
  createdAt: string;
  refNo: string;
  itemType: MovementItemType;
  itemId: string; // productId หรือ equipmentId
  variantId?: string;
  itemName: string;
  sku: string;
  color?: string;
  size?: string;
  movementType: MovementType;
  qtyChange: number; // + เข้า / - ออก
  qtyBefore: number;
  qtyAfter: number;
  warehouseFromId?: string;
  warehouseToId?: string;
  actorId: string;
  actorName: string;
  reason?: string;
  note?: string;
  relatedDocNo?: string;
  editedNote?: string; // ผู้ดูแลระบบเพิ่มหมายเหตุแก้ไขได้ แต่ห้ามลบของเดิม
}

export interface StockDocLine {
  id: string;
  itemId: string;
  variantId?: string;
  qty: number;
  unitCost?: number;
  unitPrice?: number;
}

export interface StockInDoc {
  id: string;
  docNo: string;
  date: string;
  itemType: MovementItemType;
  supplierId?: string;
  poNumber?: string;
  issuePo?: boolean; // ออกใบสั่งซื้อ (PO) อัตโนมัติสำหรับเบิกจ่าย/ยื่นภาษี
  issuedByName?: string; // ชื่อผู้สั่งซื้อที่แสดงบนใบ PO
  approvedByName?: string; // ชื่อผู้อนุมัติที่แสดงบนใบ PO
  billNumber?: string;
  receiptImages: string[];
  warehouseId: string;
  lines: StockDocLine[];
  receivedBy: string;
  note?: string;
  status: "draft" | "confirmed";
  createdAt: string;
}

export interface StockOutDoc {
  id: string;
  docNo: string;
  date: string;
  itemType: MovementItemType;
  reasonType: MovementType;
  warehouseId: string;
  lines: StockDocLine[];
  actorId: string;
  note?: string;
  status: "draft" | "confirmed";
  createdAt: string;
}

export type TransferStatus = "pending" | "shipping" | "received" | "cancelled";

export interface Transfer {
  id: string;
  transferNo: string;
  itemType: MovementItemType;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  lines: StockDocLine[];
  senderId: string;
  receiverId?: string;
  note?: string;
  status: TransferStatus;
  createdAt: string;
  receivedAt?: string;
  cancelledAt?: string;
}

export type SalesChannel =
  | "shopee"
  | "lazada"
  | "tiktok"
  | "facebook"
  | "instagram"
  | "store"
  | "website"
  | "other";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "returned";

export interface OrderLine {
  id: string;
  productId: string;
  variantId: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface Order {
  id: string;
  orderNo: string;
  date: string;
  channel: SalesChannel;
  brandId?: string; // แบรนด์/ร้าน แยกจากช่องทางการขาย
  warehouseId: string;
  lines: OrderLine[];
  status: OrderStatus;
  note?: string;
  cancelReason?: string;
  cancelledAt?: string;
  restocked: boolean;
  createdAt: string;
}

export interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  taxId?: string;
}

export interface StorefrontSettings {
  announcementText: string;
  heroHeadingLine1: string;
  heroHeadingLine2: string;
  heroTagline: string;
  promoHeadingLine1: string;
  promoHeadingLine2: string;
  promoSubtext: string;
  contactPhone: string;
  socialLine: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTiktok: string;
  heroImageUrl: string;
  promoImageUrl: string;
}

export const MARKETPLACE_CHANNELS = ["shopee", "lazada", "tiktok"] as const;

// ผู้ซื้อในใบกำกับภาษี/ใบเสร็จของออเดอร์จากแพลตฟอร์ม — ใช้ป้าย "ลูกค้าไม่ต้องการใบกำกับภาษี" แทนชื่อผู้ซื้อ
// (ลูกค้าปลายทางจริงเป็นผู้ซื้อผ่านแพลตฟอร์ม ไม่ใช่ตัวแพลตฟอร์มเอง จึงไม่ออกในนามแพลตฟอร์ม) เว้นแต่ผู้ใช้จะกรอกชื่อผู้ซื้อจริงเอง
export const NO_TAX_INVOICE_BUYER_LABEL = "ลูกค้าไม่ต้องการใบกำกับภาษี";

// ใบกำกับภาษี/ใบเสร็จรับเงิน — รวมได้หลายคำสั่งซื้อไว้ในใบเดียว ผู้ใช้กรอกชื่อ/ที่อยู่/เลขผู้เสียภาษีผู้ซื้อเองได้
export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  orderIds: string[];
  buyerName: string;
  buyerAddress?: string;
  buyerTaxId?: string;
  note?: string;
  createdAt: string;
}

export type RequisitionStatus = "pending" | "approved" | "rejected" | "cancelled" | "fulfilled";

export interface EquipmentRequisition {
  id: string;
  reqNo: string;
  requesterId: string;
  requesterName: string;
  department?: string;
  equipmentId: string;
  qtyRequested: number;
  stockSnapshot: number;
  reason?: string;
  note?: string;
  status: RequisitionStatus;
  approverId?: string;
  approverName?: string;
  decidedAt?: string;
  rejectReason?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export type DateRangePreset = "today" | "7d" | "30d" | "this_month" | "custom";

export interface DateRange {
  from: string; // ISO date
  to: string; // ISO date
}

export const ROLE_LABEL_TH: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  warehouse: "พนักงานคลัง",
  sales: "พนักงานขาย",
  viewer: "ผู้ดูรายงาน",
};

export const SUPPLIER_CATEGORY_LABEL_TH: Record<SupplierCategory, string> = {
  fabric_mill: "โรงงานผลิตผ้า",
  garment_factory: "โรงงานตัดเย็บ",
  trim_accessory: "อุปกรณ์ตกแต่ง",
  packaging: "บรรจุภัณฑ์",
  water_gate: "ประตูน้ำ",
  other: "อื่น ๆ",
};

// ป้ายชื่อเริ่มต้น (seed) สำหรับประเภทอุปกรณ์มาตรฐาน — ใช้ตอน seed ทะเบียนครั้งแรก
// และเป็น fallback หากทะเบียนจาก Supabase (equipmentTypeOptions) ยังโหลดไม่เสร็จ
export const EQUIPMENT_TYPE_LABEL_TH: Record<string, string> = {
  packaging: "บรรจุภัณฑ์",
  hangtag: "ป้ายแท็ก",
  hanger: "ไม้แขวน",
  sticker: "สติกเกอร์",
  button_zipper: "กระดุม/ซิป",
  hook: "ตะขอ",
  pants_hook: "ตะขอกางเกง",
  zipper: "ซิป",
  thread: "ด้าย",
  needle: "เข็ม",
  clear_bag: "ถุงใส",
  bag_issa: "ถุงแบรนด์ ISSA",
  bag_fasonaf: "ถุงแบรนด์ Fasonaf",
  bag_issa_activewear: "ถุงแบรนด์ ISSA Activewear",
  hang_string: "เชือกห้อย",
  metal_tag: "ป้ายเหล็ก",
  repair: "อุปกรณ์ซ่อม",
  office: "อุปกรณ์สำนักงาน",
  other: "อื่น ๆ",
};

export const REQUISITION_STATUS_LABEL_TH: Record<RequisitionStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
  fulfilled: "เบิกเรียบร้อยแล้ว",
};

export const SALES_CHANNEL_LABEL_TH: Record<SalesChannel, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  facebook: "Facebook",
  instagram: "Instagram",
  store: "หน้าร้าน",
  website: "เว็บไซต์",
  other: "อื่น ๆ",
};

export const ORDER_STATUS_LABEL_TH: Record<OrderStatus, string> = {
  pending_payment: "รอชำระ",
  paid: "ชำระแล้ว",
  preparing: "กำลังจัดเตรียม",
  shipped: "จัดส่งแล้ว",
  completed: "สำเร็จ",
  cancelled: "ยกเลิก",
  returned: "คืนสินค้า",
};

export const TRANSFER_STATUS_LABEL_TH: Record<TransferStatus, string> = {
  pending: "รอดำเนินการ",
  shipping: "กำลังจัดส่ง",
  received: "ปลายทางได้รับแล้ว",
  cancelled: "ยกเลิก",
};

export const PRODUCT_STATUS_LABEL_TH: Record<ProductStatus, string> = {
  active: "พร้อมขาย",
  inactive: "ปิดการขายชั่วคราว",
  discontinued: "เลิกขาย",
};
