import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // ชื่อไอคอนจาก lucide-react
  perm?: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "ภาพรวม",
    items: [{ href: "/dashboard", label: "แดชบอร์ด", icon: "LayoutGrid" }],
  },
  {
    title: "สินค้า",
    items: [
      { href: "/products", label: "สินค้าทั้งหมด", icon: "Package" },
      { href: "/products/new", label: "เพิ่มสินค้าใหม่", icon: "PackagePlus", perm: "product.write" },
      { href: "/products/labels", label: "พิมพ์บาร์โค้ด", icon: "Barcode", perm: "product.write" },
      { href: "/stock-in", label: "รับสินค้าเข้า", icon: "LogIn", perm: "stock.in" },
      { href: "/stock-out", label: "เบิกสินค้าออก", icon: "LogOut", perm: "stock.out" },
      { href: "/transfer", label: "โอนย้ายสต็อก", icon: "ArrowLeftRight", perm: "stock.transfer" },
      { href: "/stock-count", label: "นับสต็อก", icon: "ClipboardList", perm: "stock.adjust" },
      { href: "/low-stock", label: "สินค้าใกล้หมด", icon: "AlertTriangle" },
    ],
  },
  {
    title: "อุปกรณ์",
    items: [
      { href: "/equipment", label: "อุปกรณ์ทั้งหมด", icon: "Wrench" },
      { href: "/equipment/new", label: "เพิ่มอุปกรณ์ใหม่", icon: "PackagePlus", perm: "equipment.write" },
      { href: "/equipment/stock-in", label: "รับอุปกรณ์เข้า", icon: "LogIn", perm: "stock.in" },
      { href: "/equipment/stock-out", label: "เบิกอุปกรณ์ออก", icon: "LogOut", perm: "stock.out" },
      { href: "/equipment/transfer", label: "โอนย้ายอุปกรณ์", icon: "ArrowLeftRight", perm: "stock.transfer" },
      { href: "/equipment/low-stock", label: "อุปกรณ์ใกล้หมด", icon: "AlertTriangle" },
      { href: "/equipment/requisitions", label: "คำขอเบิกอุปกรณ์", icon: "ClipboardList" },
    ],
  },
  {
    title: "ข้อมูลทั่วไป",
    items: [
      { href: "/orders", label: "คำสั่งซื้อ", icon: "ShoppingCart" },
      { href: "/purchase-orders", label: "ใบสั่งซื้อ (PO)", icon: "FileText" },
      { href: "/invoices", label: "ใบกำกับภาษี", icon: "Receipt" },
      { href: "/history", label: "ประวัติการเคลื่อนไหว", icon: "History" },
      { href: "/suppliers", label: "ร้านค้าและซัพพลายเออร์", icon: "Truck" },
      { href: "/reports", label: "รายงาน", icon: "BarChart3", perm: "report.view" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { href: "/settings", label: "ตั้งค่า", icon: "Settings" },
      { href: "/users", label: "ผู้ใช้งานและสิทธิ์", icon: "Users", perm: "user.manage" },
    ],
  },
];
