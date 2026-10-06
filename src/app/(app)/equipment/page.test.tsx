import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EquipmentPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

function eq(id: string, name: string, size?: string, price = 3) {
  return { id, name, size, code: `EQ-${id}`, type: "packaging", images: [], purchasePricePerUnit: price, unit: "ม้วน", reorderPoint: 2000, reorderQty: 50000, status: "active", createdAt: "2026-10-05T00:00:00.000Z", updatedAt: "2026-10-05T00:00:00.000Z" };
}

describe("หน้ารายการอุปกรณ์: รวมหลายไซซ์เป็นแถวเดียว", () => {
  beforeEach(() => {
    cleanup();
    const equipment: Record<string, unknown> = {};
    for (const [i, s] of ["XL", "S", "M", "L"].entries()) equipment[`e${i}`] = eq(`e${i}`, "เลเบิ้ล Issa", s, i === 3 ? 4 : 3);
    equipment.z = eq("z", "ซิป");
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
      equipment,
      equipmentStock: {
        "e0::w1": { itemId: "e0", warehouseId: "w1", qtyOnHand: 100, qtyReserved: 0 },
        "e1::w1": { itemId: "e1", warehouseId: "w1", qtyOnHand: 50, qtyReserved: 0 },
      },
    } as never);
  });

  it("เลเบิ้ล 4 ไซซ์แสดงแถวเดียว บอกจำนวนไซซ์ รวมสต็อก ไม่แยกเป็น 4 แถว", () => {
    render(<EquipmentPage />);
    expect(screen.getAllByText("เลเบิ้ล Issa").length).toBeGreaterThan(0);
    expect(screen.queryByText("เลเบิ้ล Issa (XL)")).toBeNull();
    expect(screen.queryByText(/ไซซ์:/)).toBeNull(); // ไม่โชว์รายชื่อไซซ์ในตารางรายการ
    // รวมสต็อก 100 + 50 และช่วงราคา 3 - 4
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/฿3\.00 - ฿4\.00/).length).toBeGreaterThan(0);
    // ทั้งหมด 2 รายการ (เลเบิ้ล + ซิป)
    expect(screen.getByText(/จากทั้งหมด 2 รายการ/)).toBeTruthy();
  });
});
