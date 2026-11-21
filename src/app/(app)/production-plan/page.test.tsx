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
        Promise.resolve(resolve({ data: [{ month: "2026-10-01", product_id: productId, color: "ดำ", size: "M", qty: 100 }, { month: "2026-09-01", product_id: productId, color: "ดำ", size: "M", qty: 40 }], error: null }));
      return chain;
    },
  }),
}));

function seed(role: "admin" | "warehouse" | "sales" = "admin") {
  const state = produce(emptyState(), (d) => {
    const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    productId = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1000, category: "กางเกง", status: "active", images: [], brandId: brand });
    const v = engine.addVariant(d, productId, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    engine.stockIn(d, { itemType: "product", date: "2026-11-10T00:00:00.000Z", warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: v, qty: 30 }] });
    d.users.u1 = { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: "2026-11-01T00:00:00.000Z" } as never;
    d.currentUserId = "u1";
  });
  useStore.getState().actions.hydrate(state as never);
}

describe("หน้าวางแผนผลิต", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("แต่ละรุ่นมีสามตารางเรียงข้างกัน ยอดขาย / สต็อกปัจจุบัน / ที่ต้องผลิต พร้อมตัวเลขถูกต้อง", async () => {
    render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByText(/ที่ต้องผลิตเพิ่ม \(ชิ้น\)/)).toBeTruthy());
    expect(screen.getByText(/ยอดขาย \(ชิ้น\)/)).toBeTruthy();
    expect(screen.getByText(/สต็อกปัจจุบัน \(ชิ้น\)/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ยอดขาย" })).toBeNull(); // ไม่ใช่แท็บแล้ว
    // สีเดียวขาย 100 = 100% ของรุ่น
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
    // ขาย 100, คลัง 30, ต้องผลิต 100 - 30 = 70
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("70").length).toBeGreaterThan(0);
  });

  it("ปุ่มดูล่วงหน้า 1/2/3 เดือนบอกยอดขาดรวมของแต่ละกรณี และกดแล้วตารางเปลี่ยนตาม", async () => {
    render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /ดูล่วงหน้า 1 เดือน/ })).toBeTruthy());
    // ขายเดือนละ 100 คลัง 30: 1 เดือนขาด 70, 2 เดือนขาด 170, 3 เดือนขาด 270
    expect(screen.getByRole("button", { name: /ดูล่วงหน้า 1 เดือน/ }).textContent).toContain("70");
    expect(screen.getByRole("button", { name: /ดูล่วงหน้า 2 เดือน/ }).textContent).toContain("170");
    expect(screen.getByRole("button", { name: /ดูล่วงหน้า 3 เดือน/ }).textContent).toContain("270");
    // มีปุ่มถึง 8 เดือน: ขาย 100 x 8 - คลัง 30 = 770
    expect(screen.getByRole("button", { name: /ดูล่วงหน้า 8 เดือน/ }).textContent).toContain("770");
    expect(screen.queryByRole("button", { name: /ดูล่วงหน้า 9 เดือน/ })).toBeNull();
    // ปุ่มแต่ละปุ่มบอกวันที่ปลายทาง dd/mm/yyyy
    expect(screen.getByRole("button", { name: /ดูล่วงหน้า 1 เดือน/ }).textContent).toMatch(/ถึง \d{2}\/\d{2}\/\d{4}/);
    fireEvent.click(screen.getByRole("button", { name: /ดูล่วงหน้า 2 เดือน/ }));
    expect(screen.getAllByText("200").length).toBeGreaterThan(0); // ยอดขาย 100 x 2
    expect(screen.getAllByText("170").length).toBeGreaterThan(0);
  });

  it("เลือกเดือนยอดขายอ้างอิงได้ ติ๊กหลายเดือน = เฉลี่ย", async () => {
    render(<ProductionPlanPage />);
    const group = await screen.findByRole("group", { name: "เลือกเดือนยอดขายอ้างอิง" });
    const chips = Array.from(group.querySelectorAll("button[aria-pressed]")) as HTMLButtonElement[];
    expect(chips.some((c) => c.title === "จากไฟล์ที่นำเข้า")).toBe(true);
    const usable = chips.filter((c) => !c.disabled);
    expect(usable).toHaveLength(2); // ก.ย. และ ต.ค. จากไฟล์
    expect(chips.some((c) => c.disabled)).toBe(true); // เดือนที่ยังไม่มีข้อมูลโชว์เป็นปุ่มจาง กดไม่ได้
    // ตั้งต้นเลือกเดือนเดียว (เดือนล่าสุดที่นำเข้า) ติ๊กเพิ่มอีกเดือน → เฉลี่ย 2 เดือน
    expect(usable.filter((c) => c.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    fireEvent.click(usable.find((c) => c.getAttribute("aria-pressed") === "false")!);
    await waitFor(() => expect(screen.getByText(/เฉลี่ย 2 เดือน/)).toBeTruthy());
  });

  it("ทุกคนที่ดูสินค้าได้ (พนักงานคลัง/ฝ่ายขาย) เห็นแผนผลิต แต่ไม่เห็นช่องนำเข้าไฟล์ยอดขาย", async () => {
    for (const role of ["warehouse", "sales"] as const) {
      cleanup();
      seed(role);
      render(<ProductionPlanPage />);
      await waitFor(() => expect(screen.getByText(/ที่ต้องผลิตเพิ่ม \(ชิ้น\)/)).toBeTruthy());
      expect(screen.queryByText(/นำเข้ายอดขายรายเดือนจากไฟล์/)).toBeNull();
    }
  });

  it("ผู้มีสิทธิ์ดูรายงาน (admin) เห็นช่องนำเข้าไฟล์ยอดขายด้วย", async () => {
    render(<ProductionPlanPage />);
    expect(await screen.findByText(/นำเข้ายอดขายรายเดือนจากไฟล์/)).toBeTruthy();
  });

  it("ทั้งสามตารางกว้างเท่ากันและทุกแถวสูงเท่ากัน (ตรงกันแถวต่อแถว) ไม่ว่าจะมีบรรทัด +รอเย็บ หรือคอลัมน์ % หรือไม่", async () => {
    const { container } = render(<ProductionPlanPage />);
    await waitFor(() => expect(screen.getByText(/ที่ต้องผลิตเพิ่ม \(ชิ้น\)/)).toBeTruthy());
    const tables = Array.from(container.querySelectorAll("table"));
    expect(tables).toHaveLength(3);
    for (const t of tables) {
      expect(t.className).toContain("table-fixed");
      expect(t.className).toContain("w-full");
      expect(t.parentElement?.className).toContain("w-[56rem]"); // ความกว้างเท่ากันทุกตาราง
      const bodyRows = Array.from(t.querySelectorAll("tbody tr"));
      expect(bodyRows.length).toBeGreaterThan(0);
      for (const r of bodyRows) expect(r.className).toContain("h-14"); // ความสูงแถวเท่ากัน
    }
  });
});
