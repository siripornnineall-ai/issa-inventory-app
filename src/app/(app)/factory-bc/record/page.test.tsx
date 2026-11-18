import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import RecordPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

const iso = "2026-11-17T00:00:00.000Z";

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "BC", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    brands: { b1: { id: "b1", name: "ISSA Apparel", code: "IS", active: true, createdAt: iso } },
    products: {
      p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", shape: "ทรงกระบอกเล็ก", status: "active", images: [], createdAt: iso },
      p2: { id: "p2", sellingName: "Wendy Mid", brandId: "b1", status: "active", images: [], createdAt: iso },
    },
    variants: {
      v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "IS-BS-BLK-M", active: true, purchasePrice: 0 },
      v2: { id: "v2", productId: "p2", color: "ขาว", size: "L", sku: "IS-WM-WHT-L", active: true, purchasePrice: 0 },
    },
  } as never);
}

describe("หน้าบันทึกตัวที่ยังไม่เย็บ: เลือกรุ่นแบบพิมพ์ค้นหา", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    seed();
  });

  it("พิมพ์ค้นหารุ่นแล้วเลือก → ขึ้นตารางสี/ไซซ์ของรุ่นนั้น (ไม่ใช่รายการยาวให้เลื่อนหา)", () => {
    render(<RecordPage />);
    expect(screen.queryByRole("table")).toBeNull();
    const box = screen.getByRole("combobox", { name: "เลือกรุ่น" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "wen" } });
    const list = within(screen.getByRole("listbox"));
    expect(list.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(list.getByRole("option", { name: /Wendy Mid/ }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("ขาว")).toBeTruthy(); // สีของ Wendy Mid ไม่ใช่ของ Billie Slim
    expect(screen.queryByText("ดำ")).toBeNull();
  });
});
