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
  | "requisition.approve";

const MATRIX: Record<UserRole, Permission[]> = {
  admin: [
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
  ],
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
  ],
  warehouse: ["stock.in", "stock.out", "stock.transfer", "stock.adjust", "product.write", "equipment.write", "requisition.create"],
  sales: ["order.create", "order.cancel", "stock.out", "requisition.create"],
  viewer: ["report.view", "report.export"],
};

export class PermissionError extends Error {}

export function hasPermission(role: UserRole | undefined, perm: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(perm);
}

export function assertPermission(role: UserRole | undefined, perm: Permission): void {
  if (!hasPermission(role, perm)) {
    throw new PermissionError("คุณไม่มีสิทธิ์ทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ");
  }
}

export function canViewCost(role: UserRole | undefined, override?: boolean): boolean {
  if (override !== undefined) return override;
  return hasPermission(role, "cost.view");
}
