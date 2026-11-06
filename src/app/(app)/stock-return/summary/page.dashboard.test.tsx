import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import ReturnSummaryPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

const now = new Date().toISOString();

function seed() {
  const line = (id: string, itemId: string, qty: number, returnReason: string) => ({ id, itemId, qty, unitPrice: 1000, returnReason });
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role: "admin", active: true, createdAt: now } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: now } },
    brands: { b1: { id: "b1", name: "ISSA Apparel", code: "IS" }, b2: { id: "b2", name: "Fasonaf", code: "FS" } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", images: [] }, p2: { id: "p2", sellingName: "Wendy Mid", brandId: "b2", images: [] } },
    variants: {
      v1: { id: "v1", productId: "p1", color: "ดำ", size: "XL", sku: "IS-BS-BLK-XL", active: true, purchasePrice: 0, sellingPrice: 1000 },
      v2: { id: "v2", productId: "p2", color: "ดำ", size: "XL", sku: "FS-WM-BLK-XL", active: true, purchasePrice: 0, sellingPrice: 1000 },
    },
    stockInDocs: {
      d1: { id: "d1", docNo: "SRT-1", date: now, itemType: "product", returnType: "return_customer", receiptImages: [], warehouseId: "w1", receivedBy: "u1", status: "confirmed", createdAt: now, lines: [line("l1", "v1", 6, "size")] },
      d2: { id: "d2", docNo: "SRT-2", date: now, itemType: "product", returnType: "return_defective", receiptImages: [], warehouseId: "w1", receivedBy: "u1", status: "confirmed", createdAt: now, lines: [line("l2", "v2", 2, "defect")] },
    },
  } as never);
}

describe("แดชบอร์ดสรุปสินค้าคืน/เปลี่ยน", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("มีการ์ดเปรียบเทียบแต่ละแบรนด์ และข้อสรุปแยกตามแบรนด์", () => {
    render(<ReturnSummaryPage />);
    const cmp = screen.getByRole("region", { name: "เปรียบเทียบแต่ละแบรนด์" });
    expect(within(cmp).getByText("ISSA Apparel")).toBeTruthy();
    expect(within(cmp).getByText("Fasonaf")).toBeTruthy();
    expect(screen.getByText("สรุป: ควรทำอะไรต่อ")).toBeTruthy();
    expect(screen.getAllByText(/ตารางไซซ์/).length).toBeGreaterThan(0); // ISSA Apparel คืนเพราะไซซ์ 6 ชิ้น
  });

  it("กดการ์ดแบรนด์แล้วตัวเลขเหลือเฉพาะแบรนด์นั้น กดซ้ำกลับเป็นทุกแบรนด์", () => {
    render(<ReturnSummaryPage />);
    expect(screen.getByText("มูลค่าที่ถูกคืน").parentElement?.textContent).toContain("8,000");
    const cmp = screen.getByRole("region", { name: "เปรียบเทียบแต่ละแบรนด์" });
    fireEvent.click(within(cmp).getByRole("button", { name: /Fasonaf/ }));
    expect(screen.getByText("มูลค่าที่ถูกคืน").parentElement?.textContent).toContain("2,000");
    fireEvent.click(within(cmp).getByRole("button", { name: /Fasonaf/ }));
    expect(screen.getByText("มูลค่าที่ถูกคืน").parentElement?.textContent).toContain("8,000");
  });

  it("กดแถบเหตุผลเพื่อเจาะดู แล้วล้างตัวกรองได้", () => {
    render(<ReturnSummaryPage />);
    const reasons = screen.getByText("เหตุผลหลักที่ลูกค้าคืน/เปลี่ยน").closest("div")!.parentElement!;
    fireEvent.click(within(reasons).getByRole("button", { name: /สินค้ามีตำหนิ/ }));
    expect(screen.getByText(/กำลังดูเฉพาะ/)).toBeTruthy();
    expect(screen.getByText("มูลค่าที่ถูกคืน").parentElement?.textContent).toContain("2,000");
    fireEvent.click(screen.getByRole("button", { name: /ล้างตัวกรอง/ }));
    expect(screen.queryByText(/กำลังดูเฉพาะ/)).toBeNull();
    expect(screen.getByText("มูลค่าที่ถูกคืน").parentElement?.textContent).toContain("8,000");
  });
});
