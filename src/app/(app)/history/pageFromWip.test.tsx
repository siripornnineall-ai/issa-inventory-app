import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import HistoryPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { StockMovement } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

const now = Date.now();
function mv(id: string, name: string, refNo: string, itemId: string, ageSec: number): StockMovement {
  return {
    id,
    createdAt: new Date(now - ageSec * 1000).toISOString(),
    refNo,
    itemType: "product",
    itemId,
    itemName: name,
    sku: `SKU-${id}`,
    movementType: "stock_in",
    qtyChange: 5,
    qtyBefore: 0,
    qtyAfter: 5,
    actorId: "u1",
    actorName: "นับ",
  } as StockMovement;
}

function seed() {
  const list = [mv("m1", "จากโรงงาน-A", "SIN-1", "v1", 10), mv("m2", "รับเข้าปกติ-B", "SIN-2", "v2", 20)];
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "นับ", email: "c@x.com", role: "admin", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
    currentUserId: "u1",
    movements: Object.fromEntries(list.map((m) => [m.id, m])),
    stockInDocs: {
      d1: { id: "d1", docNo: "SIN-1", itemType: "product", status: "completed", lines: [{ id: "l1", itemId: "v1", qty: 5, fromWip: true }], createdAt: new Date(now).toISOString() },
      d2: { id: "d2", docNo: "SIN-2", itemType: "product", status: "completed", lines: [{ id: "l2", itemId: "v2", qty: 5 }], createdAt: new Date(now).toISOString() },
    },
  } as never);
}

describe("หน้าประวัติ: สต็อกเข้าที่เย็บเสร็จจากโรงงาน BC", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    seed();
  });

  it("มีตัวเลือกกรอง 'สต็อกเข้า — เย็บเสร็จจากโรงงาน BC' และกรองเหลือเฉพาะรายการที่รับแบบนั้น", () => {
    render(<HistoryPage />);
    expect(screen.getAllByText("จากโรงงาน-A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("รับเข้าปกติ-B").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("ประเภทการเคลื่อนไหว"), { target: { value: "from_wip" } });
    expect(screen.getAllByText("จากโรงงาน-A").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("รับเข้าปกติ-B")).toHaveLength(0);
  });

  it("รายการที่รับแบบเย็บเสร็จจากโรงงาน BC มีป้ายกำกับในคอลัมน์ประเภท ส่วนรับเข้าปกติไม่มี", () => {
    render(<HistoryPage />);
    // หน้านี้ render ทั้งมุมมองมือถือและเดสก์ท็อป ป้ายจึงมีเท่าจำนวนที่รายการ A ปรากฏ (รายการ B ไม่มีป้าย)
    expect(screen.getAllByText("เย็บเสร็จจากโรงงาน BC")).toHaveLength(screen.getAllByText("จากโรงงาน-A").length);
  });
});
