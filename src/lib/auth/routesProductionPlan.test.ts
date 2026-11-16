import { describe, it, expect } from "vitest";
import { requiredPermForPath } from "./routes";
import { NAV_SECTIONS } from "@/components/layout/nav";

describe("สิทธิ์หน้าวางแผนผลิต", () => {
  it("ทุกคนที่ดูสินค้าได้ (view.products) เข้าหน้านี้ได้ ไม่ต้องมีสิทธิ์ดูรายงาน", () => {
    expect(requiredPermForPath("/production-plan")).toBe("view.products");
  });

  it("เมนูวางแผนผลิตไม่ต้องใช้สิทธิ์เพิ่ม", () => {
    const item = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/production-plan");
    expect(item).toBeTruthy();
    expect(item?.perm).toBeUndefined();
  });
});
