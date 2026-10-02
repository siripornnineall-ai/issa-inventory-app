import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import StockOverviewPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { Product, ProductVariant } from "@/lib/types";

vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

const scrollIntoView = vi.fn();

function seed() {
  const products: Record<string, Product> = {};
  const variants: Record<string, ProductVariant> = {};
  const variantStock: Record<string, { itemId: string; warehouseId: string; qtyOnHand: number; qtyReserved: number }> = {};
  const models: [string, string, string][] = [
    ["p1", "Billie Slim", "BS"],
    ["p2", "Flow Wide", "FW"],
    ["p3", "Bruno Slim", "BRS"],
  ];
  models.forEach(([id, name, code], i) => {
    products[id] = { id, sellingName: name, modelCode: code, brandId: "b1" } as unknown as Product;
    const vid = id + "-ดำ-S";
    variants[vid] = { id: vid, productId: id, color: "ดำ", size: "S", sku: vid, active: true } as unknown as ProductVariant;
    variantStock[vid + "::w1"] = { itemId: vid, warehouseId: "w1", qtyOnHand: (i + 1) * 10, qtyReserved: 0 };
  });
  useStore.getState().actions.hydrate({
    ...emptyState(),
    products,
    variants,
    variantStock,
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "" } },
  } as never);
}

describe("หน้าสต็อกภาพรวม", () => {
  beforeEach(() => {
    cleanup();
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
    seed();
  });

  it("no longer has the model summary table, and lists every model's matrix", () => {
    render(<StockOverviewPage />);
    expect(screen.queryByText("สรุปแต่ละรุ่น")).toBeNull();
    for (const id of ["p1", "p2", "p3"]) expect(document.getElementById("model-" + id)).not.toBeNull();
  });

  it("jumps to the searched model's table on Enter, keeping the other models on the page", () => {
    render(<StockOverviewPage />);
    const input = document.getElementById("so-search") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "flow" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("model-p2"));
    expect(document.getElementById("model-p1")).not.toBeNull();
    expect(document.getElementById("model-p3")).not.toBeNull();
  });

  it("jumps via the search button, and matches model codes too", () => {
    render(<StockOverviewPage />);
    fireEvent.change(document.getElementById("so-search") as HTMLInputElement, { target: { value: "brs" } });
    fireEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("model-p3"));
  });

  it("offers matching models as suggestions and jumps to the one picked", () => {
    render(<StockOverviewPage />);
    const input = document.getElementById("so-search") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "slim" } });
    // เฉพาะรายการแนะนำ (ไม่รวมตัวเลือกใน dropdown แบรนด์/คลัง) เรียงตามสต็อกมากไปน้อย
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("Bruno Slim");
    expect(options[1].textContent).toContain("Billie Slim");
    fireEvent.click(screen.getByText("Billie Slim", { selector: "span.block.truncate" }));
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("model-p1"));
  });

  it("says so, and does not scroll, when nothing matches", () => {
    render(<StockOverviewPage />);
    const input = document.getElementById("so-search") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzz" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByText(/ไม่พบรุ่นที่ตรงกับ/)).toBeTruthy();
  });

  it("does nothing on an empty search", () => {
    render(<StockOverviewPage />);
    fireEvent.keyDown(document.getElementById("so-search") as HTMLInputElement, { key: "Enter" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
