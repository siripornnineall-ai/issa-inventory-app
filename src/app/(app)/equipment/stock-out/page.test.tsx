import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import EquipmentStockOutPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: vi.fn() }));

const iso = "2026-11-17T00:00:00.000Z";
const eq = (id: string, size: string) => ({
  id,
  name: "เลเบิ้ล Issa",
  code: `EQ-${id}`,
  type: "label",
  size,
  images: [],
  purchasePricePerUnit: 100,
  unit: "โหล",
  reorderPoint: 0,
  reorderQty: 0,
  status: "active",
  createdAt: iso,
  updatedAt: iso,
});
const stock = (id: string, qty: number) => ({ itemId: id, warehouseId: "w1", qtyOnHand: qty, qtyReserved: 0 });

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "เบิก", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    equipment: { eS: eq("eS", "S"), eM: eq("eM", "M"), eL: eq("eL", "L") },
    equipmentStock: { "eS::w1": stock("eS", 10), "eM::w1": stock("eM", 3), "eL::w1": stock("eL", 0) },
  } as never);
}

function openGroup() {
  fireEvent.change(screen.getByPlaceholderText(/ค้นหาอุปกรณ์/), { target: { value: "เล" } });
  fireEvent.click(screen.getByRole("button", { name: /เลเบิ้ล Issa \(M\)/ }));
}
const cell = (size: string) => screen.getByLabelText(`เบิก เลเบิ้ล Issa ${size}`) as HTMLInputElement;
const save = () =>
  act(() => {
    screen.getAllByRole("button", { name: "บันทึกการเบิกออก" })[0].click();
  });

describe("หน้าเบิกอุปกรณ์ออก: ตารางกรอกรายไซซ์", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    toastError.mockClear();
    seed();
  });

  it("เลือกอุปกรณ์ → ตารางรายไซซ์ มีคงเหลือแต่ละไซซ์ กรอกบางช่องแล้วบันทึกเฉพาะช่องที่กรอก สต็อกถูกตัดตามจำนวน", () => {
    render(<EquipmentStockOutPage />);
    openGroup();
    expect(screen.getByText("เบิกออก (โหล)")).toBeTruthy();
    fireEvent.change(cell("S"), { target: { value: "2" } });
    fireEvent.change(cell("M"), { target: { value: "1" } });
    save();
    const docs = Object.values(useStore.getState().stockOutDocs);
    expect(docs).toHaveLength(1);
    expect(docs[0].lines.map((l) => [l.itemId, l.qty])).toEqual([["eS", 2], ["eM", 1]]);
    expect(useStore.getState().equipmentStock["eS::w1"].qtyOnHand).toBe(8);
    expect(useStore.getState().equipmentStock["eM::w1"].qtyOnHand).toBe(2);
    expect(useStore.getState().equipmentStock["eL::w1"].qtyOnHand).toBe(0);
  });

  it("กรอกเกินคงเหลือ → ช่องขึ้นแดง และบันทึกไม่ผ่าน ไม่ตัดสต็อก", () => {
    render(<EquipmentStockOutPage />);
    openGroup();
    fireEvent.change(cell("L"), { target: { value: "5" } }); // คงเหลือ 0
    expect(cell("L").className).toContain("danger");
    expect(cell("S").className).not.toContain("danger");
    save();
    expect(toastError).toHaveBeenCalled();
    expect(Object.keys(useStore.getState().stockOutDocs)).toHaveLength(0);
    expect(useStore.getState().equipmentStock["eL::w1"].qtyOnHand).toBe(0);
  });

  it("ไม่กรอกจำนวนเลย → แจ้งเตือนให้กรอกอย่างน้อย 1 ช่อง ไม่บันทึก", () => {
    render(<EquipmentStockOutPage />);
    openGroup();
    save();
    expect(toastError).toHaveBeenCalledWith("กรุณากรอกจำนวนเบิกออกอย่างน้อย 1 ช่อง");
    expect(Object.keys(useStore.getState().stockOutDocs)).toHaveLength(0);
  });
});
