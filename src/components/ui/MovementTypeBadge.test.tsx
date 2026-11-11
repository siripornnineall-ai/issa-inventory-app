import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MovementTypeBadge } from "./Badge";

const cls = (label: string) => screen.getByText(label).className;

describe("ป้ายประเภทรายการในประวัติ", () => {
  it("รับสินค้าเข้า = เขียว, ขายสินค้า = เหลือง, ปรับยอด (นับสต็อก) = ม่วง", () => {
    render(
      <>
        <MovementTypeBadge type="stock_in" />
        <MovementTypeBadge type="sale" />
        <MovementTypeBadge type="adjustment" />
      </>
    );
    expect(cls("รับสินค้าเข้า")).toContain("--color-success");
    expect(cls("ขายสินค้า")).toContain("--color-yellow");
    expect(cls("ปรับยอด")).toContain("--color-purple");
  });

  it("ประเภทอื่นคงสีเดิม (ของเสียหาย = แดง, ของคืน = ส้มเดิม, โอนย้าย = ฟ้า)", () => {
    render(
      <>
        <MovementTypeBadge type="damaged" />
        <MovementTypeBadge type="return_customer" />
        <MovementTypeBadge type="transfer_out" />
      </>
    );
    expect(cls("สินค้าเสียหาย")).toContain("--color-danger");
    expect(cls("สินค้าคืน")).toContain("--color-warning");
    expect(cls("โอนย้ายออก")).toContain("--color-info");
  });
});
