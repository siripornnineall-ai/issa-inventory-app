import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { ScanLogTab, scanStatus } from "./ScanLogTab";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const iso = new Date().toISOString();
const old = new Date(Date.now() - 3 * 3600_000).toISOString();

const ROWS = [
  { id: "s1", scanned_at: iso, token_code: "AAAA1111", variant_id: "v1", action: "out", page: "stock_out", outcome: "ok", reason: null, actor_id: "u1", actor_name: "นัท", saved_doc_no: "SOUT-20261112-0001" },
  { id: "s2", scanned_at: old, token_code: "BBBB2222", variant_id: "v1", action: "out", page: "stock_out", outcome: "ok", reason: null, actor_id: "u1", actor_name: "นัท", saved_doc_no: null },
  { id: "s3", scanned_at: iso, token_code: "CCCC3333", variant_id: "v1", action: "in", page: "stock_in", outcome: "rejected", reason: "ป้ายนี้เข้าแล้ว", actor_id: "u1", actor_name: "นัท", saved_doc_no: null },
];

const queries: string[] = [];

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from() {
      const log: string[] = [];
      const chain: Record<string, unknown> = {};
      for (const f of ["gte", "lte", "eq", "neq", "is", "not", "lt", "ilike", "or", "order", "range"]) chain[f] = (...a: unknown[]) => (log.push(`${f}:${a.join(",")}`), chain);
      chain.select = (_cols: string, opts?: { head?: boolean }) => {
        log.push(opts?.head ? "count" : "list");
        return chain;
      };
      chain.then = (resolve: (r: unknown) => unknown) => {
        queries.push(log.join("|"));
        const isCount = log.includes("count");
        return Promise.resolve(resolve(isCount ? { count: 3, error: null } : { data: ROWS, error: null }));
      };
      return chain;
    },
  }),
}));

describe("ประวัติการสแกน (แท็บในหน้าประวัติการเคลื่อนไหว)", () => {
  beforeEach(() => {
    cleanup();
    queries.length = 0;
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "นัท", email: "a@x.com", role: "admin", active: true, createdAt: iso } },
      currentUserId: "u1",
      products: { p1: { id: "p1", sellingName: "Billie Wide", status: "active", images: [] } },
      variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "XL", sku: "A", active: true, purchasePrice: 0, sellingPrice: 1 } },
    } as never);
  });

  it("ค่าเริ่มต้นดึงเฉพาะที่มีปัญหา (ถูกปฏิเสธ/ซ้ำ หรือผ่านแล้วไม่มีเลขที่ใบเกิน 30 นาที) ไม่ดึงที่บันทึกแล้ว", async () => {
    render(<ScanLogTab range={{ from: new Date(Date.now() - 86400_000).toISOString(), to: new Date(Date.now() + 86400_000).toISOString() }} />);
    await waitFor(() => expect(queries.some((q) => q.includes("list"))).toBe(true));
    const list = queries.find((q) => q.includes("list"))!;
    expect(list).toContain("or:outcome.neq.ok,and(outcome.eq.ok,saved_doc_no.is.null,scanned_at.lt.");
    expect(screen.queryByRole("option", { name: "บันทึกลงใบแล้ว" })).toBeNull();
    expect(screen.getByRole("option", { name: "ที่มีปัญหาทั้งหมด" })).toBeTruthy();
  });

  it("แสดงใคร ยิงอะไร เมื่อไร ผลอะไร และสถานะ (บันทึกแล้ว / ยังไม่ได้บันทึก / ถูกปฏิเสธ) ตามแถวที่ฐานข้อมูลส่งมา", async () => {
    render(<ScanLogTab range={{ from: new Date(Date.now() - 86400_000).toISOString(), to: new Date(Date.now() + 86400_000).toISOString() }} />);
    await waitFor(() => expect(screen.getAllByText(/Billie Wide ดำ \/ XL/).length).toBe(3));
    expect(screen.getByText("บันทึกแล้ว")).toBeTruthy();
    expect(screen.getByText("SOUT-20261112-0001")).toBeTruthy();
    expect(screen.getAllByText("ยังไม่ได้บันทึก").length).toBeGreaterThan(0);
    expect(screen.getByText("ถูกปฏิเสธ")).toBeTruthy();
    expect(screen.getByText(/ป้ายนี้เข้าแล้ว/)).toBeTruthy();
    expect(screen.getAllByText(/นัท/).length).toBeGreaterThan(0);
  });

  it("ตัวกรอง 'ยังไม่ได้บันทึก' ส่งเงื่อนไขไปที่ฐานข้อมูล (ผ่านแล้ว ยังไม่มีเลขที่ใบ เกิน 30 นาที)", async () => {
    render(<ScanLogTab range={{ from: new Date(Date.now() - 86400_000).toISOString(), to: new Date(Date.now() + 86400_000).toISOString() }} />);
    await waitFor(() => expect(queries.length).toBeGreaterThan(0));
    queries.length = 0;
    fireEvent.change(screen.getByRole("combobox", { name: "สถานะ" }), { target: { value: "unsaved" } });
    await waitFor(() => expect(queries.some((q) => q.includes("list") && q.includes("eq:outcome,ok") && q.includes("is:saved_doc_no,") && q.includes("lt:scanned_at,"))).toBe(true));
  });

  it("scanStatus: ผ่านแล้วมีเลขที่ใบ = บันทึกแล้ว / ไม่มีและยังไม่เกิน 30 นาที = กำลังทำรายการ / เกิน = ยังไม่ได้บันทึก / ไม่ผ่าน = ปฏิเสธ", () => {
    const now = Date.now();
    expect(scanStatus({ outcome: "ok", saved_doc_no: "X", scanned_at: new Date(now - 9e7).toISOString() }, now)).toBe("saved");
    expect(scanStatus({ outcome: "ok", saved_doc_no: null, scanned_at: new Date(now - 5 * 60_000).toISOString() }, now)).toBe("pending");
    expect(scanStatus({ outcome: "ok", saved_doc_no: null, scanned_at: new Date(now - 31 * 60_000).toISOString() }, now)).toBe("unsaved");
    expect(scanStatus({ outcome: "duplicate", saved_doc_no: null, scanned_at: new Date(now).toISOString() }, now)).toBe("rejected");
  });
});
