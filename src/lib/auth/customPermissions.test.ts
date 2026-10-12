import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES, cloneRolePermissions, effectivePermissions, hasPermission, userCanViewCost, userHasPermission } from "./permissions";
import { requiredPermForPath } from "./routes";
import { emptyState } from "@/lib/store/state";
import { resetRolePermissions, setRolePermission, setUserPermissions, BusinessRuleError } from "@/lib/store/engine";

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

describe("สิทธิ์รายบุคคล", () => {
  it("ไม่กำหนดเอง = ตามตำแหน่ง / กำหนดเอง = ใช้รายการของคนนั้นแทนทั้งชุด", () => {
    expect(userHasPermission({ role: "warehouse" }, "stock.in")).toBe(true);
    const custom = { role: "warehouse" as const, customPermissions: ["stock.in", "view.dashboard"] };
    expect(userHasPermission(custom, "stock.in")).toBe(true);
    expect(userHasPermission(custom, "stock.out")).toBe(false); // ตำแหน่งให้ แต่ถูกกำหนดเองให้ไม่มี
    expect(userHasPermission({ role: "viewer", customPermissions: ["stock.out"] }, "stock.out")).toBe(true); // เพิ่มให้เกินตำแหน่งได้
  });

  it("สิทธิ์เฉพาะผู้ดูแลระบบยังตามตำแหน่งเสมอ (ตั้งรายบุคคลไม่ได้) และผู้ดูแลระบบได้ทุกอย่าง", () => {
    expect(userHasPermission({ role: "warehouse", customPermissions: ["user.admin"] }, "user.admin")).toBe(false);
    expect(userHasPermission({ role: "manager", customPermissions: [] }, "user.manage")).toBe(true);
    expect(userHasPermission({ role: "admin", customPermissions: [] }, "stock.out")).toBe(true);
    expect(userHasPermission(null, "stock.out")).toBe(false);
  });

  it("effectivePermissions ใช้เติมค่าเริ่มต้นตอนกด กำหนดเอง", () => {
    expect([...effectivePermissions({ role: "sales" })].sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS.sales].sort());
  });

  it("ดูราคาทุน: ตัวเลือกรายคนมาก่อน แล้วตามด้วยสิทธิ์ cost.view ของคนนั้น", () => {
    expect(userCanViewCost({ role: "sales" })).toBe(false);
    expect(userCanViewCost({ role: "sales", customPermissions: ["cost.view"] })).toBe(true);
    expect(userCanViewCost({ role: "manager", canViewCost: false })).toBe(false);
  });

  it("engine: ตั้ง/ล้างสิทธิ์รายบุคคล กรองสิทธิ์ที่ไม่รู้จักและสิทธิ์เฉพาะผู้ดูแลระบบออก ผู้ดูแลระบบตั้งไม่ได้", () => {
    const base = emptyState();
    base.users = {
      w: { id: "w", name: "นัท", email: "n@x.com", role: "warehouse", active: true, createdAt: "2026-10-05T00:00:00.000Z" },
      a: { id: "a", name: "admin", email: "a@x.com", role: "admin", active: true, createdAt: "2026-10-05T00:00:00.000Z" },
    };
    const s1 = produce(base, (d) => setUserPermissions(d as never, "w", ["stock.in", "stock.in", "user.admin", "nope", "view.orders"]));
    expect(s1.users.w.customPermissions).toEqual(["stock.in", "view.orders"]);
    const s2 = produce(s1, (d) => setUserPermissions(d as never, "w", null));
    expect(s2.users.w.customPermissions).toBeUndefined();
    expect(() => produce(base, (d) => setUserPermissions(d as never, "a", ["stock.in"]))).toThrow(BusinessRuleError);
    expect(() => produce(base, (d) => setUserPermissions(d as never, "missing", ["stock.in"]))).toThrow(BusinessRuleError);
  });
});