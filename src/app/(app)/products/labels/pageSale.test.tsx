import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import PrintLabelsBatchPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { PrintLabelItem } from "@/components/products/PrintableQrLabels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/lib/utils/preloadImages", () => ({ preloadImages: () => Promise.resolve() }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

const printed: { items: PrintLabelItem[] | null } = { items: null };
vi.mock("@/components/products/PrintableQrLabels", () => ({
  PrintableQrLabels: ({ items }: { items: PrintLabelItem[] }) => {
    printed.items = items;
    return <div data-testid="printable" />;
  },
}));
vi.mock("@/components/stock/VariantPicker", () => ({
  VariantPicker: ({ onSelectMany }: { onSelectMany?: (ids: string[]) => number }) => (
    <button type="button" onClick={() => onSelectMany?.(["v1", "v2"])}>
      เพิ่มสองไซซ์
    </button>
  ),
}));

describe("พิมพ์ป้าย Sale", () => {
  beforeEach(() => {
    cleanup();
    printed.items = null;
    window.print = vi.fn();
    const variants: Record<string, unknown> = {};
    ["S", "M"].forEach((size, i) => {
      variants[`v${i + 1}`] = { id: `v${i + 1}`, productId: "p1", color: "ครีม", size, sku: `IS-BS-CRM-${size}`, active: true, isDefective: false };
    });
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
      brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "" } },
      products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
      variants,
    } as never);
  });

  it("เปิดโหมด Sale: ใส่ราคาแยกต่อรายการ (หรือใส่ให้ทุกรายการ) แล้วป้ายได้ราคาตามที่ใส่ และไม่ใส่ราคา = พิมพ์ไม่ได้", async () => {
    render(<PrintLabelsBatchPage />);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสองไซซ์" }));
    fireEvent.click(screen.getByLabelText(/ป้าย Sale/));

    // ยังไม่ใส่ราคา → ไม่พิมพ์
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await new Promise((r) => setTimeout(r, 20));
    expect(printed.items).toBeNull();

    fireEvent.change(screen.getByLabelText("ราคาเดียวกันทุกรายการ"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "ใส่ให้ทุกรายการ" }));
    const prices = screen.getAllByLabelText("ราคา Sale");
    fireEvent.change(prices[prices.length - 1], { target: { value: "650" } }); // แก้รายการสุดท้ายแยก
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    expect(printed.items!.map((i) => i.salePrice).sort()).toEqual([500, 650]);
  });

  it("รุ่นเดียวกันพิมพ์หลายราคาพร้อมกันได้: กด เพิ่มอีกราคา ได้บรรทัดใหม่ แยกราคา/จำนวนใบ", async () => {
    render(<PrintLabelsBatchPage />);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสองไซซ์" }));
    fireEvent.click(screen.getByLabelText(/ป้าย Sale/));
    // หน้าจอมีทั้งการ์ดมือถือและตารางจอกว้างในเทสต์ จึงนับเฉพาะชุดสุดท้าย (ตาราง)
    const tableInputs = (label: string, n: number) => screen.getAllByLabelText(label).slice(-n);
    fireEvent.click(screen.getAllByRole("button", { name: /อีกราคา/ }).slice(-2)[0]);
    const prices = tableInputs("ราคา Sale", 3);
    expect(prices).toHaveLength(3);
    fireEvent.change(prices[0], { target: { value: "300" } });
    fireEvent.change(prices[1], { target: { value: "450" } }); // บรรทัดที่เพิ่มของรุ่นเดียวกัน
    fireEvent.change(prices[2], { target: { value: "500" } });
    const qtys = tableInputs("จำนวนใบที่พิมพ์", 3);
    fireEvent.change(qtys[1], { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    const byPrice = printed.items!.reduce<Record<number, number>>((m, i) => ({ ...m, [i.salePrice as number]: (m[i.salePrice as number] ?? 0) + 1 }), {});
    expect(byPrice[300]).toBe(1);
    expect(byPrice[450]).toBe(3);
    expect(byPrice[500]).toBe(1);
  });

  it("ปิดโหมด Sale: ป้ายไม่มีราคา (สี/ไซซ์เหมือนเดิม)", async () => {
    render(<PrintLabelsBatchPage />);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสองไซซ์" }));
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    expect(printed.items!.every((i) => i.salePrice === undefined)).toBe(true);
  });
});
