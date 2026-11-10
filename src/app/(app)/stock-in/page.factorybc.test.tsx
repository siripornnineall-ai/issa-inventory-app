import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import StockInPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import { wipBalances } from "@/lib/utils/factoryWip";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/utils/beep", () => ({ playBeep: vi.fn(), primeAudio: vi.fn() }));
vi.mock("@/components/stock/CameraScanner", () => ({ CameraScanner: () => null }));

const iso = "2026-11-10T00:00:00.000Z";

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "รับของ", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: iso } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
    variants: { vBlk: { id: "vBlk", productId: "p1", color: "ดำ", size: "M", sku: "IS-BS-BLK-M", active: true, purchasePrice: 0 } },
    factoryWipEntries: { e1: { id: "e1", batchId: "b", date: iso, variantId: "vBlk", kind: "opening", qtyChange: 5, actorName: "x", createdAt: iso } },
  } as never);
}

function addBlackM(qty: number) {
  const input = screen.getByPlaceholderText(/ค้นหาสินค้า/);
  fireEvent.change(input, { target: { value: "IS-BS-BLK-M" } });
  fireEvent.keyDown(input, { key: "Enter" });
  const qtyInput = screen.getAllByRole("spinbutton").find((e) => (e as HTMLInputElement).value === "1") as HTMLInputElement;
  fireEvent.change(qtyInput, { target: { value: String(qty) } });
}

describe("หน้ารับสินค้าเข้า: รับมาจากโรงงาน BC", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    seed();
  });

  it("ตัวเลือกเริ่มต้นเป็นรับเข้าปกติ ไม่หักตัวที่ยังไม่เย็บ", () => {
    render(<StockInPage />);
    addBlackM(3);
    fireEvent.click(screen.getAllByRole("button", { name: "บันทึกการรับเข้า" })[0]);
    const doc = Object.values(useStore.getState().stockInDocs)[0];
    expect(doc.lines[0].fromWip).toBeUndefined();
    expect(wipBalances(useStore.getState()).get("vBlk")).toBe(5);
  });

  it("เลือก 'เย็บเสร็จจากโรงงาน BC': หักตัวที่ยังไม่เย็บ และเตือนเมื่อรับมากกว่าที่บันทึก (บันทึกได้ ติดลบ)", () => {
    render(<StockInPage />);
    fireEvent.change(screen.getByDisplayValue("รับเข้าปกติ (ซื้อ/ผลิตเข้า)"), { target: { value: "wip" } });
    addBlackM(8);
    expect(screen.getAllByText(/ยังไม่เย็บ 5 → -3/).length).toBeGreaterThan(0); // มือถือและเดสก์ท็อปเรนเดอร์สองชุด
    expect(screen.getAllByText(/ยอดจะติดลบ/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "บันทึกการรับเข้า" })[0]);
    const s = useStore.getState();
    const doc = Object.values(s.stockInDocs)[0];
    expect(doc.lines[0]).toMatchObject({ itemId: "vBlk", qty: 8, fromWip: true });
    expect(wipBalances(s).get("vBlk")).toBe(-3);
  });
});
