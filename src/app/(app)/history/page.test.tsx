import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import HistoryPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { MovementType, StockMovement } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

let seq = 0;
function mv(name: string, movementType: MovementType, qtyChange: number, qtyBefore: number, reason?: string): StockMovement {
  seq += 1;
  return {
    id: `m${seq}`,
    createdAt: new Date(Date.now() - seq * 1000).toISOString(),
    refNo: `DOC-${seq}`,
    itemType: "product",
    itemId: `v${seq}`,
    itemName: name,
    sku: `SKU-${seq}`,
    movementType,
    qtyChange,
    qtyBefore,
    qtyAfter: qtyBefore + qtyChange,
    actorId: "u1",
    actorName: "นับ",
    reason,
  } as StockMovement;
}

function seed() {
  const list = [
    mv("รับเข้า-A", "stock_in", 10, 0),
    mv("ขายออก-B", "sale", -2, 10),
    mv("เบิกใช้-C", "internal_use", -1, 5),
    mv("ปรับขึ้น-D", "adjustment", 3, 1, "นับสต็อก — D"),
    mv("ปรับลง-E", "adjustment", -2, 4, "นับสต็อก — E"),
    mv("ยืนยันยอด-F", "adjustment", 0, 6, "นับสต็อก (ตรงกับระบบ) — F"),
  ];
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "นับ", email: "c@x.com", role: "admin", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
    currentUserId: "u1",
    movements: Object.fromEntries(list.map((m) => [m.id, m])),
  } as never);
}

const tabBtn = (label: RegExp) => screen.getByRole("button", { name: label });

describe("หน้าประวัติการเคลื่อนไหว: แยกแท็บ เข้า / ออก / นับสต็อก", () => {
  beforeEach(() => {
    cleanup();
    seq = 0;
    window.localStorage.clear();
    seed();
  });

  it("ค่าเริ่มต้น: แท็บทั้งหมด ซ่อนรายการยืนยันยอด (0 ชิ้น) และตัวเลขบนแท็บนับตามนั้น", () => {
    render(<HistoryPage />);
    expect(tabBtn(/ทั้งหมด \(5\)/)).toBeTruthy(); // 6 รายการ ซ่อนยืนยันยอด 1
    expect(tabBtn(/สินค้าเข้า \(1\)/)).toBeTruthy();
    expect(tabBtn(/สินค้าออก \(2\)/)).toBeTruthy();
    expect(tabBtn(/นับสต็อก\/ปรับยอด \(2\)/)).toBeTruthy();
    expect(screen.queryByText("ยืนยันยอด-F")).toBeNull();
  });

  it("แท็บสินค้าเข้า เห็นเฉพาะของเข้า พร้อมยอดรวม", () => {
    render(<HistoryPage />);
    fireEvent.click(tabBtn(/สินค้าเข้า/));
    expect(screen.getAllByText("รับเข้า-A").length).toBeGreaterThan(0);
    expect(screen.queryByText("ขายออก-B")).toBeNull();
    expect(screen.queryByText("ปรับขึ้น-D")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("รวมเข้า 10 ชิ้น จาก 1 รายการ");
  });

  it("แท็บสินค้าออก เห็นเฉพาะของออก และเหตุผลที่ออกเลือกกรองได้", () => {
    render(<HistoryPage />);
    fireEvent.click(tabBtn(/สินค้าออก/));
    expect(screen.getAllByText("ขายออก-B").length).toBeGreaterThan(0);
    expect(screen.getAllByText("เบิกใช้-C").length).toBeGreaterThan(0);
    expect(screen.queryByText("รับเข้า-A")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("รวมออก 3 ชิ้น จาก 2 รายการ");
    fireEvent.change(screen.getByLabelText("ประเภทการเคลื่อนไหว"), { target: { value: "sale" } });
    expect(screen.queryByText("เบิกใช้-C")).toBeNull();
    // ตัวเลือกในแท็บนี้มีเฉพาะประเภทที่เป็นของออก
    const options = within(screen.getByLabelText("ประเภทการเคลื่อนไหว")).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("รับสินค้าเข้า");
  });

  it("แท็บนับสต็อก/ปรับยอด: แสดงก่อน → หลัง และเหตุผล สรุปปรับขึ้น/ลง และเปิดดูรายการยืนยันยอดได้", () => {
    render(<HistoryPage />);
    fireEvent.click(tabBtn(/นับสต็อก\/ปรับยอด/));
    expect(screen.getAllByText("ปรับขึ้น-D").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 → 4").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/นับสต็อก — D/).length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toContain("ปรับขึ้น +3 · ปรับลง -2");
    expect(screen.getByRole("status").textContent).toContain("นับแล้วตรงกับระบบ 1 รายการ");
    expect(screen.queryByText("ยืนยันยอด-F")).toBeNull();
    fireEvent.click(screen.getByLabelText(/แสดงรายการยืนยันยอด/));
    expect(screen.getAllByText("ยืนยันยอด-F").length).toBeGreaterThan(0);
  });

  it("เปลี่ยนแท็บแล้วตัวกรองประเภทกลับเป็นทั้งหมด ไม่ค้างค่าของแท็บเก่า", () => {
    render(<HistoryPage />);
    fireEvent.click(tabBtn(/สินค้าออก/));
    fireEvent.change(screen.getByLabelText("ประเภทการเคลื่อนไหว"), { target: { value: "sale" } });
    fireEvent.click(tabBtn(/สินค้าเข้า/));
    expect(screen.getAllByText("รับเข้า-A").length).toBeGreaterThan(0);
  });
});
