import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import EquipmentTransferPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
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

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "โอน", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: {
      w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso },
      w2: { id: "w2", name: "คลังสอง", type: "branch", active: true, createdAt: iso },
    },
    equipment: { eS: eq("eS", "S"), eM: eq("eM", "M") },
    equipmentStock: {
      "eS::w1": { itemId: "eS", warehouseId: "w1", qtyOnHand: 10, qtyReserved: 0 },
      "eM::w1": { itemId: "eM", warehouseId: "w1", qtyOnHand: 2, qtyReserved: 0 },
    },
  } as never);
}

const cell = (size: string) => screen.getByLabelText(`โอน เลเบิ้ล Issa ${size}`) as HTMLInputElement;

describe("หน้าโอนย้ายอุปกรณ์: ตารางกรอกรายไซซ์", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    toastError.mockClear();
    seed();
  });

  function openGroup() {
    fireEvent.change(screen.getByPlaceholderText(/ค้นหาอุปกรณ์/), { target: { value: "เล" } });
    fireEvent.click(screen.getByRole("button", { name: /เลเบิ้ล Issa \(S\)/ }));
  }

  it("กรอกจำนวนบางไซซ์แล้วสร้างรายการโอน → ใบโอนมีเฉพาะช่องที่กรอก และฟอร์มถูกล้างให้ทำต่อได้", () => {
    render(<EquipmentTransferPage />);
    openGroup();
    expect(screen.getByText("คงเหลือที่ต้นทาง")).toBeTruthy();
    fireEvent.change(cell("S"), { target: { value: "4" } });
    act(() => {
      screen.getAllByRole("button", { name: "สร้างรายการโอนย้าย" })[0].click();
    });
    const transfers = Object.values(useStore.getState().transfers);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].itemType).toBe("equipment");
    expect(transfers[0].lines.map((l) => [l.itemId, l.qty])).toEqual([["eS", 4]]);
    expect(screen.queryByLabelText("โอน เลเบิ้ล Issa S")).toBeNull(); // ฟอร์มล้างแล้ว
  });

  it("กรอกเกินคงเหลือที่ต้นทาง → ช่องแดง; ไม่กรอกเลย → แจ้งเตือน", () => {
    render(<EquipmentTransferPage />);
    openGroup();
    fireEvent.change(cell("M"), { target: { value: "9" } }); // ต้นทางมี 2
    expect(cell("M").className).toContain("danger");
    fireEvent.change(cell("M"), { target: { value: "" } });
    act(() => {
      screen.getAllByRole("button", { name: "สร้างรายการโอนย้าย" })[0].click();
    });
    expect(toastError).toHaveBeenCalledWith("กรุณากรอกจำนวนที่โอนอย่างน้อย 1 ช่อง");
    expect(Object.keys(useStore.getState().transfers)).toHaveLength(0);
  });
});
