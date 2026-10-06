import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import EquipmentStockOverviewPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

function eq(id: string, name: string, size?: string, type = "packaging") {
  return { id, name, size, code: id, type, images: [], purchasePricePerUnit: 3, unit: "ม้วน", reorderPoint: 5, reorderQty: 10, status: "active", createdAt: "2026-10-05T00:00:00.000Z", updatedAt: "2026-10-05T00:00:00.000Z" };
}

describe("หน้าสต็อกภาพรวมอุปกรณ์", () => {
  beforeEach(() => {
    cleanup();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "2026-10-05T00:00:00.000Z" }, w2: { id: "w2", name: "คลังสอง", type: "branch", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
      equipment: { a: eq("a", "เลเบิ้ล Issa", "M"), b: eq("b", "เลเบิ้ล Issa", "S"), c: eq("c", "ซิป") },
      equipmentStock: {
        "a::w1": { itemId: "a", warehouseId: "w1", qtyOnHand: 30, qtyReserved: 0 },
        "a::w2": { itemId: "a", warehouseId: "w2", qtyOnHand: 5, qtyReserved: 0 },
        "b::w1": { itemId: "b", warehouseId: "w1", qtyOnHand: 10, qtyReserved: 0 },
        "c::w1": { itemId: "c", warehouseId: "w1", qtyOnHand: 7, qtyReserved: 0 },
      },
    } as never);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("แสดงอุปกรณ์เป็นการ์ดต่อรายการ คอลัมน์ไซซ์ รวมทุกคลัง และกรองตามคลังได้", () => {
    render(<EquipmentStockOverviewPage />);
    expect(screen.getAllByText("เลเบิ้ล Issa")).toHaveLength(1);
    expect(screen.getAllByText("45").length).toBeGreaterThan(0); // 30 + 5 + 10 รวมทุกคลัง (หัวการ์ด + คอลัมน์รวม)
    fireEvent.change(screen.getByLabelText("คลัง"), { target: { value: "w2" } });
    expect(screen.queryByText("45")).toBeNull();
    expect(screen.getAllByText("5").length).toBeGreaterThan(0); // คลังสองมีแค่ M = 5
  });

  it("ค้นหาแล้วเลื่อนไปที่การ์ดของรายการนั้น", () => {
    render(<EquipmentStockOverviewPage />);
    fireEvent.change(screen.getByPlaceholderText(/ค้นหาอุปกรณ์/), { target: { value: "ซิป" } });
    fireEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
