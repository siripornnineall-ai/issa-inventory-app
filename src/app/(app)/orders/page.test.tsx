import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import OrdersPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: (m: string) => toastSuccess(m) }));

const now = new Date().toISOString();

function seed(role: "admin" | "sales") {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: now } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: now } },
    products: { p1: { id: "p1", sellingName: "Wendy Mid", modelCode: "WM", images: [] } },
    variants: { vWht: { id: "vWht", productId: "p1", color: "ขาว", size: "M", sku: "IS-WM-WHT-M", active: true, purchasePrice: 0 } },
    variantStock: { "vWht::w1": { itemId: "vWht", warehouseId: "w1", qtyOnHand: 6, qtyReserved: 0 } },
    orders: {
      o1: {
        id: "o1",
        orderNo: "ORD-20261029-0302",
        date: now,
        channel: "shopee",
        warehouseId: "w1",
        lines: [{ id: "l1", productId: "p1", variantId: "vWht", qty: 4, unitPrice: 1000, discount: 0 }],
        status: "completed",
        restocked: false,
        stockOutDocNo: "SOUT-20261029-0305",
        createdAt: now,
      },
    },
  } as never);
}

const openCancel = () => {
  fireEvent.click(screen.getAllByRole("button", { name: /ยกเลิก/ })[0]);
  return screen.getByRole("dialog");
};

describe("หน้าออเดอร์: ยกเลิกแบบไม่คืนสต็อก", () => {
  beforeEach(() => {
    cleanup();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("ผู้ดูแลระบบติ๊ก \"ไม่คืนสต็อก\" แล้วยืนยัน: ออเดอร์ถูกยกเลิก สต็อกไม่เปลี่ยน", () => {
    seed("admin");
    render(<OrdersPage />);
    const dialog = openCancel();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ลงผิดรุ่น ไม่ใช่ยอดขาย" } });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" }));
    const s = useStore.getState();
    expect(s.orders.o1).toMatchObject({ status: "cancelled", restocked: false, cancelReason: "ลงผิดรุ่น ไม่ใช่ยอดขาย" });
    expect(s.variantStock["vWht::w1"].qtyOnHand).toBe(6);
    expect(toastSuccess).toHaveBeenCalledWith("ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว (ไม่คืนสต็อก)");
  });

  it("ไม่ติ๊ก: ยกเลิกตามปกติ สต็อกถูกคืน", () => {
    seed("admin");
    render(<OrdersPage />);
    const dialog = openCancel();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ลูกค้ายกเลิก" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" }));
    const s = useStore.getState();
    expect(s.orders.o1).toMatchObject({ status: "cancelled", restocked: true });
    expect(s.variantStock["vWht::w1"].qtyOnHand).toBe(10);
  });

  it("ฝ่ายขาย (ยกเลิกออเดอร์ได้ แต่ไม่ใช่ผู้ดูแลระบบ) ไม่เห็นตัวเลือกไม่คืนสต็อก", () => {
    seed("sales");
    render(<OrdersPage />);
    const dialog = openCancel();
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
  });
});
