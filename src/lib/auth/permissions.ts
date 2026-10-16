import type { UserRole } from "@/lib/types";

export type Permission =
  | "product.write"
  | "equipment.write"
  | "master.write" // ร้านค้า/คลัง
  | "stock.in"
  | "stock.out"
  | "order.create"
  | "order.cancel"
  | "stock.transfer"
  | "stock.adjust"
  | "cost.view"
  | "report.view"
  | "report.export"
  | "user.manage"
  | "user.admin" // สร้างบัญชี/ตั้งรหัสผ่านให้คนอื่น/ลบผู้ใช้งาน — เฉพาะผู้ดูแลระบบเท่านั้น (ตรงกับที่ Edge Function admin-users ตรวจ)
  | "settings.write"
  | "requisition.create"
  | "requisition.approve"
  // สิทธิ์เข้าถึงหน้า: ซ่อนเมนูและกันเข้าหน้านั้นบนหน้าจอ (ข้อมูลในฐานข้อมูลยังอ่านได้ตามเดิม ส่วนการแก้ไขถูกกันด้วยสิทธิ์ด้านบน)
  | "view.dashboard"
  | "view.products"
  | "view.equipment"
  | "view.orders"
  | "view.purchase_orders"
  | "view.invoices"
  | "view.history"
  | "view.suppliers"
  | "view.settings";

export type RolePermissionMap = Record<UserRole, Permission[]>;

export const ROLES: UserRole[] = ["admin", "manager", "warehouse", "sales", "viewer"];

const VIEW_ALL: Permission[] = [
  "view.dashboard",
  "view.products",
  "view.equipment",
  "view.orders",
  "view.purchase_orders",
  "view.invoices",
  "view.history",
  "view.suppliers",
  "view.settings",
];

const ADMIN_PERMS: Permission[] = [
  "product.write",
  "equipment.write",
  "master.write",
  "stock.in",
  "stock.out",
  "order.create",
  "order.cancel",
  "stock.transfer",
  "stock.adjust",
  "cost.view",
  "report.view",
  "report.export",
  "user.manage",
  "user.admin",
  "settings.write",
  "requisition.create",
  "requisition.approve",
  ...VIEW_ALL,
];

// ค่าเริ่มต้นของแต่ละตำแหน่ง (ผู้ดูแลระบบปรับเองได้ที่หน้า ผู้ใช้งานและสิทธิ์ แล้วเก็บในฐานข้อมูล)
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  admin: ADMIN_PERMS,
  manager: [
    "product.write",
    "equipment.write",
    "master.write",
    "stock.in",
    "stock.out",
    "order.create",
    "order.cancel",
    "stock.transfer",
    "stock.adjust",
    "cost.view",
    "report.view",
    "report.export",
    "user.manage",
    "requisition.approve",
    ...VIEW_ALL,
  ],
  // ทุกตำแหน่งที่ทำงานกับสต็อกต้องสแกนเข้า/ออกได้ ("ออก" แบบขายจะสร้างออเดอร์ด้วย จึงต้องมี order.create ไม่งั้นบันทึกไม่ผ่าน)
  warehouse: ["stock.in", "stock.out", "order.create", "stock.transfer", "stock.adjust", "product.write", "equipment.write", "requisition.create", ...VIEW_ALL],
  sales: ["order.create", "order.cancel", "stock.in", "stock.out", "requisition.create", ...VIEW_ALL],
  viewer: ["report.view", "report.export", ...VIEW_ALL],
};

export function cloneRolePermissions(m: RolePermissionMap = DEFAULT_ROLE_PERMISSIONS): RolePermissionMap {
  return Object.fromEntries(ROLES.map((r) => [r, [...m[r]]])) as RolePermissionMap;
}

// สิทธิ์ที่ผูกกับระบบหลังบ้านที่รองรับแค่ผู้ดูแลระบบ (จัดการบัญชีผู้ใช้ ฟังก์ชันสร้างบัญชี และการแก้หมายเหตุประวัติ) จึงให้ตำแหน่งอื่นไม่ได้
export const ADMIN_ONLY_PERMISSIONS: Permission[] = ["user.manage", "user.admin", "settings.write"];

export const ALL_PERMISSIONS: Permission[] = ADMIN_PERMS;

export interface PermissionItem {
  perm: Permission;
  label: string;
  hint?: string;
}

