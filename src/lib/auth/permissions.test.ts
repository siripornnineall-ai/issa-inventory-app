import { describe, it, expect } from "vitest";
import { hasPermission, assertPermission, canViewCost, PermissionError } from "./permissions";

describe("hasPermission", () => {
  it("grants admins every permission relevant to stock operations", () => {
    expect(hasPermission("admin", "stock.in")).toBe(true);
    expect(hasPermission("admin", "stock.out")).toBe(true);
    expect(hasPermission("admin", "user.manage")).toBe(true);
  });

  it("restricts sales staff to order and stock-out actions only", () => {
    expect(hasPermission("sales", "order.create")).toBe(true);
    expect(hasPermission("sales", "stock.out")).toBe(true);
    expect(hasPermission("sales", "stock.in")).toBe(false);
    expect(hasPermission("sales", "product.write")).toBe(false);
  });

  it("restricts viewers to read-only report permissions", () => {
    expect(hasPermission("viewer", "report.view")).toBe(true);
    expect(hasPermission("viewer", "stock.in")).toBe(false);
    expect(hasPermission("viewer", "stock.out")).toBe(false);
  });

  it("denies every permission when no role is provided", () => {
    expect(hasPermission(undefined, "report.view")).toBe(false);
  });
});

describe("assertPermission", () => {
  it("throws PermissionError when the role lacks the permission", () => {
    expect(() => assertPermission("viewer", "stock.in")).toThrow(PermissionError);
  });

  it("does not throw when the role has the permission", () => {
    expect(() => assertPermission("warehouse", "stock.in")).not.toThrow();
  });
});

describe("canViewCost", () => {
  it("defers to the role's default when no override is given", () => {
    expect(canViewCost("admin")).toBe(true);
    expect(canViewCost("sales")).toBe(false);
  });

  it("lets an explicit override take precedence over the role default", () => {
    expect(canViewCost("sales", true)).toBe(true);
    expect(canViewCost("admin", false)).toBe(false);
  });
});
