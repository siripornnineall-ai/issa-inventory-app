import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import CancelStockInPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: (m: string) => toastSuccess(m) }));

const now = new Date().toISOString();

function seed(role: "admin" | "sales" = "admin", qtyOnHand = 15) {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "Su", email: "s@x.com", role, active: true, createdAt: now } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: now } },
    products: { p1: { id: "p1", sellingName: "Wendy Mid", modelCode: "WM", images: [] } },
    variants: { vWht: { id: "vWht", productId: "p1", color: "ขาว", size: "M", sku: "IS-WM-WHT-M", active: true, purchasePrice: 0 } },
    variantStock: { "vWht::w1": { itemId: "vWht", warehouseId: "w1", qtyOnHand, qtyReserved: 0 } },
    stockInDocs: {
      d1: { id: "d1", docNo: "SIN-20261029-0525", date: now, itemType: "product", receiptImages: [], warehouseId: "w1", lines: [{ id: "l1", itemId: "vWht", qty: 15 }], receivedBy: "u1", status: "confirmed", createdAt: now },
      d2: { id: "d2", docNo: "SIN-20261029-0526", date: now, itemType: "product", receiptImages: [], warehouseId: "w1", lines: [{ id: "l2", itemId: "vWht", qty: 4 }], receivedBy: "u1", status: "cancelled", cancelReason: "ลงซ้ำ", createdAt: now },
    },
  } as never);
}

const row = (docNo: string) => screen.getByText(docNo).closest("li") as HTMLElement;

describe("หน้ายกเลิกใบรับเข้า", () => {
  beforeEach(() => {
    cleanup();
    toastError.mockClear();
    toastSuccess.mockClear();
    seed();
  });

  it("แสดงใบล่าสุด ใบที่ยกเลิกแล้วมีป้ายและเหตุผล เลือกไม่ได้", () => {
    render(<CancelStockInPage />);
    expect(within(row("SIN-20261029-0525")).getByText("Wendy Mid ขาว M")).toBeTruthy();
    expect(within(row("SIN-20261029-0526")).getByText("ยกเลิกแล้ว")).toBeTruthy();
    expect(within(row("SIN-20261029-0526")).getByText(/เหตุผล: ลงซ้ำ/)).toBeTruthy();
    expect((within(row("SIN-20261029-0526")).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("เลือกใบ → ใส่เหตุผล → ยืนยัน: สต็อกถูกหักคืน ใบเปลี่ยนเป็นยกเลิก", () => {
    render(<CancelStockInPage />);
    fireEvent.click(within(row("SIN-20261029-0525")).getByRole("checkbox"));
    expect(screen.getByText("เลือก 1 ใบ รวม 15 ชิ้น")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกใบที่เลือก" }));
    const dialog = screen.getByRole("dialog");
    // ไม่ใส่เหตุผล → ไม่ยกเลิก
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" }));
    expect(toastError).toHaveBeenCalledWith("กรุณาระบุเหตุผลที่ยกเลิก");
    expect(useStore.getState().stockInDocs.d1.status).toBe("confirmed");

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "รับเข้าผิดรุ่น" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" }));
    expect(useStore.getState().stockInDocs.d1).toMatchObject({ status: "cancelled", cancelReason: "รับเข้าผิดรุ่น", cancelledByName: "Su" });
    expect(useStore.getState().variantStock["vWht::w1"].qtyOnHand).toBe(0);
    expect(toastSuccess).toHaveBeenCalledWith("ยกเลิก 1 ใบ หักสต็อกคืน 15 ชิ้นเรียบร้อยแล้ว");
  });

  it("ของถูกขายไปแล้วจนไม่พอหักคืน: ขึ้นข้อความอธิบายในหน้าต่าง และยกเลิกไม่สำเร็จ สต็อกไม่เปลี่ยน", () => {
    seed("admin", 10);
    render(<CancelStockInPage />);
    fireEvent.click(within(row("SIN-20261029-0525")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกใบที่เลือก" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toMatch(/รับเข้า 15 ชิ้น แต่ตอนนี้คงเหลือ 10 ชิ้น/);
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ผิด" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก" }));
    expect(toastError).toHaveBeenCalled();
    expect(useStore.getState().stockInDocs.d1.status).toBe("confirmed");
    expect(useStore.getState().variantStock["vWht::w1"].qtyOnHand).toBe(10);
  });

  it("พนักงานที่ไม่มีสิทธิ์ปรับยอดสต็อก (เช่นฝ่ายขาย) เข้าหน้านี้ไม่ได้", () => {
    seed("sales");
    render(<CancelStockInPage />);
    expect(screen.getByText("ไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeTruthy();
    expect(screen.queryByText("SIN-20261029-0525")).toBeNull();
  });
});
