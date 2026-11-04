import { describe, it, expect, vi, beforeEach } from "vitest";
import { produce } from "immer";
import { emptyState } from "./state";
import * as engine from "./engine";

const fake = vi.hoisted(() => {
  const ctl = { mode: "ok" as "ok" | "hang", calls: [] as { table: string; op: string }[] };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from(table: string) {
      const make = (op: string) => () => {
        ctl.calls.push({ table, op });
        const okRes = { data: null, error: null, status: 200, statusText: "OK", count: null };
        const chain: Record<string, unknown> = {
          eq: () => chain,
          select: () => chain,
          // hang = เน็ตค้าง คำขอไม่ตอบกลับ (จำลองหน้าที่ถูกปิดก่อนส่งเสร็จ)
          then: (resolve: (r: unknown) => unknown) => (ctl.mode === "hang" ? new Promise(() => {}) : Promise.resolve(resolve(okRes))),
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
const KEY = "issa-unsent-syncs";

async function load() {
  const { SYNC_RETRY_DELAYS_MS } = await import("@/lib/supabase/sync");
  SYNC_RETRY_DELAYS_MS.splice(0);
  const store = await import("./index");
  const status = await import("./syncStatus");
  return { store, status };
}

function seed(store: Awaited<ReturnType<typeof load>>["store"]) {
  const ids = { wh: "", product: "", variant: "" };
  const state = produce(emptyState(), (d) => {
    ids.wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    ids.product = engine.createProduct(d, { sellingName: "Blair Wide", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    ids.variant = engine.addVariant(d, ids.product, { color: "ดำ", size: "S", purchasePrice: 200, sellingPrice: 1090 });
  });
  store.useStore.getState().actions.hydrate({
    ...state,
    users: { u1: { id: "u1", name: "แอดมิน", email: "a@x.com", role: "admin", active: true, createdAt: DATE } },
    currentUserId: "u1",
  } as never);
  return ids;
}

const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as { next: { variants: Record<string, unknown>; stockInDocs: Record<string, unknown> } }[];

describe("เขียนลงเครื่องก่อนส่ง: ปิดหน้าก่อนส่งเสร็จ รายการไม่หาย", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    fake.ctl.calls.length = 0;
    fake.ctl.mode = "ok";
  });

  it("ระหว่างที่ยังส่งไม่เสร็จ รายการถูกจดลงเครื่องแล้ว (แต่ไม่นับเป็นส่งไม่สำเร็จ) ส่งเสร็จแล้วถูกลบ", async () => {
    const { store, status } = await load();
    const ids = seed(store);
    fake.ctl.mode = "hang";
    store.useStore.getState().actions.stockIn({ itemType: "product", date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.variant, qty: 3 }] });
    expect(stored()).toHaveLength(1);
    expect(Object.keys(stored()[0].next.stockInDocs)).toHaveLength(1);
    expect(status.failedSyncCount()).toBe(0); // ยังไม่ล้มเหลว ไม่ขึ้นแถบแดง
    expect(store.pendingSyncCount()).toBe(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(stored()).toHaveLength(1); // ส่งค้างอยู่กลางทาง ยังไม่ถูกลบ

    vi.resetModules();
    window.localStorage.clear();
    const fresh = await load();
    const ids2 = seed(fresh.store);
    fake.ctl.mode = "ok";
    fresh.store.useStore.getState().actions.stockIn({ itemType: "product", date: DATE, warehouseId: ids2.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids2.variant, qty: 1 }] });
    await fresh.store.whenSyncIdle();
    expect(window.localStorage.getItem(KEY)).toBeNull(); // ส่งสำเร็จแล้วไม่เหลือค้าง
  });

  it("หน้าถูกปิดระหว่างส่ง → เปิดแอปใหม่ ส่งต่อให้ครบตามเดิม", async () => {
    const first = await load();
    const ids = seed(first.store);
    fake.ctl.mode = "hang";
    first.store.useStore.getState().actions.stockIn({ itemType: "product", date: DATE, warehouseId: ids.wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.variant, qty: 3 }] });
    expect(stored()).toHaveLength(1);

    // รอให้คำขอที่ค้างเริ่มส่งแล้วจริง (ค้างอยู่กลางทาง) ก่อน "ปิดหน้า"
    await new Promise((r) => setTimeout(r, 20));
    // "ปิดหน้า": โมดูลทั้งหมดเริ่มใหม่ แต่ localStorage ของเครื่องยังอยู่
    vi.resetModules();
    fake.ctl.calls.length = 0;
    fake.ctl.mode = "ok";
    const second = await load();
    seed(second.store);
    expect(second.store.restoreUnsentSyncs()).toBe(1);
    expect(await second.store.retryFailedSyncs()).toBe(0);
    const inserts = fake.ctl.calls.filter((c) => c.op === "insert").map((c) => c.table);
    expect(inserts).toContain("stock_in_docs");
    expect(inserts).toContain("stock_movements");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("เพิ่มหลายสี/หลายไซซ์พร้อมกัน (addVariants) เป็นรายการเดียว ไม่แยกส่งทีละตัวเลือก", async () => {
    const { store } = await load();
    const ids = seed(store);
    fake.ctl.mode = "hang";
    const colors = ["ดำ", "ครีม", "กรม", "ขาว", "น้ำเงิน", "เขียวเข้ม", "โอวัลติน", "น้ำตาลไหม้", "เทาดิน"];
    const sizes = ["S", "M", "L", "XL", "2XL"];
    const inputs = colors.flatMap((color) => sizes.filter((size) => !(color === "ดำ" && size === "S")).map((size) => ({ color, size, purchasePrice: 200, sellingPrice: 1090 })));
    const idsAdded = store.useStore.getState().actions.addVariants(ids.product, inputs);
    expect(idsAdded).toHaveLength(inputs.length);
    expect(Object.keys(store.useStore.getState().variants)).toHaveLength(1 + inputs.length);
    expect(stored()).toHaveLength(1); // ทั้ง 44 ตัวเลือกอยู่ในรายการเดียวที่ถูกจดไว้
    expect(Object.keys(stored()[0].next.variants)).toHaveLength(inputs.length);
  });

  it("เพิ่มหลายตัวเลือกพร้อมกัน ถ้ามีตัวใดผิด (ซ้ำ) ไม่เพิ่มเลยสักตัว", async () => {
    const { store } = await load();
    const ids = seed(store);
    const before = Object.keys(store.useStore.getState().variants).length;
    expect(() =>
      store.useStore.getState().actions.addVariants(ids.product, [
        { color: "ครีม", size: "M", purchasePrice: 200, sellingPrice: 1090 },
        { color: "ดำ", size: "S", purchasePrice: 200, sellingPrice: 1090 }, // ซ้ำกับที่มีอยู่แล้ว
      ])
    ).toThrow();
    expect(Object.keys(store.useStore.getState().variants)).toHaveLength(before);
  });
});
