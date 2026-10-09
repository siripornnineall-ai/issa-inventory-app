import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import ProductLabelsPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { PrintLabelItem } from "@/components/products/PrintableQrLabels";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "p1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));

const printed: { items: PrintLabelItem[] | null } = { items: null };
vi.mock("@/components/products/PrintableQrLabels", () => ({
  PrintableQrLabels: ({ items }: { items: PrintLabelItem[] }) => {
    printed.items = items;
    return <div data-testid="printable" />;
  },
}));
vi.mock("@/lib/utils/preloadImages", () => ({ preloadImages: () => Promise.resolve() }));

// ตัวเลือกเรียงสลับในฐานข้อมูลโดยตั้งใจ: ไซซ์ไม่เรียง และสีสลับกันเป็นช่วง ๆ
const SCRAMBLED: [string, string][] = [
  ["ดำ", "XL"],
  ["ขาว", "M"],
  ["ดำ", "S"],
  ["ขาว", "2XL"],
  ["ดำ", "2XL"],
  ["ดำ", "M"],
  ["ขาว", "S"],
  ["ดำ", "L"],
];

describe("พิมพ์ป้ายของสินค้าแต่ละรุ่น", () => {
  beforeEach(() => {
    cleanup();
    printed.items = null;
    window.print = vi.fn();
    const variants: Record<string, unknown> = {};
    SCRAMBLED.forEach(([color, size], i) => {
      const id = `v${i}`;
      variants[id] = { id, productId: "p1", color, size, sku: `IS-T-${color}-${size}`, active: true, isDefective: false };
    });
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
      brands: { b1: { id: "b1", name: "ISSA", code: "IS", active: true, createdAt: "" } },
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "" } },
      products: { p1: { id: "p1", sellingName: "Test", brandId: "b1", modelCode: "T", images: [] } },
      variants,
    } as never);
  });

  it("ป้ายที่พิมพ์ออกมาเรียงไซซ์จากเล็กไปใหญ่ในแต่ละสี เหมือนที่เห็นบนหน้าจอ", async () => {
    render(<ProductLabelsPage />);
    fireEvent.click(screen.getByRole("button", { name: "เลือกทั้งหมด" }));
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    const order = printed.items!.map((i) => `${i.variant.color}/${i.variant.size}`);
    // สีเรียงตามที่เห็นครั้งแรก (ดำก่อนขาว) แล้วแต่ละสีเรียง S, M, L, XL, 2XL
    expect(order).toEqual(["ดำ/S", "ดำ/M", "ดำ/L", "ดำ/XL", "ดำ/2XL", "ขาว/S", "ขาว/M", "ขาว/2XL"]);
  });

  it("ตั้งจำนวนทุกไซซ์พร้อมกัน: ใส่ 5 กดอัปเดตทั้งหมด แล้วทุกไซซ์พิมพ์ไซซ์ละ 5 ใบ", async () => {
    render(<ProductLabelsPage />);
    fireEvent.click(screen.getByRole("button", { name: "เลือกทั้งหมด" }));
    fireEvent.change(screen.getByLabelText("ตั้งจำนวนใบทุกรายการพร้อมกัน"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "อัปเดตทั้งหมด" }));
    expect(screen.getByRole("button", { name: /พิมพ์ป้าย \(40 ใบ\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    expect(printed.items).toHaveLength(40);
    const perVariant = new Map<string, number>();
    for (const i of printed.items!) perVariant.set(i.variant.id, (perVariant.get(i.variant.id) ?? 0) + 1);
    expect(Array.from(perVariant.values()).every((n) => n === 5)).toBe(true);
  });
  it("เปิดหน้ามาไม่ติ๊กเลือกอะไรไว้ก่อน ปุ่มพิมพ์ใช้ไม่ได้จนกว่าจะเลือกเอง และพิมพ์เฉพาะที่เลือก", async () => {
    render(<ProductLabelsPage />);
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes.every((c) => !c.checked)).toBe(true);
    const printBtn = screen.getByRole("button", { name: /พิมพ์ป้าย \(0 ใบ\)/ }) as HTMLButtonElement;
    expect(printBtn.disabled).toBe(true);

    // เลือกเอง: ดำ ไซซ์ S กับ ขาว ไซซ์ 2XL
    const sizeBox = (color: string, size: string) =>
      screen.getAllByText(size).map((el) => el.closest("label")).filter(Boolean).find((l) => l!.closest("div.flex.flex-col.gap-1\\.5")?.textContent?.startsWith(color))!.querySelector("input[type=checkbox]") as HTMLInputElement;
    fireEvent.click(sizeBox("ดำ", "S"));
    fireEvent.click(sizeBox("ขาว", "2XL"));
    fireEvent.click(screen.getByRole("button", { name: /พิมพ์ป้าย \(2 ใบ\)/ }));
    await waitFor(() => expect(printed.items).not.toBeNull());
    expect(printed.items!.map((i) => `${i.variant.color}/${i.variant.size}`).sort()).toEqual(["ขาว/2XL", "ดำ/S"]);
  });
});
