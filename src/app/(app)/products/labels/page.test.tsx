import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import PrintLabelsBatchPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { PrintLabelItem } from "@/components/products/PrintableQrLabels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/lib/utils/preloadImages", () => ({ preloadImages: () => Promise.resolve() }));

const printed: { items: PrintLabelItem[] | null } = { items: null };
vi.mock("@/components/products/PrintableQrLabels", () => ({
  PrintableQrLabels: ({ items }: { items: PrintLabelItem[] }) => {
    printed.items = items;
    return <div data-testid="printable" />;
  },
}));

// หน้าเลือกสินค้าเป็น dialog ที่ซับซ้อน จึงจำลองตัวเลือกให้เรียก onSelectMany ตรง ๆ เหมือนติ๊ก "เลือกทุกไซซ์"
vi.mock("@/components/stock/VariantPicker", () => ({
  VariantPicker: ({ onSelectMany }: { onSelectMany?: (ids: string[]) => number }) => (
    <button type="button" onClick={() => onSelectMany?.(["v1", "v2", "v3", "v4"])}>
      เพิ่มทุกไซซ์
    </button>
  ),
}));

describe("พิมพ์บาร์โค้ดหลายรุ่นพร้อมกัน", () => {
  beforeEach(() => {
    cleanup();
    printed.items = null;
    window.print = vi.fn();
    const sizes = ["S", "M", "L", "XL"];
    const variants: Record<string, unknown> = {};
    sizes.forEach((size, i) => {
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

  it("ใส่จำนวนครั้งเดียวแล้วกดอัปเดตทั้งหมด ทุกรายการได้จำนวนเท่ากัน และยังแก้รายตัวได้", async () => {
    render(<PrintLabelsBatchPage />);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มทุกไซซ์" }));
    expect(screen.getByRole("button", { name: /พิมพ์ป้าย \(4 ใบ\)/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("ตั้งจำนวนใบทุกรายการพร้อมกัน"), { target: { value: "5" } });
    const applyBtn = screen.getByRole("button", { name: "อัปเดตทั้งหมด" });
    expect(applyBtn.getAttribute("data-applied")).toBe("false");
    fireEvent.click(applyBtn);
    expect(screen.getByRole("button", { name: /พิมพ์ป้าย \(20 ใบ\)/ })).toBeTruthy();

    // กดแล้วปุ่มเป็นสีเขียว (อัปเดตแล้ว) จนกว่าจะแก้ตัวเลขในช่องใหม่
    const done = screen.getByRole("button", { name: "อัปเดตแล้ว" });
    expect(done.getAttribute("data-applied")).toBe("true");
    expect(done.className).toContain("bg-[var(--color-success)]");
    fireEvent.change(screen.getByLabelText("ตั้งจำนวนใบทุกรายการพร้อมกัน"), { target: { value: "6" } });
    expect(screen.getByRole("button", { name: "อัปเดตทั้งหมด" }).getAttribute("data-applied")).toBe("false");
    fireEvent.change(screen.getByLabelText("ตั้งจำนวนใบทุกรายการพร้อมกัน"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "อัปเดตทั้งหมด" }));

    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    expect(printed.items).toHaveLength(20);
    expect(printed.items!.map((i) => i.variant.size)).toEqual([
      ...Array(5).fill("S"),
      ...Array(5).fill("M"),
      ...Array(5).fill("L"),
      ...Array(5).fill("XL"),
    ]);
  });
});
