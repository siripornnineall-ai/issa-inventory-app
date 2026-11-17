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
        Promise.resolve(
          resolve({
            data: [
              { month: "2026-10-01", product_id: productId, color: "ดำ", size: "M", qty: 100 }, // ขาด: ขาย 100 มี 30
              { month: "2026-10-01", product_id: productId, color: "ขาว", size: "M", qty: 50 }, // ไม่ขาด: ขาย 50 มี 500
            ],
            error: null,
          })
        );
      return chain;
    },
  }),
}));

function seed() {
  const state = produce(emptyState(), (d) => {
    const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    productId = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1000, category: "กางเกง", status: "active", images: [], brandId: brand });
    const blk = engine.addVariant(d, productId, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    const wht = engine.addVariant(d, productId, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    for (const [id, qty] of [[blk, 30], [wht, 500]] as const) {
      engine.stockIn(d, { itemType: "product", date: "2026-11-10T00:00:00.000Z", warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: id, qty }] });
    }
    d.users.u1 = { id: "u1", name: "ผู้ใช้", email: "a@x.com", role: "admin", active: true, createdAt: "2026-11-01T00:00:00.000Z" } as never;
    d.currentUserId = "u1";
  });
  useStore.getState().actions.hydrate(state as never);
}

describe("หน้าวางแผนผลิต: โชว์ของที่มีในตารางที่ต้องผลิต", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("ค่าเริ่มต้นติ๊กอยู่: ช่องที่ไม่ขาดแทนขีดด้วย 'มี N' ส่วนช่องที่ขาดมีเลขผลิตพร้อม 'มี N' ใต้เลข", async () => {
    render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByText(/ที่ต้องผลิตเพิ่ม \(ชิ้น\)/)).toBeTruthy());
    const box = screen.getByLabelText("โชว์ของที่มีในตารางที่ต้องผลิต") as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText("มี 500")).toBeTruthy(); // ขาว M ไม่ขาด (ขาย 50 มี 500)
    expect(screen.getByText("มี 30")).toBeTruthy(); // ดำ M ขาด 70 แต่ยังบอกว่ามี 30
    expect(screen.getAllByText("70").length).toBeGreaterThan(0); // เลขผลิตยังอยู่
  });

  it("ติ๊กออก → กลับเป็นแบบเดิม ช่องที่ไม่ขาดเป็นขีด ไม่มี 'มี N'", async () => {
    render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByText("มี 500")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("โชว์ของที่มีในตารางที่ต้องผลิต"));
    expect(screen.queryByText("มี 500")).toBeNull();
    expect(screen.queryByText("มี 30")).toBeNull();
    expect(screen.getAllByText("70").length).toBeGreaterThan(0);
  });
});
