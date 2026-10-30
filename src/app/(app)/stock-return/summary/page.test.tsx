import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import ReturnSummaryPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

const now = new Date().toISOString();

function seed(role: "admin" | "viewer" = "admin", withDocs = true) {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: now } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: now } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", images: [] }, p2: { id: "p2", sellingName: "Wendy Mid", images: [] } },
    variants: {
      v1: { id: "v1", productId: "p1", color: "ดำ", size: "XL", sku: "IS-BS-BLK-XL", active: true, purchasePrice: 0, sellingPrice: 1090 },
      v2: { id: "v2", productId: "p2", color: "ดำ", size: "XL", sku: "IS-WM-BLK-XL", active: true, purchasePrice: 0, sellingPrice: 1290 },
    },
    stockInDocs: withDocs
      ? {
          d1: { id: "d1", docNo: "SRT-20261030-0001", date: now, itemType: "product", returnType: "return_exchange", receiptImages: [], warehouseId: "w1", receivedBy: "u1", status: "confirmed", createdAt: now, note: "ลูกค้าทักไลน์มา",
            lines: [{ id: "l1", itemId: "v1", qty: 2, unitPrice: 1000, returnReason: "size", returnTags: ["เล็กไป"], exchangeToId: "v2" }] },
          d2: { id: "d2", docNo: "SRT-20261030-0002", date: now, itemType: "product", returnType: "return_customer", receiptImages: [], warehouseId: "w1", receivedBy: "u1", status: "confirmed", createdAt: now,
            lines: [{ id: "l2", itemId: "v1", qty: 1, unitPrice: 1090, returnReason: "defect" }] },
        }
      : {},
  } as never);
}

describe("หน้าสรุปสินค้าคืน/เปลี่ยน", () => {
  beforeEach(() => {
    cleanup();
  });

  it("แสดงตัวเลขรวม เหตุผลหลัก คำที่ลูกค้าพูด และเปลี่ยนจากอะไรเป็นอะไร", () => {
    seed();
    render(<ReturnSummaryPage />);
    expect(screen.getByText("มูลค่าที่ถูกคืน").parentElement?.textContent).toContain("3,090"); // 2x1000 + 1x1090
    const reasons = screen.getByText("เหตุผลหลักที่ลูกค้าคืน/เปลี่ยน").closest("div")!.parentElement!;
    expect(within(reasons).getByText("ไซซ์ไม่พอดี")).toBeTruthy();
    expect(within(reasons).getByText("สินค้ามีตำหนิ")).toBeTruthy();
    const words = screen.getByText("ลูกค้าพูดว่าอะไรบ่อยสุด").closest("div")!.parentElement!;
    expect(within(words).getByText("เล็กไป")).toBeTruthy();
    expect(screen.getAllByText(/Billie Slim ดำ XL/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wendy Mid ดำ XL").length).toBeGreaterThan(0);
    expect(screen.getByText(/ลูกค้าทักไลน์มา/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /ดาวน์โหลด Excel/ })).toBeTruthy();
  });

  it("ไม่มีใบรับคืนในช่วงนี้: บอกว่าไม่มีข้อมูล ปุ่ม Excel กดไม่ได้", () => {
    seed("admin", false);
    render(<ReturnSummaryPage />);
    expect(screen.getByText("ไม่มีสินค้าคืนในช่วงนี้")).toBeTruthy();
    expect((screen.getByRole("button", { name: /ดาวน์โหลด Excel/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("ผู้ดูอย่างเดียว (viewer) ที่มีสิทธิ์ดูประวัติ เข้าดูสรุปได้", () => {
    useStore.getState().actions.hydrate({ ...emptyState(), users: { u1: { id: "u1", name: "x", email: "a@x.com", role: "viewer", active: true, createdAt: now } }, currentUserId: "u1" } as never);
    render(<ReturnSummaryPage />);
    expect(screen.queryByText("ไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeNull();
  });
});
