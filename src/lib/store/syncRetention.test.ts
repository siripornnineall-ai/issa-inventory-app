import { describe, it, expect, vi, beforeEach } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import * as engine from "./engine";

type Mode = "ok" | "fail" | "dup-pk" | "dup-docno";
type Call = { table: string; op: string };

const fake = vi.hoisted(() => {
  const ctl = { mode: "ok" as "ok" | "fail" | "dup-pk" | "dup-docno", calls: [] as { table: string; op: string }[] };
  function result(table: string, op: string) {
    const okRes = { data: null, error: null, status: 200, statusText: "OK", count: null };
    if (ctl.mode === "fail") return { data: null, error: { message: "TypeError: Failed to fetch", code: "", details: "", hint: "", name: "PostgrestError" }, status: 0, statusText: "", count: null };
    if (ctl.mode === "dup-pk" && op === "insert") {
      return { data: null, error: { message: `duplicate key value violates unique constraint "${table}_pkey"`, code: "23505", details: "Key (id)=(x) already exists.", hint: "", name: "PostgrestError" }, status: 409, statusText: "", count: null };
    }
    if (ctl.mode === "dup-docno" && table === "stock_in_docs" && op === "insert") {
      return { data: null, error: { message: 'duplicate key value violates unique constraint "stock_in_docs_doc_no_key"', code: "23505", details: "Key (doc_no)=(SIN-1) already exists.", hint: "", name: "PostgrestError" }, status: 409, statusText: "", count: null };
    }
    return okRes;
  }
  const supabase = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from(table: string) {
      const make = (op: string) => () => {
        ctl.calls.push({ table, op });
        const chain: Record<string, unknown> = {
          eq: () => chain,
          select: () => chain,
          then: (resolve: (r: unknown) => unknown) => Promise.resolve(resolve(result(table, op))),
        };
        return chain;
      };
      return { insert: make("insert"), update: make("update"), upsert: make("upsert"), delete: make("delete") };
    },
  };
  return { ctl, supabase };
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => fake.supabase }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

const DATE = new Date().toISOString();

async function load() {
  const { SYNC_RETRY_DELAYS_MS } = await import("@/lib/supabase/sync");
  SYNC_RETRY_DELAYS_MS.splice(0); // ไม่รอระหว่างลองซ้ำในเทสต์
  const store = await import("./index");
  const status = await import("./syncStatus");
  const refresh = await import("./refresh");
  return { store, status, refresh };
}

function seed(store: Awaited<ReturnType<typeof load>>["store"], userId = "u1") {
  const ids = { wh: "", variant: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    const p = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1000, category: "กางเกง", status: "active", images: [] });
    ids.variant = engine.addVariant(d, p, { color: "ขาว", size: "M", purchasePrice: 400, sellingPrice: 1000 });
  });
  store.useStore.getState().actions.hydrate({
    ...state,
    users: { [userId]: { id: userId, name: "แอดมิน", email: "a@x.com", role: "admin", active: true, createdAt: DATE } },
    currentUserId: userId,
  } as never);
  return ids;
}

const receive = (store: Awaited<ReturnType<typeof load>>["store"], ids: { wh: string; variant: string }) =>
  store.useStore.getState().actions.stockIn({ itemType: "product", date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.variant, qty: 3 }] });

function setMode(m: Mode) {
  fake.ctl.mode = m;
}

