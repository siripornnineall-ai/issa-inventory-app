import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { productionPlan } from "./productionPlan";

function seed() {
  const ids = { product: "", variant: "" };
  const state = produce(emptyState(), (d) => {
    const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    ids.product = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1000, category: "กางเกง", status: "active", images: [] } as never);
    ids.variant = engine.addVariant(d, ids.product, { color: "ดำ", size: "M", purchasePrice: 400, sellingPrice: 1000 });
    engine.stockIn(d, { itemType: "product", date: "2026-11-10T00:00:00.000Z", warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.variant, qty: 30 }] });
  });
  return { state, ...ids };
}

describe("productionPlan includeWip", () => {
  it("นับรอเย็บ (ค่าตั้งต้น) = ของที่มีคือคลัง + รอเย็บ / ไม่นับ = คลังอย่างเดียว ที่ต้องผลิตจึงมากขึ้น", () => {
    const { state, product, variant } = seed();
    const withWip = produce(state, (d) => {
      engine.recordFactoryWip(d, { date: "2026-11-10T00:00:00.000Z", actorId: "u1", actorName: "คุณ", kind: "cut_in", lines: [{ variantId: variant, qty: 20 }] });
    });
    const base = [{ productId: product, color: "ดำ", size: "M", qty: 100 }];
    const on = productionPlan(withWip, base, { months: 1 });
    const def = productionPlan(withWip, base, { months: 1, includeWip: true });
    const off = productionPlan(withWip, base, { months: 1, includeWip: false });
    expect(on[0].totals).toMatchObject({ stock: 30, wip: 20, have: 50, need: 50 });
    expect(def[0].totals.need).toBe(50);
    expect(off[0].totals).toMatchObject({ stock: 30, wip: 0, have: 30, need: 70 });
  });
});
