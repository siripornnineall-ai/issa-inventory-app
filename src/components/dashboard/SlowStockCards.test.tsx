import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { SlowStockCards } from "./SlowStockCards";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

function seed() {
  const mv = (id: string, variantId: string) => ({ id, createdAt: old, refNo: id, itemType: "product", itemId: variantId, variantId, itemName: "x", sku: "x", movementType: "stock_in", qtyChange: 12, qtyBefore: 0, qtyAfter: 12, actorId: "u", actorName: "u" });
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "x", email: "x@x.com", role: "admin", active: true, createdAt: old } },
    currentUserId: "u1",
    brands: {
      a: { id: "a", name: "ISSA Apparel", code: "IS", active: true, createdAt: "1" },
      b: { id: "b", name: "ISSA Activewear", code: "IA", active: true, createdAt: "2" },
      c: { id: "c", name: "Fasonaf", code: "FS", active: true, createdAt: "3" },
    },
    warehouses: { w1: { id: "w1", name: "คลัง", type: "main", active: true, createdAt: old } },
    products: {
      p1: { id: "p1", sellingName: "Billie Slim", brandId: "a", createdAt: old },
      p2: { id: "p2", sellingName: "Bruno Slim", brandId: "b", createdAt: old },
    },
    variants: {
      v1: { id: "v1", productId: "p1", color: "ดำ", size: "XL", sku: "a", active: true },
      v2: { id: "v2", productId: "p1", color: "ครีม", size: "5XL", sku: "b", active: true },
      v3: { id: "v3", productId: "p2", color: "ดำ", size: "M", sku: "c", active: true },
    },
    variantStock: {
      "v1::w1": { itemId: "v1", warehouseId: "w1", qtyOnHand: 12, qtyReserved: 0 },
      "v2::w1": { itemId: "v2", warehouseId: "w1", qtyOnHand: 12, qtyReserved: 0 },
      "v3::w1": { itemId: "v3", warehouseId: "w1", qtyOnHand: 12, qtyReserved: 0 },
    },
    movements: { m1: mv("m1", "v1"), m2: mv("m2", "v2"), m3: mv("m3", "v3") },
  } as never);
}

describe("SlowStockCards: สินค้าค้างสต็อกแยกกล่องตามแบรนด์", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("แต่ละแบรนด์เป็นกล่องของตัวเอง ใช้ชื่อแบรนด์เป็นหัวกล่อง บอกจำนวนชิ้น/ตัวเลือกที่ค้าง และแบรนด์ที่ไม่มีของค้างบอกว่าไม่มี", () => {
    render(<SlowStockCards />);
    expect(screen.getByRole("heading", { name: "ISSA Apparel" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ISSA Activewear" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Fasonaf" })).toBeTruthy();
    expect(screen.getByText("ค้าง 24 ชิ้น · 2 ตัวเลือก")).toBeTruthy(); // ISSA Apparel: v1 + v2
    expect(screen.getByText("ค้าง 12 ชิ้น · 1 ตัวเลือก")).toBeTruthy(); // ISSA Activewear
    expect(screen.getByText("ไม่มีสินค้าค้างสต็อก")).toBeTruthy(); // Fasonaf
    expect(screen.getByText("Billie Slim")).toBeTruthy();
    // แบรนด์ที่ไม่มีของค้างไม่มีลิงก์ดูทั้งหมด
    expect(screen.getAllByText("ดูสินค้าค้างทั้งหมด →")).toHaveLength(2);
  });

  it("บอกกติกาที่ใช้คิดไว้ชัดเจนในหน้า (30 วัน / 15 วัน / 5 ชิ้น)", () => {
    render(<SlowStockCards />);
    expect(screen.getByText(/มีของตั้งแต่ 5 ชิ้น ขายได้ไม่เกิน 1 ชิ้นใน 30 วันล่าสุด และรับเข้ามาเกิน 15 วัน/)).toBeTruthy();
  });

  it("กดดูทั้งหมด: เปิดรายละเอียดของแบรนด์นั้น สลับดูตามรุ่น/สี/ไซซ์/รายตัวเลือกได้", () => {
    render(<SlowStockCards />);
    fireEvent.click(screen.getAllByText("ดูสินค้าค้างทั้งหมด →")[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/สินค้าค้างสต็อก — ISSA Apparel/)).toBeTruthy();
    expect(within(dialog).getByText("Billie Slim")).toBeTruthy(); // ตามรุ่น
    expect(within(dialog).queryByText("Bruno Slim")).toBeNull(); // ไม่มีของแบรนด์อื่นปน

    fireEvent.click(within(dialog).getByRole("button", { name: "ตามไซซ์" }));
    expect(within(dialog).getByText("XL")).toBeTruthy();
    expect(within(dialog).getByText("5XL")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "ตามสี" }));
    expect(within(dialog).getByText("ครีม")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "รายตัวเลือก" }));
    expect(within(dialog).getByText("ดำ / XL")).toBeTruthy();
    expect(within(dialog).getByText("ครีม / 5XL")).toBeTruthy();
  });
});
