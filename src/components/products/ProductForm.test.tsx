import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProductForm } from "./ProductForm";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/products/new",
}));

describe("ProductForm: ถัดไป → ข้อมูลการขาย → บันทึก", () => {
  beforeEach(() => {
    cleanup();
    Element.prototype.scrollIntoView = vi.fn();
    useStore.getState().actions.hydrate(emptyState() as never);
  });

  it("หน้าแรกมีปุ่มถัดไปแต่ยังไม่มีปุ่มบันทึก กดถัดไปแล้วถึงมีปุ่มบันทึก", () => {
    render(<ProductForm />);
    expect(screen.queryByRole("button", { name: "บันทึกสินค้าใหม่" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ }));
    expect(screen.getByRole("button", { name: "บันทึกสินค้าใหม่" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ย้อนกลับ" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
    expect(screen.getByRole("button", { name: /ถัดไป/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "บันทึกสินค้าใหม่" })).toBeNull();
  });
});
