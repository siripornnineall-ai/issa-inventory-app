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

  it("สินค้าออกทุกรูปแบบเป็นสีเหลือง (ตรงกับแท็บสินค้าออกในประวัติ)", () => {
    const outTypes = ["sale", "transfer_out", "damaged", "lost", "photoshoot", "internal_use", "return_to_source", "send_to_store", "size_change", "color_change", "cancel_stock_in"] as const;
    for (const t of outTypes) {
      const { container, unmount } = render(<MovementTypeBadge type={t} />);
      expect(container.querySelector("span")!.className, t).toContain("--color-yellow");
      unmount();
    }
  });

  it("ประเภทอื่นคงสีเดิม (ของคืน = ส้มเดิม, แปลงรุ่น = ฟ้า) และรับเข้า/ปรับยอดไม่ปนกับสินค้าออก", () => {
    render(
      <>
        <MovementTypeBadge type="return_customer" />
        <MovementTypeBadge type="return_defective" />
        <MovementTypeBadge type="convert_out" />
        <MovementTypeBadge type="transfer_in" />
      </>
    );
    expect(cls("สินค้าคืน")).toContain("--color-warning");
    expect(cls("สินค้าตำหนิ")).toContain("--color-warning");
    expect(cls("ตัดตัวเปล่าไปเย็บ")).toContain("--color-info");
    expect(cls("โอนย้ายเข้า")).toContain("--color-success");
  });
});
