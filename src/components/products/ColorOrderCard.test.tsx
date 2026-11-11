import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ColorOrderCard } from "./ColorOrderCard";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));

const iso = "2026-11-10T00:00:00.000Z";

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "แอดมิน", email: "a@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    products: { p1: { id: "p1", sellingName: "Wendy Mid", status: "active", images: [], category: "x", sellingPrice: 1, createdAt: iso, updatedAt: iso } },
    variants: {
      v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "A", active: true, purchasePrice: 0, sellingPrice: 1 },
      v2: { id: "v2", productId: "p1", color: "กรม", size: "M", sku: "B", active: true, purchasePrice: 0, sellingPrice: 1 },
      v3: { id: "v3", productId: "p1", color: "เทาดิน", size: "M", sku: "C", active: true, purchasePrice: 0, sellingPrice: 1 },
    },
  } as never);
}

const product = () => useStore.getState().products.p1;
const names = () => screen.getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d+/, "").trim());

describe("ลำดับสีของรุ่น", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("เริ่มจากลำดับมาตรฐาน เลื่อนขึ้น/ลงแล้วบันทึก เก็บเป็นลำดับของรุ่น", () => {
    render(<ColorOrderCard product={product()} colors={["ดำ", "กรม", "เทาดิน"]} />);
    expect(names()).toEqual(["ดำ", "กรม", "เทาดิน"]);
    expect((screen.getByRole("button", { name: "บันทึกลำดับ" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "เลื่อน กรม ลง" }));
    expect(names()).toEqual(["ดำ", "เทาดิน", "กรม"]);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับ" }));
    expect(product().colorOrder).toEqual(["ดำ", "เทาดิน", "กรม"]);
  });

  it("บันทึกลำดับไม่กระทบสต็อกหรือประวัติการเคลื่อนไหว", () => {
    render(<ColorOrderCard product={product()} colors={["ดำ", "กรม", "เทาดิน"]} />);
    const before = JSON.stringify([useStore.getState().variantStock, useStore.getState().movements]);
    fireEvent.click(screen.getByRole("button", { name: "เลื่อน เทาดิน ขึ้น" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับ" }));
    expect(JSON.stringify([useStore.getState().variantStock, useStore.getState().movements])).toBe(before);
  });

  it("ปุ่มบนสุดเลื่อนขึ้นไม่ได้ ปุ่มล่างสุดเลื่อนลงไม่ได้", () => {
    render(<ColorOrderCard product={product()} colors={["ดำ", "กรม", "เทาดิน"]} />);
    expect((screen.getByRole("button", { name: "เลื่อน ดำ ขึ้น" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "เลื่อน เทาดิน ลง" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
