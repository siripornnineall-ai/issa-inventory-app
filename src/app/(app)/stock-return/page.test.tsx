import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import StockReturnPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: vi.fn() }));
vi.mock("@/lib/utils/beep", () => ({ playBeep: vi.fn(), primeAudio: vi.fn() }));
vi.mock("@/components/stock/CameraScanner", () => ({ CameraScanner: () => null }));

const iso = "2026-10-05T00:00:00.000Z";

function seed(role: "admin" | "sales" = "admin") {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "รับคืน", email: "c@x.com", role, active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: iso } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
    variants: { vBlk: { id: "vBlk", productId: "p1", color: "ดำ", size: "M", sku: "IS-BS-BLK-M", active: true, purchasePrice: 0 } },
    variantStock: { "vBlk::w1": { itemId: "vBlk", warehouseId: "w1", qtyOnHand: 5, qtyReserved: 0 } },
  } as never);
}

function addBlackM() {
  const input = screen.getByPlaceholderText(/ค้นหาสินค้า/);
  fireEvent.change(input, { target: { value: "IS-BS-BLK-M" } });
  fireEvent.keyDown(input, { key: "Enter" });
}

const saveButtons = () => screen.getAllByRole("button", { name: "บันทึกการรับคืน" });
const pickType = (label: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
const docs = () => Object.values(useStore.getState().stockInDocs);
const qty = () => useStore.getState().variantStock["vBlk::w1"].qtyOnHand;

describe("หน้าสต็อกคืนสินค้า", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    replace.mockClear();
    toastError.mockClear();
    seed();
  });

  it("ไม่เลือกประเภท: ไม่มีประเภทถูกเลือกให้ล่วงหน้า และกดบันทึกแล้วถูกปฏิเสธ ไม่แตะสต็อก", () => {
    render(<StockReturnPage />);
    for (const label of ["สินค้าตีกลับ", "สินค้าคืน", "สินค้าตำหนิ", "สินค้าเปลี่ยน"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) }).getAttribute("aria-pressed")).toBe("false");
    }
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("เลือกประเภท"));
    expect(docs()).toHaveLength(0);
    expect(qty()).toBe(5);
  });

  it("เลือก 'สินค้าตำหนิ' แล้วบันทึก: สต็อกเพิ่ม บันทึกเป็นชนิดตำหนิ และขึ้นหน้ายืนยันพร้อมเลขที่ SRT", () => {
    render(<StockReturnPage />);
    pickType("สินค้าตำหนิ");
    addBlackM();
    fireEvent.click(saveButtons()[0]);

    expect(qty()).toBe(6);
    const mv = Object.values(useStore.getState().movements).find((m) => m.movementType === "return_defective");
    expect(mv).toBeTruthy();
    expect(docs()[0].returnType).toBe("return_defective");
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("บันทึกการรับคืนสินค้าแล้ว");
    expect(status.textContent).toMatch(/SRT-\d{8}-\d{4}/);
    expect(replace).not.toHaveBeenCalled();
  });

  it("กดบันทึกรัวสองครั้งในจังหวะเดียว ได้ใบรับคืนใบเดียว", () => {
    render(<StockReturnPage />);
    pickType("สินค้าคืน");
    addBlackM();
    const btn = saveButtons()[0];
    act(() => {
      btn.click();
      btn.click();
    });
    expect(docs()).toHaveLength(1);
    expect(qty()).toBe(6);
  });

  it("รับคืนซ้ำรายการเหมือนเดิมทันที ถูกถามก่อน ไม่ยืนยันก็ไม่ซ้ำ", () => {
    render(<StockReturnPage />);
    pickType("สินค้าคืน");
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    fireEvent.click(screen.getByRole("button", { name: "รับคืนสินค้าต่อ" }));

    pickType("สินค้าคืน");
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/เพิ่งบันทึกรายการเหมือนกันนี้ไปแล้ว/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "ไม่บันทึกซ้ำ" }));
    expect(docs()).toHaveLength(1);
    expect(qty()).toBe(6);
  });

  it("ประเภทคืนต่างกัน (คืน แล้วตามด้วยตีกลับ) ไม่ถือว่าเป็นใบซ้ำ", () => {
    render(<StockReturnPage />);
    pickType("สินค้าคืน");
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    fireEvent.click(screen.getByRole("button", { name: "รับคืนสินค้าต่อ" }));

    pickType("สินค้าตีกลับ");
    addBlackM();
    fireEvent.click(saveButtons()[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(docs()).toHaveLength(2);
    expect(qty()).toBe(7);
  });
});
