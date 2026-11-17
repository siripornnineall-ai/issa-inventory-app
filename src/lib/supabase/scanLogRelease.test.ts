import { describe, it, expect, vi, beforeEach } from "vitest";
import { emptyState } from "@/lib/store/state";
import { useStore } from "@/lib/store";

type Call = { table: string; op: string; payload?: unknown; filters: [string, ...unknown[]][] };
const calls: Call[] = [];
let logRows: { token_id: string | null }[] = [];
let updatedRows: { id: string }[] = [];
let failLogRead = false;
let throwOnClient = false;

vi.mock("./client", () => ({
  createClient: () => {
    if (throwOnClient) throw new Error("no env");
    return {
      from(table: string) {
        const entry: Call = { table, op: "", filters: [] };
        const chain: Record<string, unknown> = {};
        for (const f of ["eq", "in", "lte"]) chain[f] = (...a: unknown[]) => ((entry.filters.push([f, ...a]), chain));
        chain.select = (cols?: string) => {
          if (!entry.op) entry.op = "select";
          else entry.filters.push(["returning", cols]);
          return chain;
        };
        chain.update = (p: unknown) => ((entry.op = "update"), (entry.payload = p), chain);
        chain.then = (resolve: (r: unknown) => unknown) => {
          calls.push(entry);
          if (table === "scan_log") return Promise.resolve(resolve(failLogRead ? { data: null, error: { message: "denied" } } : { data: logRows, error: null }));
          return Promise.resolve(resolve({ data: updatedRows, error: null }));
        };
        return chain;
      },
    };
  },
}));

import { releaseScannedTokens } from "./scanLog";

const iso = "2026-11-17T03:05:00.000Z";

describe("ยกเลิกออเดอร์: ล้างสถานะป้ายที่สแกนออกไว้", () => {
  beforeEach(() => {
    calls.length = 0;
    logRows = [];
    updatedRows = [];
    failLogRead = false;
    throwOnClient = false;
    useStore.getState().actions.hydrate({
      ...emptyState(),
      unitTokens: {
        t1: { id: "t1", variantId: "v1", lastAction: "out", lastActionAt: iso, createdAt: iso },
        t2: { id: "t2", variantId: "v2", lastAction: "out", lastActionAt: iso, createdAt: iso },
      },
    } as never);
  });

  it("หาป้ายจากสมุดสแกนของใบเบิกนั้น แล้วล้างเฉพาะป้ายที่ยัง 'ออก' และไม่ถูกสแกนต่อหลังใบนั้น", async () => {
    logRows = [{ token_id: "t1" }, { token_id: "t1" }, { token_id: "t2" }, { token_id: null }];
    updatedRows = [{ id: "t1" }, { id: "t2" }];
    const n = await releaseScannedTokens({ docNo: "SOUT-1", notAfterIso: "2026-11-17T03:15:00.000Z" });
    expect(n).toBe(2);
    const read = calls.find((c) => c.table === "scan_log")!;
    expect(read.filters).toContainEqual(["eq", "saved_doc_no", "SOUT-1"]);
    expect(read.filters).toContainEqual(["eq", "action", "out"]);
    expect(read.filters).toContainEqual(["eq", "outcome", "ok"]);
    const upd = calls.find((c) => c.table === "unit_tokens")!;
    expect(upd.payload).toEqual({ last_action: null, last_action_at: null });
    expect(upd.filters).toContainEqual(["in", "id", ["t1", "t2"]]); // ไม่ซ้ำ ไม่มีค่าว่าง
    expect(upd.filters).toContainEqual(["eq", "last_action", "out"]);
    expect(upd.filters).toContainEqual(["lte", "last_action_at", "2026-11-17T03:15:00.000Z"]);
    // state ในเครื่องถูกล้างด้วย
    expect(useStore.getState().unitTokens.t1.lastAction).toBeUndefined();
    expect(useStore.getState().unitTokens.t2.lastActionAt).toBeUndefined();
  });

  it("ป้ายที่ฐานข้อมูลไม่ได้ล้างให้ (ถูกสแกนต่อไปแล้ว) ไม่ถูกแตะใน state ในเครื่อง", async () => {
    logRows = [{ token_id: "t1" }, { token_id: "t2" }];
    updatedRows = [{ id: "t1" }];
    expect(await releaseScannedTokens({ docNo: "SOUT-1", notAfterIso: iso })).toBe(1);
    expect(useStore.getState().unitTokens.t1.lastAction).toBeUndefined();
    expect(useStore.getState().unitTokens.t2.lastAction).toBe("out");
  });

  it("ไม่มีเลขที่ใบ / ไม่มีประวัติสแกน / อ่านสมุดสแกนไม่ได้ / สร้างตัวเชื่อมไม่ได้ → คืน 0 ไม่ throw ไม่แตะป้าย", async () => {
    expect(await releaseScannedTokens({ docNo: undefined, notAfterIso: iso })).toBe(0);
    expect(calls).toHaveLength(0);
    logRows = [];
    expect(await releaseScannedTokens({ docNo: "SOUT-1", notAfterIso: iso })).toBe(0);
    expect(calls.some((c) => c.table === "unit_tokens")).toBe(false);
    failLogRead = true;
    expect(await releaseScannedTokens({ docNo: "SOUT-1", notAfterIso: iso })).toBe(0);
    throwOnClient = true;
    expect(await releaseScannedTokens({ docNo: "SOUT-1", notAfterIso: iso })).toBe(0);
    expect(useStore.getState().unitTokens.t1.lastAction).toBe("out");
  });
});
