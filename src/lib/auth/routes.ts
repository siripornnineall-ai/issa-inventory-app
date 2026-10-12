import type { Permission } from "./permissions";

// หน้าไหนต้องมีสิทธิ์ "เข้าถึงหน้า" อะไร (ดูจากต้นทางของ path) ใช้ทั้งซ่อนเมนูและกันเข้าหน้าตรง ๆ
// หน้าที่ไม่อยู่ในรายการ (เช่นหน้าพิมพ์ ใบเสร็จ) ใช้สิทธิ์ของตัวเองตามเดิม
const ROUTE_VIEW_PERMS: [string, Permission][] = [
  ["/dashboard", "view.dashboard"],
  ["/products", "view.products"],
  ["/stock-overview", "view.products"],
  ["/low-stock", "view.products"],
  ["/stock-count", "view.products"],
  ["/equipment", "view.equipment"],
  ["/orders", "view.orders"],
  ["/purchase-orders", "view.purchase_orders"],
  ["/invoices", "view.invoices"],
  ["/history", "view.history"],
  ["/suppliers", "view.suppliers"],
  ["/settings", "view.settings"],
  ["/reports", "report.view"],
  ["/users", "user.manage"],
];

export function requiredPermForPath(pathname: string): Permission | undefined {
  for (const [prefix, perm] of ROUTE_VIEW_PERMS) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return perm;
  }
  return undefined;
}
