import { describe, it, expect, vi, beforeEach } from "vitest";
import { emptyState } from "@/lib/store/state";
import { useStore } from "@/lib/store";

const calls: { table: string; op: string; payload?: unknown; filters: [string, ...unknown[]][] }[] = [];
let failInsert = false;

vi.mock("./client", () => ({
  createClient: () => ({
    from(table: string) {
      const rec = (op: string, payload?: unknown) => {
        const entry = { table, op, payload, filters: [] as [string, ...unknown[]][] };
        calls.push(entry);
        const chain: Record<string, unknown> = {};
        for (const f of ["in", "eq", "is", "gte"]) chain[f] = (...a: unknown[]) => ((entry.filters.push([f, ...a]), chain));
        chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve(resolve({ error: failInsert ? { message: "boom" } : null }));
        return chain;
      };
      return { insert: (p: unknown) => rec("insert", p), update: (p: unknown) => rec("update", p) };
    },
  }),
}));

import { logTokenScan, markScansSaved } from "./scanLog";

const iso = "2026-11-12T00:00:00.000Z";

describe("สมุดบันทึกการสแกน", () => {
  beforeEach(() => {
    calls.length = 0;
    failInsert = false;
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "นัท", email: "a@x.com", role: "sales", active: true, createdAt: iso } },
      currentUserId: "u1",
    } as never);
  });

  it("ยิงแล้วบันทึกทันที: ใคร ป้ายอะไร รุ่นไหน หน้าไหน ผลอะไร", () => {
    logTokenScan({ token: { id: "t1", code: "ABC12345" }, variantId: "v1", action: "out", page: "stock_out", outcome: "ok" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "scan_log", op: "insert" });
    expect(calls[0].payload).toMatchObject({ token_id: "t1", token_code: "ABC12345", variant_id: "v1", action: "out", page: "stock_out", outcome: "ok", actor_id: "u1", actor_name: "นัท", reason: null });
  });

  it("ถูกปฏิเสธ/ซ้ำ บันทึกพร้อมเหตุผล", () => {
    logTokenScan({ token: { id: "t2" }, action: "in", page: "stock_in", outcome: "rejected", reason: "ป้ายนี้เข้าแล้ว" });
    expect(calls[0].payload).toMatchObject({ outcome: "rejected", reason: "ป้ายนี้เข้าแล้ว", token_code: null, variant_id: null });
  });

  it("กดบันทึกใบสำเร็จ: เติมเลขที่ใบให้การสแกนของป้ายเหล่านี้ที่ผู้ใช้ยิงไว้และยังว่างเท่านั้น", () => {
    markScansSaved(["t1", "t2"], "SOUT-20261112-0001", "out");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ op: "update", payload: { saved_doc_no: "SOUT-20261112-0001" } });
    const f = Object.fromEntries(calls[0].filters.map((x) => [x[0], x.slice(1)]));
    expect(f.in).toEqual(["token_id", ["t1", "t2"]]);
    expect(calls[0].filters).toContainEqual(["eq", "actor_id", "u1"]);
    expect(calls[0].filters).toContainEqual(["eq", "action", "out"]);
    expect(calls[0].filters).toContainEqual(["eq", "outcome", "ok"]);
    expect(calls[0].filters).toContainEqual(["is", "saved_doc_no", null]);
  });

  it("ไม่มีป้ายให้เติม = ไม่ส่งคำสั่ง", () => {
    markScansSaved([], "SIN-1", "in");
    expect(calls).toHaveLength(0);
  });

  it("ส่งไม่สำเร็จหรือไม่มีผู้ใช้ ต้องไม่ขว้างข้อผิดพลาด (ไม่ขวางการสแกน)", async () => {
    failInsert = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => logTokenScan({ token: { id: "t3" }, action: "in", page: "stock_in", outcome: "ok" })).not.toThrow();
    await Promise.resolve();
    useStore.getState().actions.logout();
    expect(() => logTokenScan({ token: { id: "t4" }, action: "in", page: "stock_in", outcome: "ok" })).not.toThrow();
    expect(() => markScansSaved(["t4"], "SIN-2", "in")).not.toThrow();
    expect(calls).toHaveLength(1); // ไม่มีผู้ใช้ = ไม่ส่ง
    warn.mockRestore();
  });
});