describe("รายการที่บันทึกลงฐานข้อมูลไม่สำเร็จ ต้องไม่หาย", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    fake.ctl.calls.length = 0;
    setMode("ok");
  });

  it("ส่งไม่สำเร็จ → เก็บไว้ ขึ้นสถานะค้าง กันรีเฟรชมาทับ และเก็บลงเครื่อง", async () => {
    const { store, status, refresh } = await load();
    const ids = seed(store);
    setMode("fail");
    receive(store, ids);
    await store.whenSyncIdle();

    expect(status.failedSyncCount()).toBe(1);
    expect(store.pendingSyncCount()).toBe(1);
    expect(status.getSyncSnapshot()).toMatchObject({ failed: 1, retrying: false });
    expect(status.getSyncSnapshot().lastError).toMatch(/ไม่สำเร็จ/);
    expect(await refresh.refreshAppData()).toBe("busy"); // ไม่ดึงข้อมูลจากฐานข้อมูลมาทับของที่ยังไม่เข้า
    const stored = JSON.parse(window.localStorage.getItem("issa-unsent-syncs") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0].next.stockInDocs)).toHaveLength(1); // เก็บเฉพาะส่วนที่เปลี่ยน
    expect(Object.keys(stored[0].next.products)).toHaveLength(0);
  });

  it("เน็ตกลับมา ส่งซ้ำสำเร็จ → รายการที่ค้างหมด และเขียนใบกับประวัติครบ", async () => {
    const { store, status } = await load();
    const ids = seed(store);
    setMode("fail");
    receive(store, ids);
    await store.whenSyncIdle();
    fake.ctl.calls.length = 0;

    setMode("ok");
    expect(await store.retryFailedSyncs()).toBe(0);
    expect(status.failedSyncCount()).toBe(0);
    expect(window.localStorage.getItem("issa-unsent-syncs")).toBeNull();
    const tables = fake.ctl.calls.filter((c: Call) => c.op === "insert").map((c: Call) => c.table);
    expect(tables).toContain("stock_in_docs");
    expect(tables).toContain("stock_in_lines");
    expect(tables).toContain("stock_movements");
  });

  it("ส่งซ้ำแล้วชนระเบียนที่ถูกบันทึกไปแล้วบางส่วน (คีย์ id ซ้ำ) นับว่าสำเร็จ ไม่เกิดรายการซ้ำ", async () => {
    const { store, status } = await load();
    const ids = seed(store);
    setMode("fail");
    receive(store, ids);
    await store.whenSyncIdle();

    setMode("dup-pk");
    expect(await store.retryFailedSyncs()).toBe(0);
    expect(status.failedSyncCount()).toBe(0);
  });

  it("ชนที่เลขเอกสาร (doc_no ซ้ำ) ไม่ใช่รายการที่บันทึกไปแล้ว ยังเป็นข้อผิดพลาด ไม่ถูกกลบ", async () => {
    const { store, status } = await load();
    const ids = seed(store);
    setMode("fail");
    receive(store, ids);
    await store.whenSyncIdle();

    setMode("dup-docno");
    expect(await store.retryFailedSyncs()).toBe(1);
    expect(status.failedSyncCount()).toBe(1);
    expect(status.getFailedSyncs()[0].attempts).toBe(2);
    expect(status.getSyncSnapshot().lastError).toMatch(/ไม่สำเร็จ/);
  });

  it("ปิดแอปแล้วเปิดใหม่: โหลดรายการที่ค้างจากเครื่อง ส่งต่อให้เอง", async () => {
    {
      const { store } = await load();
      const ids = seed(store);
      setMode("fail");
      receive(store, ids);
      await store.whenSyncIdle();
    }
    // จำลองเปิดแอปใหม่: โมดูลเริ่มใหม่ แต่ localStorage ยังอยู่
    vi.resetModules();
    const { store, status } = await load();
    seed(store);
    expect(status.failedSyncCount()).toBe(0);
    setMode("ok");
    fake.ctl.calls.length = 0;
    expect(store.restoreUnsentSyncs()).toBe(1);
    await store.whenSyncIdle();
    expect(status.failedSyncCount()).toBe(0);
    expect(fake.ctl.calls.some((c: Call) => c.table === "stock_in_docs" && c.op === "insert")).toBe(true);
  });

  it("รายการที่ค้างของบัญชีอื่นบนเครื่องเดียวกัน ไม่ส่งด้วยบัญชีนี้ และไม่ถูกลบ", async () => {
    {
      const { store } = await load();
      const ids = seed(store, "u1");
      setMode("fail");
      receive(store, ids);
      await store.whenSyncIdle();
    }
    vi.resetModules();
    const { store, status } = await load();
    seed(store, "u2");
    setMode("ok");
    fake.ctl.calls.length = 0;
    expect(store.restoreUnsentSyncs()).toBe(0);
    expect(status.failedSyncCount()).toBe(0);
    expect(fake.ctl.calls).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem("issa-unsent-syncs") ?? "[]")).toHaveLength(1);
  });

  it("ทิ้งรายการที่ค้างได้ (เมื่อส่งไม่ได้จริง ๆ)", async () => {
    const { store, status } = await load();
    const ids = seed(store);
    setMode("fail");
    receive(store, ids);
    await store.whenSyncIdle();
    store.discardFailedSyncs();
    expect(status.failedSyncCount()).toBe(0);
    expect(window.localStorage.getItem("issa-unsent-syncs")).toBeNull();
  });
});
