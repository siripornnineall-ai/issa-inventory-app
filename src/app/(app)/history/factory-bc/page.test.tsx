import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FactoryHistoryPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

const iso = new Date().toISOString();

function seed(role: "admin" | "viewer" = "admin") {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: iso } },
    currentUserId: "u1",
    products: { p1: { id: "p1", sellingName: "Billie Slim", status: "active", images: [] } },
    variants: {
      vBlkM: { id: "vBlkM", productId: "p1", color: "ดำ", size: "M", sku: "IS-BS-BLK-M", active: true, purchasePrice: 0, sellingPrice: 1 },
      vWhtL: { id: "vWhtL", productId: "p1", color: "ขาว", size: "L", sku: "IS-BS-WHT-L", active: true, purchasePrice: 0, sellingPrice: 1 },
    },
    factoryWipEntries: {
      e1: { id: "e1", batchId: "b1", date: iso, variantId: "vBlkM", kind: "cut_in", qtyChange: 120, actorName: "Kalong", createdAt: iso },
      e2: { id: "e2", batchId: "b2", date: iso, variantId: "vWhtL", kind: "scrap", qtyChange: -4, note: "ผ้าขาด", actorName: "Kalong", createdAt: iso },
    },
  } as never);
}

describe("หน้าประวัติโรงงาน BC", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("แสดงทีละสี/ไซซ์ พร้อมประเภท จำนวน ผู้บันทึก และมีลิงก์กลับหน้าประวัติการเคลื่อนไหว", () => {
    render(<FactoryHistoryPage />);
    expect(screen.getByText(/ดำ \/ M/)).toBeTruthy();
    expect(screen.getByText(/ขาว \/ L/)).toBeTruthy();
    expect(screen.getByText("+120 ชิ้น")).toBeTruthy();
    expect(screen.getByText("-4 ชิ้น")).toBeTruthy();
    expect(screen.getByRole("link", { name: /กลับไปประวัติการเคลื่อนไหว/ }).getAttribute("href")).toBe("/history");
  });

  it("กรองตามประเภทได้", () => {
    render(<FactoryHistoryPage />);
    fireEvent.change(screen.getByRole("combobox", { name: "ประเภท" }), { target: { value: "scrap" } });
    expect(screen.queryByText(/ดำ \/ M/)).toBeNull();
    expect(screen.getByText(/ขาว \/ L/)).toBeTruthy();
  });
});
