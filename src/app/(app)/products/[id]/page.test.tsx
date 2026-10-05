import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ProductDetailPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "p1" }), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

function seed(skus: string[], brandId: string | undefined) {
  const variants: Record<string, unknown> = {};
  skus.forEach((sku, i) => {
    variants[`v${i}`] = { id: `v${i}`, productId: "p1", color: "ดำ", size: ["S", "M", "L"][i], sku, active: true, isDefective: false, purchasePrice: 1, sellingPrice: 2, reorderPoint: 5 };
  });
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
    currentUserId: "u1",
    brands: { b1: { id: "b1", name: "ISSA Activewear", code: "IA", active: true, createdAt: "" } },
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "" } },
    products: { p1: { id: "p1", sellingName: "Fitty Leeggings", brandId, modelCode: "FL", images: [], sellingPrice: 1090, category: "x", status: "active", createdAt: "2026-10-05T00:00:00.000Z", updatedAt: "2026-10-05T00:00:00.000Z" } },
    variants,
  } as never);
}

describe("หน้าสินค้า: แจ้งให้สร้าง SKU ใหม่", () => {
  beforeEach(() => cleanup());

  it("ใส่แบรนด์ทีหลัง SKU ยังเป็นรุ่นเก่า (ISSA-...) ต้องมีปุ่มสร้าง SKU ใหม่", () => {
    seed(["ISSA-FITLEE-DA-S-005", "ISSA-FITLEE-DA-M-006", "ISSA-FITLEE-DA-L-007"], "b1");
    render(<ProductDetailPage />);
    expect(screen.getByRole("button", { name: /สร้าง SKU ใหม่ให้สแกนได้/ })).toBeTruthy();
    expect(screen.getByText(/ไม่ตรงกับแบรนด์ IA และรหัสรุ่น FL/)).toBeTruthy();
  });

  it("SKU ตรงรูปแบบแบรนด์-รุ่นแล้ว ไม่แสดงปุ่ม", () => {
    seed(["IA-FL-BLK-S", "IA-FL-BLK-M", "IA-FL-BLK-L"], "b1");
    render(<ProductDetailPage />);
    expect(screen.queryByRole("button", { name: /สร้าง SKU ใหม่ให้สแกนได้/ })).toBeNull();
  });
});
