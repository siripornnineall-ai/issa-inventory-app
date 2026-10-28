import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import StockOverviewPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import * as excel from "@/lib/utils/excelMonths";

vi.mock("@/lib/utils/excelMonths", async (orig) => ({ ...(await orig<typeof import("@/lib/utils/excelMonths")>()), downloadWorkbook: vi.fn() }));

vi.mock("@/components/layout/Header", () => ({ Header: ({ title, description }: { title: string; description?: string }) => (
  <header>
    <h1>{title}</h1>
    <p>{description}</p>
  </header>
) }));

const thisMonth = () => {
  const d = new Date();
  d.setDate(15);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

function seed() {
  const at = thisMonth();
  useStore.getState().actions.hydrate({
    ...emptyState(),
    brands: {
      b1: { id: "b1", name: "ISSA Apparel", code: "IS", active: true, createdAt: "" },
      b2: { id: "b2", name: "Fasonaf", code: "FS", active: true, createdAt: "" },
    },
    warehouses: { w1: { id: "w1", name: "คลัง", type: "main", active: true, createdAt: "" } },
    products: { p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", createdAt: "" } },
    variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "a", active: true } },
    variantStock: { "v1::w1": { itemId: "v1", warehouseId: "w1", qtyOnHand: 7, qtyReserved: 0 } },
    orders: { o1: { id: "o1", orderNo: "o1", date: at, channel: "online", warehouseId: "w1", lines: [{ id: "l", productId: "p1", variantId: "v1", qty: 3, unitPrice: 1, discount: 0 }], status: "completed", restocked: false, createdAt: at } },
    movements: {
      m1: { id: "m1", createdAt: new Date().toISOString(), refNo: "ADJ-1", itemType: "product", itemId: "v1", variantId: "v1", itemName: "x", sku: "a", movementType: "adjustment", qtyChange: -2, qtyBefore: 12, qtyAfter: 10, warehouseToId: "w1", reason: "นับสต็อก — Billie Slim", actorId: "u", actorName: "u" },
    },
  } as never);
}