export const PERMISSION_GROUPS: { title: string; items: PermissionItem[] }[] = [
  {
    title: "เข้าถึงหน้าต่าง ๆ",
    items: [
      { perm: "view.dashboard", label: "แดชบอร์ด" },
      { perm: "view.products", label: "สินค้า (รายการ สต็อกภาพรวม สินค้าใกล้หมด นับสต็อก)" },
      { perm: "view.equipment", label: "อุปกรณ์" },
      { perm: "view.orders", label: "คำสั่งซื้อ" },
      { perm: "view.purchase_orders", label: "ใบสั่งซื้อ (PO)" },
      { perm: "view.invoices", label: "ใบกำกับภาษี" },
      { perm: "view.history", label: "ประวัติการเคลื่อนไหว" },
      { perm: "view.suppliers", label: "ร้านค้าและซัพพลายเออร์" },
      { perm: "view.settings", label: "ตั้งค่า" },
      { perm: "report.view", label: "รายงาน" },
    ],
  },
  {
    title: "สินค้าและอุปกรณ์",
    items: [
      { perm: "product.write", label: "เพิ่ม/แก้ไข/ลบสินค้า พิมพ์ป้าย", hint: "รวมสี ไซซ์ ทรง รูปภาพ" },
      { perm: "equipment.write", label: "เพิ่ม/แก้ไข/ลบอุปกรณ์" },
      { perm: "master.write", label: "จัดการร้านค้า ซัพพลายเออร์ แบรนด์ และคลัง" },
      { perm: "cost.view", label: "ดูราคาทุน/กำไร" },
    ],
  },
  {
    title: "สต็อก",
    items: [
      { perm: "stock.in", label: "รับเข้า" },
      { perm: "stock.out", label: "เบิกออก" },
      { perm: "stock.transfer", label: "โอนย้ายระหว่างคลัง" },
      { perm: "stock.adjust", label: "นับสต็อก/ปรับยอด" },
      { perm: "requisition.create", label: "ขอเบิกอุปกรณ์" },
      { perm: "requisition.approve", label: "อนุมัติคำขอเบิกอุปกรณ์" },
    ],
  },
  {
    title: "ขาย",
    items: [
      { perm: "order.create", label: "สร้างคำสั่งซื้อ/ใบกำกับภาษี" },
      { perm: "order.cancel", label: "ยกเลิกคำสั่งซื้อ" },
    ],
  },
  {
    title: "รายงานและระบบ",
    items: [
      { perm: "report.export", label: "ส่งออกรายงาน (Excel)" },
      { perm: "user.manage", label: "ดูหน้าผู้ใช้งานและสิทธิ์", hint: "เฉพาะผู้ดูแลระบบ" },
      { perm: "user.admin", label: "สร้างบัญชี ตั้งรหัสผ่าน ลบผู้ใช้", hint: "เฉพาะผู้ดูแลระบบ" },
      { perm: "settings.write", label: "แก้ตั้งค่าระบบ/หมายเหตุประวัติ", hint: "เฉพาะผู้ดูแลระบบ" },
    ],
  },
];

export class PermissionError extends Error {}

// ตารางสิทธิ์ที่ใช้งานอยู่ตอนนี้ (โหลดจากฐานข้อมูลแล้วอัปเดตเข้ามาที่นี่ผ่าน store) ค่าเริ่มต้นคือค่าตั้งต้นของระบบ
let activeMatrix: RolePermissionMap = DEFAULT_ROLE_PERMISSIONS;

export function setActiveRolePermissions(m: RolePermissionMap) {
  activeMatrix = m;
}

export function hasPermission(role: UserRole | undefined, perm: Permission, matrix: RolePermissionMap = activeMatrix): boolean {
  if (!role) return false;
  // ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอ กันตั้งค่าผิดแล้วล็อกตัวเองออก
  if (role === "admin") return true;
  return (matrix[role] ?? []).includes(perm);
}

export function assertPermission(role: UserRole | undefined, perm: Permission): void {
  if (!hasPermission(role, perm)) {
    throw new PermissionError("คุณไม่มีสิทธิ์ทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ");
  }
}

export interface PermissionSubject {
  role: UserRole;
  customPermissions?: string[];
}

// สิทธิ์ของบุคคล: ผู้ดูแลระบบได้ทุกอย่าง / ถ้าผู้ดูแลระบบกำหนดสิทธิ์ให้คนนี้เอง ใช้รายการของเขา / ไม่งั้นตามตำแหน่ง
// สิทธิ์ที่ให้ได้เฉพาะผู้ดูแลระบบ (จัดการบัญชี ฯลฯ) ยังตามตำแหน่งเสมอ ตั้งรายบุคคลไม่ได้ (ตรงกับกฎของฐานข้อมูล)
export function userHasPermission(user: PermissionSubject | null | undefined, perm: Permission, matrix: RolePermissionMap = activeMatrix): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.customPermissions && !ADMIN_ONLY_PERMISSIONS.includes(perm)) return user.customPermissions.includes(perm);
  return hasPermission(user.role, perm, matrix);
}

export function assertUserPermission(user: PermissionSubject | null | undefined, perm: Permission): void {
  if (!userHasPermission(user, perm)) {
    throw new PermissionError("คุณไม่มีสิทธิ์ทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ");
  }
}

// รายการสิทธิ์ที่คนนี้มีจริง ๆ (ใช้เติมค่าเริ่มต้นตอนกด "กำหนดเอง" และแสดงในหน้าแก้ไขผู้ใช้)
export function effectivePermissions(user: PermissionSubject, matrix: RolePermissionMap = activeMatrix): Permission[] {
  return ALL_PERMISSIONS.filter((p) => userHasPermission(user, p, matrix));
}

export function canViewCost(role: UserRole | undefined, override?: boolean, matrix?: RolePermissionMap): boolean {
  if (override !== undefined) return override;
  return hasPermission(role, "cost.view", matrix);
}

export function userCanViewCost(user: (PermissionSubject & { canViewCost?: boolean }) | null | undefined, matrix?: RolePermissionMap): boolean {
  if (user?.canViewCost !== undefined) return user.canViewCost;
  return userHasPermission(user, "cost.view", matrix);
}
