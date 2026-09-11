import type {
  AppNotification,
  AppUser,
  Brand,
  ColorCode,
  CompanyInfo,
  CustomSize,
  Equipment,
  EquipmentRequisition,
  EquipmentTypeOption,
  Invoice,
  Order,
  Product,
  PoSignatory,
  ProductShapeOption,
  ProductVariant,
  StockInDoc,
  StockLevel,
  StockMovement,
  StockOutDoc,
  StorefrontSettings,
  Supplier,
  SupplierImage,
  Transfer,
  UnitToken,
  Warehouse,
} from "@/lib/types";

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  announcementText: "ส่งฟรีเมื่อช้อปครบ ฿1,500 • เปลี่ยนไซซ์ง่าย",
  heroHeadingLine1: "Everyday,",
  heroHeadingLine2: "Effortlessly Better.",
  heroTagline: "ผ้าดี • ทรงสวย • ไม่ต้องรีด",
  promoHeadingLine1: "Buy 2, Save 10%.",
  promoHeadingLine2: "Buy 3, Save 15%.",
  promoSubtext: "ส่วนลดคำนวณให้อัตโนมัติที่ตะกร้า ไม่ต้องใช้โค้ด",
  contactPhone: "02-xxx-xxxx",
  socialLine: "https://line.me/ti/p/issaapparel",
  socialFacebook: "https://facebook.com/issaapparel",
  socialInstagram: "https://instagram.com/issaapparel",
  socialTiktok: "https://tiktok.com/@issaapparel",
  heroImageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDW5FEck25ju-fz2vAkbZvAqDrxJrbrj0gZ1rKlct-h7upvC6n7h781j_PKQjAeA_7XD81HMThgKfRyGw81bvKN4bBGoVBdc-isxzj33kam2HyrSzhDtVkt_WIFU8VrhCHC5Uvd0Za0ZHrHijS-WzP_jt3ENHg4vSgKt6ErI1z3j7KZKauFABl7E1wvO_5S9ge2Sw-UwMrpq31rLlvhbr3bVKMd6TM9UyYlHupcAQkSwOViSNsnHl0B",
  promoImageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDW5FEck25ju-fz2vAkbZvAqDrxJrbrj0gZ1rKlct-h7upvC6n7h781j_PKQjAeA_7XD81HMThgKfRyGw81bvKN4bBGoVBdc-isxzj33kam2HyrSzhDtVkt_WIFU8VrhCHC5Uvd0Za0ZHrHijS-WzP_jt3ENHg4vSgKt6ErI1z3j7KZKauFABl7E1wvO_5S9ge2Sw-UwMrpq31rLlvhbr3bVKMd6TM9UyYlHupcAQkSwOViSNsnHl0B",
};

export interface AppState {
  users: Record<string, AppUser>;
  currentUserId: string | null;
  warehouses: Record<string, Warehouse>;
  suppliers: Record<string, Supplier>;
  supplierImages: Record<string, SupplierImage>;
  brands: Record<string, Brand>;
  colorCodes: Record<string, ColorCode>; // key: code
  customSizes: Record<string, CustomSize>;
  products: Record<string, Product>;
  productShapeOptions: Record<string, ProductShapeOption>;
  variants: Record<string, ProductVariant>;
  variantStock: Record<string, StockLevel>; // key: `${variantId}::${warehouseId}`
  equipment: Record<string, Equipment>;
  equipmentStock: Record<string, StockLevel>; // key: `${equipmentId}::${warehouseId}`
  equipmentTypeOptions: Record<string, EquipmentTypeOption>; // key: code
  equipmentRequisitions: Record<string, EquipmentRequisition>;
  notifications: Record<string, AppNotification>;
  movements: Record<string, StockMovement>;
  stockInDocs: Record<string, StockInDoc>;
  stockOutDocs: Record<string, StockOutDoc>;
  transfers: Record<string, Transfer>;
  orders: Record<string, Order>;
  invoices: Record<string, Invoice>;
  docSeq: Record<string, number>;
  companyInfo: CompanyInfo;
  storefrontSettings: StorefrontSettings;
  poSignatories: Record<string, PoSignatory>;
  unitTokens: Record<string, UnitToken>;
  seededAt: string | null;
}

export function stockKey(itemId: string, warehouseId: string): string {
  return `${itemId}::${warehouseId}`;
}

export function emptyState(): AppState {
  return {
    users: {},
    currentUserId: null,
    warehouses: {},
    suppliers: {},
    supplierImages: {},
    brands: {},
    colorCodes: {},
    customSizes: {},
    products: {},
    productShapeOptions: {},
    variants: {},
    variantStock: {},
    equipment: {},
    equipmentStock: {},
    equipmentTypeOptions: {},
    equipmentRequisitions: {},
    notifications: {},
    movements: {},
    stockInDocs: {},
    stockOutDocs: {},
    transfers: {},
    orders: {},
    invoices: {},
    docSeq: {},
    companyInfo: { name: "ISSA Apparel" },
    storefrontSettings: { ...DEFAULT_STOREFRONT_SETTINGS },
    poSignatories: {},
    unitTokens: {},
    seededAt: null,
  };
}
