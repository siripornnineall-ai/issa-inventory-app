import { describe, it, expect } from "vitest";
import { buildStockMatrix, qtyByVariant } from "./stockMatrix";
import { emptyState } from "@/lib/store/state";
import type { ProductVariant } from "@/lib/types";

const v = (color: string, size: string, active = true): ProductVariant =>
  ({ id: `${color}-${size}`, productId: "p1", color, size, sku: `${color}-${size}`, purchasePrice: 0, sellingPrice: 0, reorderPoint: 0, active, isDefective: false }) as ProductVariant;

const qty = (obj: Record<string, number>) => new Map(Object.entries(obj));

describe("buildStockMatrix", () => {
  const variants = [v("ดำ", "S"), v("ดำ", "M"), v("ดำ", "L"), v("ครีม", "S"), v("ครีม", "M"), v("ชมพู", "S")];

  it("lays out colors as rows and sizes as columns with row, column and grand totals", () => {
    const m = buildStockMatrix(variants, qty({ "ดำ-S": 22, "ดำ-M": 113, "ดำ-L": 101, "ครีม-S": 39, "ครีม-M": 157 }));
    expect(m.sizes).toEqual(["S", "M", "L"]);
    const black = m.rows.find((r) => r.color === "ดำ")!;
    expect(black.cells).toEqual({ S: 22, M: 113, L: 101 });
    expect(black.total).toBe(236);
    expect(m.colTotals).toEqual({ S: 61, M: 270, L: 101 });
    expect(m.grandTotal).toBe(236 + 196);
  });

  it("tells apart a size that does not exist for a color (null) from one that is just out of stock (0)", () => {
    const m = buildStockMatrix(variants, qty({ "ดำ-S": 5 }));
    expect(m.rows.find((r) => r.color === "ครีม")!.cells.L).toBeNull();
    expect(m.rows.find((r) => r.color === "ครีม")!.cells.S).toBe(0);
  });

  it("puts colors with stock first, biggest first, and all-zero colors after in their original order", () => {
    const m = buildStockMatrix(variants, qty({ "ครีม-S": 10, "ดำ-S": 50 }));
    expect(m.rows.map((r) => r.color)).toEqual(["ดำ", "ครีม", "ชมพู"]);
    const m2 = buildStockMatrix([v("ก", "S"), v("ข", "S"), v("ค", "S")], qty({ "ค-S": 1 }));
    expect(m2.rows.map((r) => r.color)).toEqual(["ค", "ก", "ข"]);
  });

  it("hides colors that have no stock at all when asked, but keeps negative ones", () => {
    const m = buildStockMatrix(variants, qty({ "ดำ-S": 4, "ชมพู-S": -1 }), { hideEmpty: true });
    expect(m.rows.map((r) => r.color)).toEqual(["ดำ", "ชมพู"]);
  });

  it("counts negative cells and still includes them in the totals", () => {
    const m = buildStockMatrix(variants, qty({ "ดำ-S": 10, "ดำ-M": -7 }));
    expect(m.negativeCells).toBe(1);
    expect(m.rows.find((r) => r.color === "ดำ")!.total).toBe(3);
    expect(m.grandTotal).toBe(3);
  });

  it("sorts sizes by real garment size, not alphabetically, with unknown sizes last", () => {
    const m = buildStockMatrix([v("ดำ", "XL"), v("ดำ", "S"), v("ดำ", "10XL"), v("ดำ", "2XL"), v("ดำ", "M")], qty({}));
    expect(m.sizes).toEqual(["S", "M", "XL", "2XL", "10XL"]);
  });

  it("keeps a deactivated variant only while it still holds stock, so totals stay truthful", () => {
    const list = [v("ดำ", "S"), v("ดำ", "M", false), v("ดำ", "L", false)];
    const m = buildStockMatrix(list, qty({ "ดำ-M": 6 }));
    expect(m.sizes).toEqual(["S", "M"]);
    expect(m.grandTotal).toBe(6);
  });

  it("returns an empty matrix for a model with no usable variants", () => {
    const m = buildStockMatrix([], qty({}));
    expect(m.sizes).toEqual([]);
    expect(m.rows).toEqual([]);
    expect(m.grandTotal).toBe(0);
  });
});

describe("qtyByVariant", () => {
  const state = {
    ...emptyState(),
    variantStock: {
      "a::w1": { itemId: "a", warehouseId: "w1", qtyOnHand: 5, qtyReserved: 0 },
      "a::w2": { itemId: "a", warehouseId: "w2", qtyOnHand: 7, qtyReserved: 1 },
      "b::w1": { itemId: "b", warehouseId: "w1", qtyOnHand: 2, qtyReserved: 0 },
    },
  };

  it("sums every warehouse by default", () => {
    expect(qtyByVariant(state).get("a")).toBe(12);
    expect(qtyByVariant(state).get("b")).toBe(2);
  });

  it("limits to one warehouse when selected", () => {
    expect(qtyByVariant(state, "w2").get("a")).toBe(7);
    expect(qtyByVariant(state, "w2").get("b")).toBeUndefined();
  });
});
