import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import StockCountPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/stock/CameraScanner", () => ({ CameraScanner: () => null }));

const iso = "2026-10-05T00:00:00.000Z";

function seed(qtyS: number, qtyM: number) {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "นับ", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    brands: { b1: { id: "b1", name: "ISSA", code: "IA", active: true, createdAt: iso } },
    products: { p1: { id: "p1", sellingName: "Flow Wide", brandId: "b1", modelCode: "FW", images: [] } },
    variants: {
      vS: { id: "vS", productId: "p1", color: "ดำ", size: "S", sku: "IA-FW-BLK-S", active: true },
      vM: { id: "vM", productId: "p1", color: "ดำ", size: "M", sku: "IA-FW-BLK-M", active: true },
    },
    variantStock: {
      "vS::w1": { itemId: "vS", warehouseId: "w1", qtyOnHand: qtyS, qtyReserved: 0 },
      "vM::w1": { itemId: "vM", warehouseId: "w1", qtyOnHand: qtyM, qtyReserved: 0 },
    },
  } as never);
}

async function openProduct() {
  render(<StockCountPage />);
  fireEvent.change(screen.getByPlaceholderText("พิมพ์ชื่อรุ่นสินค้า..."), { target: { value: "Flow" } });
  fireEvent.click(await screen.findByRole("button", { name: "Flow Wide" }));
  await screen.findByText("ตอนเริ่มนับ");
}

describe("นับสต็อก: เทียบยอดตอนเริ่มนับกับยอดปัจจุบัน", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("ยอดไม่เปลี่ยนระหว่างนับ ไม่มีแถบเตือน", async () => {
    seed(5, 3);
    await openProduct();
    expect(screen.queryByText(/ยอดในระบบเปลี่ยนไประหว่างที่นับ/)).toBeNull();
  });

  it("มีของเข้า/ออกระหว่างที่นับ (ยอดในระบบเปลี่ยน) → เตือน ขึ้นป้ายเปลี่ยน และเตือนซ้ำในหน้ายืนยัน", async () => {
    seed(5, 3);
    await openProduct();
    // นับ S ได้ 4
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "4" } });

    // ระหว่างนับ มีคนเบิกออก S 2 ชิ้นจากเครื่องอื่น แล้วข้อมูลถูกรีเฟรชเข้ามา: ยอดในระบบ 5 → 3
    seed(3, 3);
    useStore.setState({ ...useStore.getState() });
    // seed() ใหม่ไม่เปลี่ยนยอดเริ่มนับที่ถ่ายไว้ในหน้า (เก็บใน state ของหน้า)
    await waitFor(() => expect(screen.getByText(/ยอดในระบบเปลี่ยนไประหว่างที่นับ 1 รายการ/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /บันทึกปรับสต็อก/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/ยอดในระบบเปลี่ยนไปจากตอนเริ่มนับ/)).toBeTruthy();
  });

  it("บันทึกแล้วตั้งสต็อกให้เท่ากับที่นับ (ไม่ใช่บวกเพิ่ม) และมีประวัติปรับยอด", async () => {
    seed(5, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /บันทึกปรับสต็อก/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(4));
    expect(useStore.getState().variantStock["vM::w1"].qtyOnHand).toBe(3); // ไม่ได้นับ = ไม่แตะ
    const adj = Object.values(useStore.getState().movements).filter((m) => m.movementType === "adjustment");
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ qtyBefore: 5, qtyAfter: 4, qtyChange: -1 });
  });

  it("ปุ่ม 'ตั้งรายการที่ยังไม่นับเป็น 0' ทำให้รายการที่ไม่ได้สแกนถูกปรับเป็น 0 ตอนบันทึก", async () => {
    seed(5, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "5" } }); // S นับได้ 5 (ตรงกัน)
    fireEvent.click(screen.getByRole("button", { name: "ตั้งรายการที่ยังไม่นับเป็น 0" }));
    fireEvent.click(screen.getByRole("button", { name: /บันทึกปรับสต็อก \(1\)/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vM::w1"].qtyOnHand).toBe(0));
    expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(5);
  });
});
