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
    mv("คืน-G", "return_customer", 2, 3, "สินค้าคืน · Shopee"),
    mv("ตำหนิ-H", "return_defective", 1, 0, "สินค้าตำหนิ"),
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
    expect(tabBtn(/ทั้งหมด \(7\)/)).toBeTruthy(); // 8 รายการ ซ่อนยืนยันยอด 1
    expect(tabBtn(/สินค้าคืน \(2\)/)).toBeTruthy();
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

  it("แท็บสินค้าคืน: เห็นเฉพาะของคืน แยกตามประเภท พร้อมช่องทาง และไม่ปนในแท็บสินค้าเข้า", () => {
    render(<HistoryPage />);
    fireEvent.click(tabBtn(/สินค้าเข้า/));
    expect(screen.queryByText("คืน-G")).toBeNull();
    expect(screen.queryByText("ตำหนิ-H")).toBeNull();

    fireEvent.click(tabBtn(/สินค้าคืน/));
    expect(screen.getAllByText("คืน-G").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ตำหนิ-H").length).toBeGreaterThan(0);
    expect(screen.queryByText("รับเข้า-A")).toBeNull();
    expect(screen.getAllByText("Shopee").length).toBeGreaterThan(0);
    const summary = screen.getByRole("status").textContent ?? "";
    expect(summary).toContain("รวมรับคืน 3 ชิ้น จาก 2 รายการ");
    expect(summary).toContain("สินค้าคืน 2");
    expect(summary).toContain("สินค้าตำหนิ 1");
    expect(summary).toContain("สินค้าตีกลับ 0");
  });

  it("เปลี่ยนแท็บแล้วตัวกรองประเภทกลับเป็นทั้งหมด ไม่ค้างค่าของแท็บเก่า", () => {
    render(<HistoryPage />);
    fireEvent.click(tabBtn(/สินค้าออก/));
    fireEvent.change(screen.getByLabelText("ประเภทการเคลื่อนไหว"), { target: { value: "sale" } });
    fireEvent.click(tabBtn(/สินค้าเข้า/));
    expect(screen.getAllByText("รับเข้า-A").length).toBeGreaterThan(0);
  });

  it("ตัวกรองผู้ทำรายการ: เลือกชื่อแล้วเห็นเฉพาะรายการของคนนั้น และรายชื่อมีทุกคนที่เคยทำรายการ", () => {
    const a = { ...mv("ของนัท-1", "stock_in", 5, 0), actorId: "u1", actorName: "นัท" } as StockMovement;
    const b = { ...mv("ของนัท-2", "sale", -1, 5), actorId: "u1", actorName: "นัท" } as StockMovement;
    const c = { ...mv("ของน้ำ-1", "stock_in", 7, 0), actorId: "u2", actorName: "น้ำ" } as StockMovement;
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: {
        u1: { id: "u1", name: "นัท", email: "n@x.com", role: "admin", active: true, createdAt: "2026-10-05T00:00:00.000Z" },
        u2: { id: "u2", name: "น้ำ", email: "w@x.com", role: "warehouse", active: true, createdAt: "2026-10-05T00:00:00.000Z" },
      },
      currentUserId: "u1",
      movements: Object.fromEntries([a, b, c].map((m) => [m.id, m])),
    } as never);
    render(<HistoryPage />);
    const select = screen.getByLabelText("ผู้ทำรายการ") as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["ทุกคน (ผู้ทำรายการ)", "นัท", "น้ำ"]);
    expect(screen.getAllByText("ของนัท-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ของน้ำ-1").length).toBeGreaterThan(0);

    fireEvent.change(select, { target: { value: "u2" } });
    expect(screen.queryByText("ของนัท-1")).toBeNull();
    expect(screen.queryByText("ของนัท-2")).toBeNull();
    expect(screen.getAllByText("ของน้ำ-1").length).toBeGreaterThan(0);
    // แท็บและยอดสรุปตามตัวกรองด้วย
    fireEvent.click(tabBtn(/สินค้าออก/));
    expect(screen.getByRole("status").textContent).toContain("รวมออก 0 ชิ้น จาก 0 รายการ");
  });

  it("ใบที่ถูกยกเลิกเพราะลงผิดยังแสดงในประวัติครบ พร้อมข้อความกำกับ (ประวัติต้องครบเสมอ แม้ตัวเลขสรุปจะข้ามใบนั้น)", () => {
    const fake = { ...mv("ขายหลอก-X", "sale", -5, 5), refNo: "SOUT-FAKE-1" } as StockMovement;
    const real = { ...mv("ขายจริง-Y", "sale", -1, 5), refNo: "SOUT-REAL-1" } as StockMovement;
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "นับ", email: "c@x.com", role: "admin", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
      currentUserId: "u1",
      movements: { [fake.id]: fake, [real.id]: real },
      orders: {
        o1: { id: "o1", orderNo: "ORD-1", date: new Date().toISOString(), channel: "shopee", warehouseId: "w1", lines: [], status: "cancelled", restocked: false, stockOutDocNo: "SOUT-FAKE-1", createdAt: new Date().toISOString() },
      },
    } as never);
    render(<HistoryPage />);
    expect(screen.getAllByText("ขายหลอก-X").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ขายจริง-Y").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ใบนี้ถูกยกเลิก").length).toBeGreaterThan(0);
  });
});
