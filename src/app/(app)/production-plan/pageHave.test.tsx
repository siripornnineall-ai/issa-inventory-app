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
      for (const f of ["select", "order", "limit", "range"]) chain[f] = () => chain;
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

describe("หน้าวางแผนผลิต: ตารางที่ต้องผลิตแสดงเลขตัวเดียวต่อช่อง", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  const needTable = (container: HTMLElement) => container.querySelectorAll("table:not([data-material])")[2] as HTMLTableElement;
  const cellOf = (table: HTMLTableElement, color: string) => Array.from(table.querySelectorAll("tbody tr")).find((r) => r.querySelector("td")?.textContent === color)!;

  it("ค่าเริ่มต้นติ๊กอยู่: ช่องที่ขาดเป็นเลขติดลบสีแดง ช่องที่มีของพอเป็นจำนวนของที่มีสีเทา ไม่มีคำว่า 'มี'", async () => {
    const { container } = render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByText(/ที่ต้องผลิตเพิ่ม \(ชิ้น\)/)).toBeTruthy());
    expect((screen.getByLabelText("โชว์ของที่มีในตารางที่ต้องผลิต") as HTMLInputElement).checked).toBe(true);
    const t = needTable(container);
    const black = cellOf(t, "ดำ"); // ขาย 100 มี 30 → ขาด 70
    expect(black.textContent).toContain("-70");
    const shortageCell = Array.from(black.querySelectorAll("td")).find((td) => td.textContent === "-70")!;
    expect(shortageCell.className).toContain("text-[var(--color-danger)]");
    const white = cellOf(t, "ขาว"); // ขาย 50 มี 500 → พอ แสดง 500 สีเทา
    const haveCell = Array.from(white.querySelectorAll("td span")).find((el) => el.textContent === "500")!;
    expect(haveCell.className).toContain("text-[var(--color-on-surface-variant)]");
    expect(t.textContent).not.toContain("มี "); // ไม่มีคำกำกับซ้อนในช่อง
    // ช่องรวมของที่ขาดเป็นติดลบด้วย ส่วนแถวที่ไม่ขาดเลยเป็น 0
    expect(black.textContent).toContain("-70");
    expect(white.textContent).toContain("0");
  });

  it("ติ๊กออก → กลับเป็นแบบเดิม ที่ขาดเป็นเลขแดงบวก ช่องที่ไม่ขาดเป็นขีด", async () => {
    const { container } = render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByText(/ที่ต้องผลิตเพิ่ม \(ชิ้น\)/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText("โชว์ของที่มีในตารางที่ต้องผลิต"));
    const t = needTable(container);
    expect(cellOf(t, "ดำ").textContent).toContain("70");
    expect(cellOf(t, "ดำ").textContent).not.toContain("-70");
    expect(cellOf(t, "ขาว").textContent).toContain("–");
    expect(cellOf(t, "ขาว").textContent).not.toContain("500");
  });
});
