import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { ProductForm } from "./ProductForm";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/products/new",
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));

function seedStore() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "" } },
    users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
    currentUserId: "u1",
  } as never);
}

const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (...a: unknown[]) => toastError(...a), toastSuccess: vi.fn() }));

describe("ProductForm: ถัดไป → ข้อมูลการขาย → บันทึก", () => {
  beforeEach(() => {
    cleanup();
    push.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
    seedStore();
  });

  it("กดถัดไปต้องไม่ส่งฟอร์ม/บันทึกเอง (ปุ่มถัดไปกับปุ่มบันทึกเป็นคนละปุ่มกัน)", () => {
    const { container } = render(<ProductForm />);
    const form = container.querySelector("form") as HTMLFormElement;
    const submitted = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", submitted);
    toastError.mockClear();
    const nextBtn = screen.getByRole("button", { name: /ถัดไป/ });
    fireEvent.click(nextBtn);
    const saveBtn = screen.getByRole("button", { name: "บันทึกสินค้าใหม่" });
    const backBtn = screen.getByRole("button", { name: "ย้อนกลับ" });
    // สาเหตุของบั๊ก: ถ้า React ใช้ <button> ตัวเดิมซ้ำแล้วเปลี่ยนชนิดจาก button เป็น submit กลางจังหวะคลิก
    // เบราว์เซอร์จะส่งฟอร์มทันทีหลังคลิก "ถัดไป" ต้องเป็นคนละ DOM node กันเสมอ
    expect(saveBtn).not.toBe(nextBtn);
    expect(backBtn).not.toBe(nextBtn);
    expect(saveBtn.getAttribute("type")).toBe("submit");
    expect(nextBtn.isConnected).toBe(false);
    fireEvent.click(backBtn);
    expect(submitted).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("หน้าแรกมีปุ่มถัดไปแต่ยังไม่มีปุ่มบันทึก กดถัดไปแล้วถึงมีปุ่มบันทึก", () => {
    render(<ProductForm />);
    expect(screen.queryByRole("button", { name: "บันทึกสินค้าใหม่" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ }));
    expect(screen.getByRole("button", { name: "บันทึกสินค้าใหม่" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ย้อนกลับ" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
    expect(screen.getByRole("button", { name: /ถัดไป/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "บันทึกสินค้าใหม่" })).toBeNull();
  });

  it("กรอกครบแล้วบันทึก: สินค้าและตัวเลือกสี/ไซซ์ถูกสร้างครบ", () => {
    const { container } = render(<ProductForm />);
    const byLabel = (text: string) => {
      const label = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes(text));
      return label?.parentElement?.querySelector("input, select, textarea") as HTMLInputElement;
    };
    fireEvent.change(byLabel("ชื่อรุ่นที่ใช้ขาย"), { target: { value: "Elara Yoga Set" } });
    fireEvent.change(byLabel("ราคาขาย (บาท)"), { target: { value: "399" } });
    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ }));

    fireEvent.change(screen.getByPlaceholderText("ชื่อสี เช่น ดำ, ครีม"), { target: { value: "ดำ" } });
    fireEvent.click(screen.getByRole("button", { name: "ดำ (BLK)" }));
    fireEvent.click(screen.getByRole("button", { name: /สร้างตัวเลือกสี\/ไซซ์/ }));

    const s = useStore.getState();
    expect(screen.getAllByText(/ดำ/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกสินค้าใหม่" }));

    const after = useStore.getState();
    expect(Object.values(after.products)).toHaveLength(1);
    expect(Object.values(after.variants).length).toBeGreaterThanOrEqual(3);
    expect(within(container).queryByText("ผิดพลาด")).toBeNull();
    expect(s).toBeTruthy();
  });

  it("แก้ไขสินค้าที่ยังไม่มีตัวเลือก: เห็นข้อความและเพิ่มตัวเลือกได้จากหน้านี้", () => {
    const productId = "p1";
    useStore.getState().actions.hydrate({
      ...emptyState(),
      brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "" } },
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
      products: {
        [productId]: { id: productId, sellingName: "Elara Yoga Set", sellingPrice: 399, brandId: "b1", modelCode: "EYS", category: "เสื้อ", status: "active", images: [] },
      },
    } as never);
    const existing = useStore.getState().products[productId];
    render(<ProductForm existing={existing} />);
    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ }));
    expect(screen.getByText(/ยังไม่มีตัวเลือกสี\/ไซซ์ในระบบ/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("ชื่อสี เช่น ดำ, ครีม"), { target: { value: "ดำ" } });
    fireEvent.click(screen.getByRole("button", { name: "ดำ (BLK)" }));
    fireEvent.click(screen.getByRole("button", { name: /สร้างตัวเลือกสี\/ไซซ์/ }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
    const variants = Object.values(useStore.getState().variants).filter((v) => v.productId === productId);
    expect(variants.length).toBeGreaterThanOrEqual(3);
    expect(variants.map((v) => v.sku)).toContain("IS-EYS-BLK-S");
  });
});
