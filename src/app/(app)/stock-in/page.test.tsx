import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import StockInPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/utils/beep", () => ({ playBeep: vi.fn(), primeAudio: vi.fn() }));
vi.mock("@/components/stock/CameraScanner", () => ({ CameraScanner: () => null }));

const iso = "2026-10-05T00:00:00.000Z";

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "รับของ", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: iso } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
    variants: { vBlk: { id: "vBlk", productId: "p1", color: "ดำ", size: "M", sku: "IS-BS-BLK-M", active: true, purchasePrice: 0 } },
  } as never);
}

// ใส่ SKU แล้วกด Enter เหมือนยิงบาร์โค้ด: เพิ่มรายการ 1 ชิ้น
function addBlackM() {
  const input = screen.getByPlaceholderText(/ค้นหาสินค้า/);
  fireEvent.change(input, { target: { value: "IS-BS-BLK-M" } });
  fireEvent.keyDown(input, { key: "Enter" });
}

const saveButtons = () => screen.getAllByRole("button", { name: "บันทึกการรับเข้า" });
const docCount = () => Object.keys(useStore.getState().stockInDocs).length;

describe("หน้ารับสินค้าเข้า: กันบันทึกซ้ำ", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    replace.mockClear();
    seed();
  });

  it("กดบันทึกรัวสองครั้งในจังหวะเดียว (มือถือค้าง) ได้ใบรับเข้าใบเดียว และขึ้นหน้ายืนยันพร้อมเลขที่ใบ", () => {
    render(<StockInPage />);
    addBlackM();
    const btn = saveButtons()[0];
    act(() => {
      btn.click();
      btn.click();
    });

    expect(docCount()).toBe(1);
    expect(useStore.getState().variantStock["vBlk::w1"].qtyOnHand).toBe(1);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("บันทึกการรับสินค้าเข้าแล้ว");
    expect(status.textContent).toMatch(/SIN-\d{8}-\d{4}/);
    expect(screen.queryByRole("button", { name: "บันทึกการรับเข้า" })).toBeNull(); // ฟอร์มหายไป ไม่มีปุ่มให้กดซ้ำ
    expect(replace).not.toHaveBeenCalled(); // ไม่เด้งหน้าเงียบ ๆ
  });

  it("กด 'รับสินค้าเข้าต่อ' ได้ฟอร์มว่างใหม่ และถ้าบันทึกรายการเหมือนเดิมทันที จะถูกถามก่อน ไม่ยืนยันก็ไม่ซ้ำ", () => {
    render(<StockInPage />);
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    expect(docCount()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "รับสินค้าเข้าต่อ" }));
    addBlackM(); // ชิ้นเดียวกัน จำนวนเท่ากัน ภายในไม่กี่วินาที
    fireEvent.click(saveButtons()[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/เพิ่งบันทึกรายการเหมือนกันนี้ไปแล้ว/)).toBeTruthy();
    expect(docCount()).toBe(1); // ยังไม่บันทึกซ้ำ

    fireEvent.click(within(dialog).getByRole("button", { name: "ไม่บันทึกซ้ำ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(docCount()).toBe(1);
    expect(useStore.getState().variantStock["vBlk::w1"].qtyOnHand).toBe(1);
  });

  it("ยืนยัน 'บันทึกซ้ำ' แล้วบันทึกจริง (รับของชุดเดิมซ้ำได้ถ้าตั้งใจ)", () => {
    render(<StockInPage />);
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    fireEvent.click(screen.getByRole("button", { name: "รับสินค้าเข้าต่อ" }));
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "บันทึกซ้ำ" }));

    expect(docCount()).toBe(2);
    expect(useStore.getState().variantStock["vBlk::w1"].qtyOnHand).toBe(2);
  });
});
