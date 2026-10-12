import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES, cloneRolePermissions, hasPermission } from "./permissions";
import { requiredPermForPath } from "./routes";
import { emptyState } from "@/lib/store/state";
import { resetRolePermissions, setRolePermission, BusinessRuleError } from "@/lib/store/engine";

describe("ตารางสิทธิ์ค่าเริ่มต้น (ต้องเท่ากับของเดิมก่อนทำให้กำหนดเองได้)", () => {
  it("พนักงานขาย: สร้าง/ยกเลิกคำสั่งซื้อและเบิกออกได้ แต่รับเข้า/แก้สินค้าไม่ได้", () => {
    expect(hasPermission("sales", "order.create")).toBe(true);
    expect(hasPermission("sales", "stock.out")).toBe(true);
    expect(hasPermission("sales", "stock.in")).toBe(false);
    expect(hasPermission("sales", "product.write")).toBe(false);
  });
  it("พนักงานคลัง: รับเข้า/เบิกออก/โอน/นับสต็อกได้ แต่ไม่เห็นต้นทุนและสร้างคำสั่งซื้อไม่ได้", () => {
    for (const p of ["stock.in", "stock.out", "stock.transfer", "stock.adjust", "product.write"] as const) expect(hasPermission("warehouse", p)).toBe(true);
    expect(hasPermission("warehouse", "cost.view")).toBe(false);
    expect(hasPermission("warehouse", "order.create")).toBe(false);
  });
  it("ผู้ดูรายงาน: ดู/ส่งออกรายงานเท่านั้น และผู้ดูแลระบบได้ทุกสิทธิ์", () => {
    expect(hasPermission("viewer", "report.view")).toBe(true);
    expect(hasPermission("viewer", "stock.out")).toBe(false);
    for (const p of ALL_PERMISSIONS) expect(hasPermission("admin", p)).toBe(true);
  });
  it("ทุกตำแหน่งเห็นทุกหน้าตามเดิม (ยกเว้นหน้ารายงานและผู้ใช้ที่มีสิทธิ์ของตัวเอง)", () => {
    for (const r of ROLES) for (const p of ALL_PERMISSIONS.filter((x) => x.startsWith("view."))) expect(hasPermission(r, p)).toBe(true);
  });
});

describe("กำหนดสิทธิ์เอง", () => {
  it("ใช้ตารางที่ส่งเข้าไปแทนค่าเริ่มต้น แต่ผู้ดูแลระบบได้ทุกอย่างเสมอแม้ตารางไม่มี", () => {
    const m = cloneRolePermissions();
    m.sales = m.sales.filter((p) => p !== "view.history");
    m.admin = [];
    expect(hasPermission("sales", "view.history", m)).toBe(false);
    expect(hasPermission("sales", "view.orders", m)).toBe(true);
    expect(hasPermission("admin", "stock.out", m)).toBe(true);
  });

  it("engine: ให้/ถอนสิทธิ์ได้ ผู้ดูแลระบบและสิทธิ์เฉพาะผู้ดูแลระบบแก้ไม่ได้", () => {
    const s0 = emptyState();
    const s1 = produce(s0, (d) => setRolePermission(d as never, "sales", "stock.in", true));
    expect(s1.rolePermissions.sales).toContain("stock.in");
    const s2 = produce(s1, (d) => setRolePermission(d as never, "sales", "stock.in", false));
    expect(s2.rolePermissions.sales).not.toContain("stock.in");
    expect(() => produce(s0, (d) => setRolePermission(d as never, "admin", "stock.in", false))).toThrow(BusinessRuleError);
    for (const p of ADMIN_ONLY_PERMISSIONS) expect(() => produce(s0, (d) => setRolePermission(d as never, "manager", p, true))).toThrow(BusinessRuleError);
    // ไม่กระทบค่าเริ่มต้นของระบบ
    expect(DEFAULT_ROLE_PERMISSIONS.sales).not.toContain("stock.in");
  });

  it("engine: คืนค่าเริ่มต้นของตำแหน่ง", () => {
    const s1 = produce(emptyState(), (d) => {
      setRolePermission(d as never, "viewer", "stock.out", true);
      setRolePermission(d as never, "viewer", "view.history", false);
    });
    const s2 = produce(s1, (d) => resetRolePermissions(d as never, "viewer"));
    expect([...s2.rolePermissions.viewer].sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS.viewer].sort());
  });
});

describe("requiredPermForPath", () => {
  it("หน้าย่อยใช้สิทธิ์ของหน้าหลัก และหน้าที่ไม่อยู่ในรายการไม่ถูกกัน", () => {
    expect(requiredPermForPath("/products/abc/labels")).toBe("view.products");
    expect(requiredPermForPath("/equipment/stock-overview")).toBe("view.equipment");
    expect(requiredPermForPath("/history")).toBe("view.history");
    expect(requiredPermForPath("/stock-in")).toBeUndefined();
    expect(requiredPermForPath("/productsX")).toBeUndefined();
  });
});
