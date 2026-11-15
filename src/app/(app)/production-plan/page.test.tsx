import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { produce } from "immer";
import ProductionPlanPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

let productId = "";
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from() {
      const chain: Record<string, unknown> = {};
      for (const f of ["select", "order", "limit"]) chain[f] = () => chain;
      chain.then = (resolve: (r: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [{ month: "2026-10-01", product_id: productId, color: "ดำ", size: "M", qty: 100 }], error: null }));
      return chain;
    },
  }),
}));

function seed() {
  const state = produce(emptyState(), (d) => {
    const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    productId = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1000, category: "กางเกง", status: "active", images: [], brandId: brand });
    const v = engine.addVariant(d, productId, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    engine.stockIn(d, { itemType: "product", date: "2026-11-10T00:00:00.000Z", warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: v, qty: 30 }] });
    d.users.u1 = { id: "u1", name: "ผู้ใช้", email: "a@x.com", role: "admin", active: true, createdAt: "2026-11-01T00:00:00.000Z" } as never;
    d.currentUserId = "u1";
  });
  useStore.getState().actions.hydrate(state as never);
}

describe("หน้าวางแผนผลิต", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("มีสามแท็บ ยอดขาย / สต็อกปัจจุบัน / ที่ต้องผลิต และเปลี่ยนตัวเลขในตารางตามแท็บ", async () => {
    render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "ที่ต้องผลิต" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "ยอดขาย" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "สต็อกปัจจุบัน" })).toBeTruthy();
    // ตั้งต้นที่แท็บ "ที่ต้องผลิต": ขาย 100 - คลัง 30 = 70
    expect(screen.getAllByText("70").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "ยอดขาย" }));
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "สต็อกปัจจุบัน" }));
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
  });
});
