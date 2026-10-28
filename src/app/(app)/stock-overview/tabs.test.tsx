import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import StockOverviewPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("@/components/layout/Header", () => ({ Header: ({ title, description }: { title: string; description?: string }) => (
  <header>
    <h1>{title}</h1>
    <p>{description}</p>
  </header>
) }));

const thisMonth = () => {
  const d = new Date();
  d.setDate(15);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

function seed() {
  const at = thisMonth();
  useStore.getState().actions.hydrate({
    ...emptyState(),
    brands: {
      b1: { id: "b1", name: "ISSA Apparel", code: "IS", active: true, createdAt: "" },
      b2: { id: "b2", name: "Fasonaf", code: "FS", active: true, createdAt: "" },
    },
    warehouses: { w1: { id: "w1", name: "คลัง", type: "main", active: true, createdAt: "" } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", createdAt: "" } },
    variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "a", active: true } },
    variantStock: { "v1::w1": { itemId: "v1", warehouseId: "w1", qtyOnHand: 7, qtyReserved: 0 } },
    orders: { o1: { id: "o1", orderNo: "o1", date: at, channel: "online", warehouseId: "w1", lines: [{ id: "l", productId: "p1", variantId: "v1", qty: 3, unitPrice: 1, discount: 0 }], status: "completed", restocked: false, createdAt: at } },
    movements: {
      m1: { id: "m1", createdAt: at, refNo: "ADJ-1", itemType: "product", itemId: "v1", variantId: "v1", itemName: "x", sku: "a", movementType: "adjustment", qtyChange: -2, qtyBefore: 12, qtyAfter: 10, warehouseToId: "w1", reason: "นับสต็อก — Billie Slim", actorId: "u", actorName: "u" },
    },
  } as never);
}

describe("สต็อกภาพรวม: แท็บสต็อกปัจจุบัน / ยอดขาย / สต็อกนับใหม่", () => {
  beforeEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/stock-overview");
    Element.prototype.scrollIntoView = vi.fn();
    seed();
  });

  it("เปิดมาที่แท็บสต็อกปัจจุบัน (ตารางสต็อกเดิม) และมีครบ 3 แท็บ", () => {
    render(<StockOverviewPage />);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["สต็อกปัจจุบัน", "ยอดขาย", "สต็อกนับใหม่"]);
    expect(screen.getByRole("tab", { name: "สต็อกปัจจุบัน" }).getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("model-p1")).not.toBeNull();
  });

  it("กดแท็บยอดขายและสต็อกนับใหม่ สลับเนื้อหา และจำแท็บไว้ใน URL", () => {
    render(<StockOverviewPage />);
    fireEvent.click(screen.getByRole("tab", { name: "ยอดขาย" }));
    expect(screen.getByRole("tab", { name: "ยอดขาย" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("ยอดขายสุทธิเดือน");
    expect(window.location.search).toBe("?tab=sales");

    fireEvent.click(screen.getByRole("tab", { name: "สต็อกนับใหม่" }));
    expect(screen.getByRole("status").textContent).toContain("ผลนับสต็อกเดือน");
    expect(window.location.search).toBe("?tab=recount");

    fireEvent.click(screen.getByRole("tab", { name: "สต็อกปัจจุบัน" }));
    expect(window.location.search).toBe("");
    expect(document.getElementById("model-p1")).not.toBeNull();
  });

  it("เปิดลิงก์ที่ระบุ ?tab=sales ตรงแท็บยอดขาย", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=sales");
    render(<StockOverviewPage />);
    expect(screen.getByRole("tab", { name: "ยอดขาย" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("3 ชิ้น");
  });

  it("แท็บสต็อกนับใหม่: เทียบยอดที่นับได้กับระบบก่อนนับ และสต็อกตอนนี้ ในรุ่นเดียวกัน", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    const status = screen.getByRole("status").textContent ?? "";
    expect(status).toContain("นับได้ 10 ชิ้น");
    expect(status).toContain("ระบบก่อนนับ 12 ชิ้น");
    expect(status).toContain("-2");
    const table = screen.getAllByRole("table")[0];
    const row = within(table).getAllByRole("row")[1];
    expect(row.textContent).toContain("ดำ");
    expect(row.textContent).toContain("ระบบ 12"); // ช่องที่ไม่ตรงโชว์ยอดระบบ
    expect(row.textContent).toContain("7"); // สต็อกตอนนี้
  });

  it("แบรนด์ที่เลือกไว้ใช้ร่วมกันข้ามแท็บ", () => {
    render(<StockOverviewPage />);
    fireEvent.change(screen.getByLabelText("แบรนด์"), { target: { value: "b2" } });
    fireEvent.click(screen.getByRole("tab", { name: "ยอดขาย" }));
    expect((screen.getByLabelText("แบรนด์") as HTMLSelectElement).value).toBe("b2");
    fireEvent.click(screen.getByRole("tab", { name: "สต็อกนับใหม่" }));
    expect((screen.getByLabelText("แบรนด์") as HTMLSelectElement).value).toBe("b2");
    expect(screen.getByText("ไม่พบรุ่นที่ตรงกับตัวกรอง")).toBeTruthy();
  });

  it("เดือนที่ไม่มีการนับ: บอกว่ายังไม่มีการนับ พร้อมลิงก์ไปหน้านับสต็อก", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    expect(screen.getByText("เดือนนี้ยังไม่มีการนับสต็อก")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ไปหน้านับสต็อก" }).getAttribute("href")).toBe("/stock-count");
  });
});