describe("สต็อกภาพรวม: แท็บสต็อกปัจจุบัน / ยอดขาย / สต็อกนับใหม่", () => {
  beforeEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/stock-overview");
    Element.prototype.scrollIntoView = vi.fn();
    seed();
  });

  it("เปิดมาที่แท็บสต็อกปัจจุบัน (ตารางสต็อกเดิม) และมีครบ 3 แท็บ", () => {
    render(<StockOverviewPage />);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["สต็อกปัจจุบัน", "ยอดขาย", "สต็อกนับใหม่"]);
    expect(screen.getByRole("tab", { name: "สต็อกปัจจุบัน" }).getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("model-p1")).not.toBeNull();
  });

  it("กดแท็บยอดขายและสต็อกนับใหม่ สลับเนื้อหา และจำแท็บไว้ใน URL", () => {
    render(<StockOverviewPage />);
    fireEvent.click(screen.getByRole("tab", { name: "ยอดขาย" }));
    expect(screen.getByRole("tab", { name: "ยอดขาย" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("ยอดขายสุทธิเดือน");
    expect(window.location.search).toBe("?tab=sales");

    fireEvent.click(screen.getByRole("tab", { name: "สต็อกนับใหม่" }));
    expect(screen.getByRole("status").textContent).toContain("ผลนับสต็อกเดือน");
    expect(window.location.search).toBe("?tab=recount");

    fireEvent.click(screen.getByRole("tab", { name: "สต็อกปัจจุบัน" }));
    expect(window.location.search).toBe("");
    expect(document.getElementById("model-p1")).not.toBeNull();
  });

  it("เปิดลิงก์ที่ระบุ ?tab=sales ตรงแท็บยอดขาย", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=sales");
    render(<StockOverviewPage />);
    expect(screen.getByRole("tab", { name: "ยอดขาย" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("3 ชิ้น");
  });

  it("แท็บสต็อกนับใหม่: เทียบยอดที่นับได้กับระบบก่อนนับ และสต็อกตอนนี้ ในรุ่นเดียวกัน", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    const status = screen.getByRole("status").textContent ?? "";
    expect(status).toContain("นับได้จริง 10 ชิ้น");
    expect(status).toContain("ระบบเดิม (ก่อนนับ) 12 ชิ้น");
    expect(status).toContain("-2");
    const table = screen.getAllByRole("table")[0];
    const row = within(table).getAllByRole("row")[1];
    expect(row.textContent).toContain("ดำ");
    expect(row.textContent).toContain("ระบบ 12"); // ช่องที่ไม่ตรงโชว์ยอดระบบ
    expect(row.textContent).toContain("7"); // สต็อกตอนนี้
  });

  it("แบรนด์ที่เลือกไว้ใช้ร่วมกันข้ามแท็บ", () => {
    render(<StockOverviewPage />);
    fireEvent.change(screen.getByLabelText("แบรนด์"), { target: { value: "b2" } });
    fireEvent.click(screen.getByRole("tab", { name: "ยอดขาย" }));
    expect((screen.getByLabelText("แบรนด์") as HTMLSelectElement).value).toBe("b2");
    fireEvent.click(screen.getByRole("tab", { name: "สต็อกนับใหม่" }));
    expect((screen.getByLabelText("แบรนด์") as HTMLSelectElement).value).toBe("b2");
    expect(screen.getByText("ไม่พบรุ่นที่ตรงกับตัวกรอง")).toBeTruthy();
  });

  it("เดือนที่ไม่มีการนับ: บอกว่ายังไม่มีการนับ พร้อมลิงก์ไปหน้านับสต็อก", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    expect(screen.getByText("ช่วงนี้ยังไม่มีการนับสต็อก")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ไปหน้านับสต็อก" }).getAttribute("href")).toBe("/stock-count");
  });
  it("แท็บสต็อกนับใหม่: Excel ทุกเดือนย้อนหลัง ได้หนึ่งชีตต่อเดือนที่เคยนับ ตั้งแต่เดือนที่นับครั้งแรก", () => {
    const download = vi.mocked(excel.downloadWorkbook);
    download.mockClear();
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    fireEvent.click(screen.getByRole("button", { name: /Excel ทุกเดือนย้อนหลัง/ }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe("นับสต็อก-ทุกเดือน.xlsx");
    const now = new Date();
    expect(download.mock.calls[0][1].map((s) => s.name)).toEqual([`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`]);
    expect(download.mock.calls[0][1][0].rows.flat()).toContain("Billie Slim");
  });

  it("แท็บสต็อกนับใหม่: มีคำอธิบายวิธีอ่านตาราง และหัวคอลัมน์สื่อความหมาย", () => {
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    expect(screen.getByText("อ่านตารางนี้ยังไง")).toBeTruthy();
    const header = within(screen.getAllByRole("table")[0]).getAllByRole("row")[0].textContent ?? "";
    for (const h of ["นับได้จริง", "ระบบเดิม", "ต่าง", "สต็อกตอนนี้"]) expect(header).toContain(h);
  });  it("แท็บสต็อกนับใหม่: ซ่อนการนับช่วงตั้งต้นระบบ (ก่อน 28 ต.ค. 2569) ไว้ก่อน ติ๊กเพื่อดูย้อนหลังได้", () => {
    const old = new Date("2026-10-12T10:00:00").toISOString();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      warehouses: { w1: { id: "w1", name: "คลัง", type: "main", active: true, createdAt: "" } },
      products: { p1: { id: "p1", sellingName: "Billie Slim", createdAt: "" } },
      variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "a", active: true } },
      variantStock: { "v1::w1": { itemId: "v1", warehouseId: "w1", qtyOnHand: 10, qtyReserved: 0 } },
      movements: {
        m1: { id: "m1", createdAt: old, refNo: "ADJ-1", itemType: "product", itemId: "v1", variantId: "v1", itemName: "x", sku: "a", movementType: "adjustment", qtyChange: -2, qtyBefore: 12, qtyAfter: 10, warehouseToId: "w1", reason: "นับสต็อก — Billie Slim", actorId: "u", actorName: "u" },
      },
    } as never);
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("ถึงวันที่"), { target: { value: "2026-10-31" } });
    expect(screen.getByText("ช่วงนี้ยังไม่มีการนับสต็อก")).toBeTruthy();
    expect(screen.queryByText("Billie Slim")).toBeNull();
    fireEvent.click(screen.getByLabelText(/รวมการนับช่วงตั้งต้นระบบ/));
    expect(screen.getByText("Billie Slim")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("นับได้จริง 10 ชิ้น");
  });

  it("แท็บสต็อกนับใหม่: เลือกเป็นช่วงวันที่ได้ และส่งออก Excel เป็นช่วงนั้น", () => {
    const download = vi.mocked(excel.downloadWorkbook);
    download.mockClear();
    window.history.replaceState(null, "", "/stock-overview?tab=recount");
    render(<StockOverviewPage />);
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: day } });
    fireEvent.change(screen.getByLabelText("ถึงวันที่"), { target: { value: day } });
    expect(screen.getByRole("status").textContent).toContain("วันที่");
    expect(screen.getByRole("status").textContent).toContain("นับได้จริง 10 ชิ้น");
    fireEvent.click(screen.getByRole("button", { name: /Excel ช่วงที่เลือก/ }));
    expect(download.mock.calls[0][0]).toBe(`นับสต็อก-${day}_${day}.xlsx`);
  });});
