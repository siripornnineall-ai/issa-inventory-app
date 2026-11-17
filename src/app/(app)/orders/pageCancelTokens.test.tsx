import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import OrdersPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: (m: string) => toastSuccess(m) }));
const release = vi.fn<(input: { docNo: string | undefined; notAfterIso: string }) => Promise<number>>(async () => 2);
vi.mock("@/lib/supabase/scanLog", () => ({ releaseScannedTokens: (input: { docNo: string | undefined; notAfterIso: string }) => release(input) }));

const created = new Date().toISOString();

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role: "admin", active: true, createdAt: created } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: created } },
    products: { p1: { id: "p1", sellingName: "Wendy Mid", modelCode: "WM", images: [] } },
    variants: { vWht: { id: "vWht", productId: "p1", color: "ขาว", size: "M", sku: "IS-WM-WHT-M", active: true, purchasePrice: 0 } },
    variantStock: { "vWht::w1": { itemId: "vWht", warehouseId: "w1", qtyOnHand: 6, qtyReserved: 0 } },
    orders: {
      o1: {
        id: "o1",
        orderNo: "ORD-20261117-1115",
        date: created,
        channel: "shopee",
        warehouseId: "w1",
        lines: [{ id: "l1", productId: "p1", variantId: "vWht", qty: 1, unitPrice: 1000, discount: 0 }],
        status: "completed",
        restocked: false,
        stockOutDocNo: "SOUT-20261117-1124",
        createdAt: created,
      },
    },
  } as never);
}

function cancelWith(noRestock: boolean) {
  fireEvent.click(screen.getAllByRole("button", { name: /ยกเลิก/ })[0]);
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "กดผิด" } });
  if (noRestock) fireEvent.click(within(dialog).getByRole("checkbox"));
  fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" }));
}

describe("หน้าออเดอร์: ยกเลิกแล้วล้างสถานะป้ายที่สแกนออกไว้", () => {
  beforeEach(() => {
    cleanup();
    release.mockClear();
    toastSuccess.mockClear();
    seed();
  });

  it("ยกเลิกแบบคืนสต็อก → ล้างป้ายของใบเบิกนั้น และแจ้งจำนวนป้ายที่ล้างได้", async () => {
    render(<OrdersPage />);
    cancelWith(false);
    expect(release).toHaveBeenCalledTimes(1);
    const arg = release.mock.calls[0][0];
    expect(arg.docNo).toBe("SOUT-20261117-1124");
    // ขอบเวลา = เวลาสร้างออเดอร์ + 10 นาที
    expect(new Date(arg.notAfterIso).getTime() - new Date(created).getTime()).toBe(10 * 60 * 1000);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("ล้างสถานะป้ายที่สแกนออกไว้ 2 ใบ สแกนออกใหม่ได้เลย"));
  });

  it("ยกเลิกแบบไม่คืนสต็อก → ไม่ล้างป้าย (ของออกไปจริง)", () => {
    render(<OrdersPage />);
    cancelWith(true);
    expect(release).not.toHaveBeenCalled();
  });
});
