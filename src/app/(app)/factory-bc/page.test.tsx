import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FactoryBcPage from "./page";
import FactoryRecordPage from "./record/page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

const iso = "2026-11-10T00:00:00.000Z";

function seed(role: "admin" | "viewer" = "admin", withEntries = true) {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    brands: { b1: { id: "b1", name: "ISSA Apparel", code: "IS", active: true, createdAt: iso } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", status: "active", images: [] } },
    variants: {
      vBlkM: { id: "vBlkM", productId: "p1", color: "ดำ", size: "M", sku: "IS-BS-BLK-M", active: true, purchasePrice: 0, sellingPrice: 1090 },
      vBlkL: { id: "vBlkL", productId: "p1", color: "ดำ", size: "L", sku: "IS-BS-BLK-L", active: true, purchasePrice: 0, sellingPrice: 1090 },
    },
    factoryWipEntries: withEntries
      ? {
          e1: { id: "e1", batchId: "b-1", date: iso, variantId: "vBlkM", kind: "opening", qtyChange: 100, actorName: "ผู้ใช้", createdAt: iso },
          e2: { id: "e2", batchId: "b-1", date: iso, variantId: "vBlkL", kind: "opening", qtyChange: 30, actorName: "ผู้ใช้", createdAt: iso },
        }
      : {},
  } as never);
}

describe("หน้าโรงงาน BC", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("แสดงยอดยังไม่เย็บรวมและตารางสี x ไซซ์", () => {
    seed();
    render(<FactoryBcPage />);
    expect(screen.getByRole("status").textContent).toContain("130");
    expect(screen.getByText("Billie Slim")).toBeTruthy();
    expect(screen.queryByText("ประวัติการบันทึก")).toBeNull(); // ประวัติย้ายไปหน้า ประวัติโรงงาน BC ในกลุ่มประวัติการเคลื่อนไหว
    expect(screen.getByRole("link", { name: /บันทึกตัวที่ยังไม่เย็บ/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Excel/ })).toBeTruthy();
  });

  it("ยังไม่มีบันทึก: บอกให้กรอกยอดตั้งต้น", () => {
    seed("admin", false);
    render(<FactoryBcPage />);
    expect(screen.getByText("ยังไม่มีตัวที่ยังไม่เย็บ")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Excel/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("ผู้ดูอย่างเดียวเห็นข้อมูลได้ แต่ไม่มีปุ่มบันทึก", () => {
    seed("viewer");
    render(<FactoryBcPage />);
    expect(screen.getByText("Billie Slim")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /บันทึกตัวที่ยังไม่เย็บ/ })).toBeNull();
  });
});

describe("หน้าบันทึกตัวที่ยังไม่เย็บ", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("เลือกรุ่น กรอกแยกสี/ไซซ์ แล้วบันทึก: ยอดเพิ่มในสมุดบันทึก ไม่แตะสต็อกสินค้า", () => {
    seed("admin", false);
    render(<FactoryRecordPage />);
    fireEvent.change(screen.getByLabelText("เลือกรุ่น"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("ดำ M"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("ดำ L"), { target: { value: "45" } });
    expect(screen.getByText(/กรอกแล้ว/).textContent).toContain("2");
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    const s = useStore.getState();
    const entries = Object.values(s.factoryWipEntries);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.qtyChange).sort((a, b) => a - b)).toEqual([45, 120]);
    expect(entries.every((e) => e.kind === "cut_in")).toBe(true);
    expect(Object.keys(s.movements)).toHaveLength(0);
    expect(screen.getByText("บันทึกตัวที่ยังไม่เย็บแล้ว")).toBeTruthy();
  });

  it("ปรับยอด/เสียหายต้องใส่เหตุผล ไม่ใส่แล้วไม่บันทึก", () => {
    seed("admin", false);
    render(<FactoryRecordPage />);
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "scrap" } }); // ช่องแรก = ประเภท
    fireEvent.change(screen.getByLabelText("เลือกรุ่น"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("ดำ M"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(Object.keys(useStore.getState().factoryWipEntries)).toHaveLength(0);
  });
});

describe("โรงงาน BC: ลำดับสี", () => {
  it("ตารางเรียงสีตามลำดับที่ตั้งไว้ ไม่ตามยอด", async () => {
    const { wipMatrices } = await import("@/lib/utils/factoryWipView");
    seed();
    const s = useStore.getState();
    // เพิ่มสีกรมที่ยอดมากกว่าดำ: ลำดับมาตรฐานยังต้องเป็น ดำ ก่อน กรม
    const state = {
      ...s,
      variants: { ...s.variants, vNavy: { id: "vNavy", productId: "p1", color: "กรม", size: "M", sku: "N", active: true, purchasePrice: 0, sellingPrice: 1 } },
      factoryWipEntries: { ...s.factoryWipEntries, e9: { id: "e9", batchId: "b-2", date: iso, variantId: "vNavy", kind: "opening" as const, qtyChange: 900, actorName: "x", createdAt: iso } },
    };
    expect(wipMatrices(state as never)[0].colors.map((c) => c.color)).toEqual(["ดำ", "กรม"]);
    const custom = { ...state, products: { ...state.products, p1: { ...state.products.p1, colorOrder: ["กรม", "ดำ"] } } };
    expect(wipMatrices(custom as never)[0].colors.map((c) => c.color)).toEqual(["กรม", "ดำ"]);
  });
});
