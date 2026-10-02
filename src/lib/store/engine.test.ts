import { describe, it, expect } from "vitest";
import { produce, type Draft } from "immer";
import * as engine from "./engine";
import { emptyState, type AppState } from "./state";
import { BusinessRuleError } from "./engine";

function run<T>(state: AppState, fn: (draft: Draft<AppState>) => T): { state: AppState; result: T } {
  let result!: T;
  const next = produce(state, (draft) => {
    result = fn(draft);
  });
  return { state: next, result };
}

function seedWarehouses(): AppState {
  return produce(emptyState(), (draft) => {
    engine.upsertWarehouse(draft, { id: "wh-a", name: "Warehouse A", type: "main", active: true });
    engine.upsertWarehouse(draft, { id: "wh-b", name: "Warehouse B", type: "store", active: true });
  });
}

function seedProductWithVariant(state: AppState) {
  const { state: s1, result: productId } = run(state, (draft) =>
    engine.createProduct(draft, {
      sellingName: "Test Shirt",
      sellingPrice: 500,
      category: "เสื้อ",
      status: "active",
      images: [],
    })
  );
  const { state: s2, result: variantId } = run(s1, (draft) =>
    engine.addVariant(draft, productId, { color: "ดำ", size: "M", purchasePrice: 200, sellingPrice: 500 })
  );
  return { state: s2, productId, variantId };
}

describe("product & variant rules", () => {
  it("throws when creating a product without a selling name", () => {
    const state = seedWarehouses();
    expect(() => run(state, (draft) => engine.createProduct(draft, { sellingName: "", sellingPrice: 100, category: "x", status: "active", images: [] }))).toThrow(
      BusinessRuleError
    );
  });

  it("initializes zero stock rows for every warehouse when a variant is added", () => {
    const state = seedWarehouses();
    const { state: next, variantId } = seedProductWithVariant(state);
    expect(engine.getStockLevel(next.variantStock, variantId, "wh-a").qtyOnHand).toBe(0);
    expect(engine.getStockLevel(next.variantStock, variantId, "wh-b").qtyOnHand).toBe(0);
  });

  it("rejects a duplicate color/size combination on the same product", () => {
    const state = seedWarehouses();
    const { state: next, productId } = seedProductWithVariant(state);
    expect(() =>
      run(next, (draft) => engine.addVariant(draft, productId, { color: "ดำ", size: "M", purchasePrice: 200, sellingPrice: 500 }))
    ).toThrow(BusinessRuleError);
  });

  it("rejects a duplicate SKU across products", () => {
    const state = seedWarehouses();
    const { state: next, productId, variantId } = seedProductWithVariant(state);
    const existingSku = next.variants[variantId].sku;
    expect(() =>
      run(next, (draft) => engine.addVariant(draft, productId, { color: "ขาว", size: "L", sku: existingSku, purchasePrice: 200, sellingPrice: 500 }))
    ).toThrow(BusinessRuleError);
  });

  it("rejects a duplicate model code within the same brand", () => {
    const state = seedWarehouses();
    const { state: next } = run(state, (draft) =>
      engine.createProduct(draft, { sellingName: "Billie Slim", sellingPrice: 500, category: "เสื้อ", status: "active", images: [], brandId: "brand-a", modelCode: "BS" })
    );
    expect(() =>
      run(next, (draft) =>
        engine.createProduct(draft, { sellingName: "Bruno Slim", sellingPrice: 500, category: "เสื้อ", status: "active", images: [], brandId: "brand-a", modelCode: "BS" })
      )
    ).toThrow(BusinessRuleError);
  });

  it("allows the same model code to be reused across different brands", () => {
    const state = seedWarehouses();
    const { state: next } = run(state, (draft) =>
      engine.createProduct(draft, { sellingName: "Billie Slim", sellingPrice: 500, category: "เสื้อ", status: "active", images: [], brandId: "brand-a", modelCode: "BS" })
    );
    expect(() =>
      run(next, (draft) =>
        engine.createProduct(draft, { sellingName: "Billie Slim", sellingPrice: 500, category: "เสื้อ", status: "active", images: [], brandId: "brand-b", modelCode: "BS" })
      )
    ).not.toThrow();
  });

  it("rejects renaming a product's model code to one already used in the same brand", () => {
    const state = seedWarehouses();
    const { state: s1, result: productId1 } = run(state, (draft) =>
      engine.createProduct(draft, { sellingName: "Billie Slim", sellingPrice: 500, category: "เสื้อ", status: "active", images: [], brandId: "brand-a", modelCode: "BS" })
    );
    const { state: s2, result: productId2 } = run(s1, (draft) =>
      engine.createProduct(draft, { sellingName: "Bruno Slim", sellingPrice: 500, category: "เสื้อ", status: "active", images: [], brandId: "brand-a", modelCode: "BRS" })
    );
    expect(productId1).not.toBe(productId2);
    expect(() => run(s2, (draft) => engine.updateProduct(draft, productId2, { modelCode: "BS" }))).toThrow(BusinessRuleError);
  });

  it("blocks removing a variant that still has stock on hand", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withStock } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "u1",
        receivedByName: "Tester",
        lines: [{ itemId: variantId, qty: 5 }],
      })
    );
    expect(() => run(withStock, (draft) => engine.removeVariant(draft, variantId))).toThrow(BusinessRuleError);
  });
});

describe("removeWarehouse", () => {
  const zeroRow = (variantId: string, warehouseId: string) => ({ itemId: variantId, warehouseId, qtyOnHand: 0, qtyReserved: 0 });

  it("removes an empty warehouse that never had any activity, together with its zero stock rows", () => {
    const { state: withVariant, variantId } = seedProductWithVariant(seedWarehouses());
    const state = produce(withVariant, (d) => {
      d.variantStock[variantId + "::wh-b"] = zeroRow(variantId, "wh-b");
    });
    const { state: next } = run(state, (draft) => engine.removeWarehouse(draft, "wh-b"));
    expect(next.warehouses["wh-b"]).toBeUndefined();
    expect(next.warehouses["wh-a"]).toBeDefined();
    expect(Object.values(next.variantStock).some((s) => s.warehouseId === "wh-b")).toBe(false);
  });

  it("refuses while the warehouse still holds stock", () => {
    const { state: withVariant, variantId } = seedProductWithVariant(seedWarehouses());
    const { state: stocked } = run(withVariant, (draft) =>
      engine.stockIn(draft, { itemType: "product", date: new Date().toISOString(), warehouseId: "wh-a", receivedBy: "u1", receivedByName: "T", lines: [{ itemId: variantId, qty: 3 }] })
    );
    expect(() => run(stocked, (draft) => engine.removeWarehouse(draft, "wh-a"))).toThrow(/คงเหลือ/);
    expect(stocked.warehouses["wh-a"]).toBeDefined();
  });

  it("refuses when stock is only reserved", () => {
    const { state: withVariant, variantId } = seedProductWithVariant(seedWarehouses());
    const state = produce(withVariant, (d) => {
      d.variantStock[variantId + "::wh-b"] = { ...zeroRow(variantId, "wh-b"), qtyReserved: 2 };
    });
    expect(() => run(state, (draft) => engine.removeWarehouse(draft, "wh-b"))).toThrow(BusinessRuleError);
  });

  it("refuses a warehouse with history even after its stock went back to zero, to protect the audit trail", () => {
    const { state: withVariant, variantId } = seedProductWithVariant(seedWarehouses());
    const { state: stocked } = run(withVariant, (draft) =>
      engine.stockIn(draft, { itemType: "product", date: new Date().toISOString(), warehouseId: "wh-a", receivedBy: "u1", receivedByName: "T", lines: [{ itemId: variantId, qty: 3 }] })
    );
    const emptied = produce(stocked, (d) => {
      for (const s of Object.values(d.variantStock)) s.qtyOnHand = 0;
    });
    expect(() => run(emptied, (draft) => engine.removeWarehouse(draft, "wh-a"))).toThrow(/ประวัติ/);
    expect(engine.warehouseRemovalBlocker(emptied, "wh-b")).toBeNull(); // คลังอื่นที่ไม่เคยใช้ยังลบได้
  });

  it("refuses to delete the last remaining warehouse", () => {
    const { state } = run(seedWarehouses(), (draft) => engine.removeWarehouse(draft, "wh-b"));
    expect(() => run(state, (draft) => engine.removeWarehouse(draft, "wh-a"))).toThrow(/อย่างน้อย 1 แห่ง/);
  });

  it("explains an unknown warehouse instead of crashing", () => {
    expect(engine.warehouseRemovalBlocker(seedWarehouses(), "nope")).toBe("ไม่พบคลังนี้");
  });
});

describe("removeUser", () => {
  function seedUsers(): AppState {
    return produce(seedWarehouses(), (draft) => {
      engine.upsertUser(draft, { id: "admin-1", name: "Admin", email: "admin@test.co", role: "admin" });
      engine.upsertUser(draft, { id: "staff-1", name: "Staff", email: "staff@test.co", role: "warehouse" });
      draft.currentUserId = "admin-1";
    });
  }

  it("removes a user who has never recorded a transaction", () => {
    const { state: next } = run(seedUsers(), (draft) => engine.removeUser(draft, "staff-1"));
    expect(next.users["staff-1"]).toBeUndefined();
    expect(next.users["admin-1"]).toBeDefined();
  });

  it("refuses to remove the currently signed-in user", () => {
    expect(() => run(seedUsers(), (draft) => engine.removeUser(draft, "admin-1"))).toThrow(BusinessRuleError);
  });

  it("refuses to remove a user referenced by stock history, so the audit trail keeps its actor", () => {
    const { state: withVariant, variantId } = seedProductWithVariant(seedUsers());
    const { state: withHistory } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "staff-1",
        receivedByName: "Staff",
        lines: [{ itemId: variantId, qty: 1 }],
      })
    );
    expect(() => run(withHistory, (draft) => engine.removeUser(draft, "staff-1"))).toThrow(BusinessRuleError);
    expect(withHistory.users["staff-1"]).toBeDefined();
  });

  it("keeps the must-change-password flag when an admin edits other fields", () => {
    const seeded = produce(seedUsers(), (draft) => {
      draft.users["staff-1"].mustChangePassword = true;
    });
    const { state: next } = run(seeded, (draft) => engine.upsertUser(draft, { id: "staff-1", role: "sales" }));
    expect(next.users["staff-1"]).toMatchObject({ role: "sales", mustChangePassword: true });
  });
});

describe("stockIn", () => {
  it("increases on-hand quantity only at the destination warehouse and records a movement", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: next } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "u1",
        receivedByName: "Tester",
        lines: [{ itemId: variantId, qty: 10, unitCost: 200 }],
      })
    );
    expect(engine.getStockLevel(next.variantStock, variantId, "wh-a").qtyOnHand).toBe(10);
    expect(engine.getStockLevel(next.variantStock, variantId, "wh-b").qtyOnHand).toBe(0);
    const movements = Object.values(next.movements);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ movementType: "stock_in", qtyChange: 10, qtyBefore: 0, qtyAfter: 10 });
  });

  it("rejects a non-positive quantity and leaves state untouched", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    expect(() =>
      run(withVariant, (draft) =>
        engine.stockIn(draft, {
          itemType: "product",
          date: new Date().toISOString(),
          warehouseId: "wh-a",
          receivedBy: "u1",
          receivedByName: "Tester",
          lines: [{ itemId: variantId, qty: 0 }],
        })
      )
    ).toThrow(BusinessRuleError);
    expect(engine.getStockLevel(withVariant.variantStock, variantId, "wh-a").qtyOnHand).toBe(0);
  });
});

describe("stockOut", () => {
  function seedWithStock(qty = 10) {
    const state = seedWarehouses();
    const { state: withVariant, variantId, productId } = seedProductWithVariant(state);
    const { state: withStock } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "u1",
        receivedByName: "Tester",
        lines: [{ itemId: variantId, qty }],
      })
    );
    return { state: withStock, variantId, productId };
  }

  it("decreases on-hand quantity at the source warehouse", () => {
    const { state, variantId } = seedWithStock(10);
    const { state: next } = run(state, (draft) =>
      engine.stockOut(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        reasonType: "damaged",
        actorId: "u1",
        actorName: "Tester",
        lines: [{ itemId: variantId, qty: 3 }],
      })
    );
    expect(engine.getStockLevel(next.variantStock, variantId, "wh-a").qtyOnHand).toBe(7);
  });

  it("throws and stays atomic when requested quantity exceeds on-hand stock", () => {
    const { state, variantId } = seedWithStock(2);
    expect(() =>
      run(state, (draft) =>
        engine.stockOut(draft, {
          itemType: "product",
          date: new Date().toISOString(),
          warehouseId: "wh-a",
          reasonType: "damaged",
          actorId: "u1",
          actorName: "Tester",
          lines: [{ itemId: variantId, qty: 5 }],
        })
      )
    ).toThrow(BusinessRuleError);
    expect(engine.getStockLevel(state.variantStock, variantId, "wh-a").qtyOnHand).toBe(2);
  });

  it("creates a completed order only when the reason is a sale", () => {
    const { state, variantId } = seedWithStock(10);
    const { state: afterSale, result } = run(state, (draft) =>
      engine.stockOut(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        reasonType: "sale",
        actorId: "u1",
        actorName: "Tester",
        channel: "shopee",
        lines: [{ itemId: variantId, qty: 2, unitPrice: 500 }],
      })
    );
    expect(result.order).toBeDefined();
    expect(result.order?.status).toBe("completed");
    expect(Object.values(afterSale.orders)).toHaveLength(1);

    const { result: nonSaleResult } = run(afterSale, (draft) =>
      engine.stockOut(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        reasonType: "photoshoot",
        actorId: "u1",
        actorName: "Tester",
        lines: [{ itemId: variantId, qty: 1 }],
      })
    );
    expect(nonSaleResult.order).toBeUndefined();
  });
});

describe("transfers", () => {
  function seedWithStock(qty = 10) {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withStock } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "u1",
        receivedByName: "Tester",
        lines: [{ itemId: variantId, qty }],
      })
    );
    return { state: withStock, variantId };
  }

  it("rejects transferring to the same warehouse", () => {
    const { state, variantId } = seedWithStock();
    expect(() =>
      run(state, (draft) =>
        engine.createTransfer(draft, {
          itemType: "product",
          date: new Date().toISOString(),
          fromWarehouseId: "wh-a",
          toWarehouseId: "wh-a",
          senderId: "u1",
          senderName: "Tester",
          lines: [{ itemId: variantId, qty: 1 }],
        })
      )
    ).toThrow(BusinessRuleError);
  });

  it("moves stock from source immediately, and to destination only after receipt", () => {
    const { state, variantId } = seedWithStock(10);
    const { state: afterCreate, result: transfer } = run(state, (draft) =>
      engine.createTransfer(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        fromWarehouseId: "wh-a",
        toWarehouseId: "wh-b",
        senderId: "u1",
        senderName: "Tester",
        lines: [{ itemId: variantId, qty: 4 }],
      })
    );
    expect(engine.getStockLevel(afterCreate.variantStock, variantId, "wh-a").qtyOnHand).toBe(6);
    expect(engine.getStockLevel(afterCreate.variantStock, variantId, "wh-b").qtyOnHand).toBe(0);
    expect(transfer.status).toBe("pending");

    const { state: afterReceive } = run(afterCreate, (draft) => engine.receiveTransfer(draft, transfer.id, "u2", "Receiver"));
    expect(engine.getStockLevel(afterReceive.variantStock, variantId, "wh-b").qtyOnHand).toBe(4);
    expect(afterReceive.transfers[transfer.id].status).toBe("received");
  });

  it("restores source stock when a pending transfer is cancelled, and blocks re-cancellation", () => {
    const { state, variantId } = seedWithStock(10);
    const { state: afterCreate, result: transfer } = run(state, (draft) =>
      engine.createTransfer(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        fromWarehouseId: "wh-a",
        toWarehouseId: "wh-b",
        senderId: "u1",
        senderName: "Tester",
        lines: [{ itemId: variantId, qty: 4 }],
      })
    );
    const { state: afterCancel } = run(afterCreate, (draft) => engine.cancelTransfer(draft, transfer.id, "changed mind", "u1", "Tester"));
    expect(engine.getStockLevel(afterCancel.variantStock, variantId, "wh-a").qtyOnHand).toBe(10);
    expect(afterCancel.transfers[transfer.id].status).toBe("cancelled");

    expect(() => run(afterCancel, (draft) => engine.cancelTransfer(draft, transfer.id, "again", "u1", "Tester"))).toThrow(BusinessRuleError);
  });

  it("blocks cancelling a transfer that has already been received", () => {
    const { state, variantId } = seedWithStock(10);
    const { state: afterCreate, result: transfer } = run(state, (draft) =>
      engine.createTransfer(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        fromWarehouseId: "wh-a",
        toWarehouseId: "wh-b",
        senderId: "u1",
        senderName: "Tester",
        lines: [{ itemId: variantId, qty: 4 }],
      })
    );
    const { state: afterReceive } = run(afterCreate, (draft) => engine.receiveTransfer(draft, transfer.id, "u2", "Receiver"));
    expect(() => run(afterReceive, (draft) => engine.cancelTransfer(draft, transfer.id, "too late", "u1", "Tester"))).toThrow(BusinessRuleError);
  });
});

describe("cancelOrder", () => {
  it("restocks every line back to the order's warehouse and blocks double cancellation", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withStock } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "u1",
        receivedByName: "Tester",
        lines: [{ itemId: variantId, qty: 10 }],
      })
    );
    const { state: afterSale, result: saleResult } = run(withStock, (draft) =>
      engine.stockOut(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        reasonType: "sale",
        actorId: "u1",
        actorName: "Tester",
        channel: "shopee",
        lines: [{ itemId: variantId, qty: 4, unitPrice: 500 }],
      })
    );
    expect(engine.getStockLevel(afterSale.variantStock, variantId, "wh-a").qtyOnHand).toBe(6);

    const orderId = saleResult.order!.id;
    const { state: afterCancel } = run(afterSale, (draft) => engine.cancelOrder(draft, orderId, "customer request", "u1", "Tester"));
    expect(engine.getStockLevel(afterCancel.variantStock, variantId, "wh-a").qtyOnHand).toBe(10);
    expect(afterCancel.orders[orderId].status).toBe("cancelled");

    expect(() => run(afterCancel, (draft) => engine.cancelOrder(draft, orderId, "again", "u1", "Tester"))).toThrow(BusinessRuleError);
  });
});

describe("adjustStock", () => {
  it("sets the exact quantity and records the delta as an adjustment movement", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: next } = run(withVariant, (draft) =>
      engine.adjustStock(draft, { itemType: "product", itemId: variantId, warehouseId: "wh-a", newQty: 25, reason: "นับสต็อกประจำปี", actorId: "u1", actorName: "Tester" })
    );
    expect(engine.getStockLevel(next.variantStock, variantId, "wh-a").qtyOnHand).toBe(25);
    const movement = Object.values(next.movements)[0];
    expect(movement).toMatchObject({ movementType: "adjustment", qtyChange: 25, qtyBefore: 0, qtyAfter: 25 });
  });

  it("rejects a negative target quantity", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    expect(() =>
      run(withVariant, (draft) =>
        engine.adjustStock(draft, { itemType: "product", itemId: variantId, warehouseId: "wh-a", newQty: -1, reason: "x", actorId: "u1", actorName: "Tester" })
      )
    ).toThrow(BusinessRuleError);
  });

  it("rejects adjusting below the reserved quantity", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withStock } = run(withVariant, (draft) =>
      engine.stockIn(draft, {
        itemType: "product",
        date: new Date().toISOString(),
        warehouseId: "wh-a",
        receivedBy: "u1",
        receivedByName: "Tester",
        lines: [{ itemId: variantId, qty: 10 }],
      })
    );
    const { state: withReservation } = run(withStock, (draft) => engine.setReservation(draft, "product", variantId, "wh-a", 5));
    expect(() =>
      run(withReservation, (draft) =>
        engine.adjustStock(draft, { itemType: "product", itemId: variantId, warehouseId: "wh-a", newQty: 2, reason: "x", actorId: "u1", actorName: "Tester" })
      )
    ).toThrow(BusinessRuleError);
  });
});

describe("unit tokens (ป้าย QR ต่อชิ้น)", () => {
  it("mints the requested number of distinct tokens for a variant", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { result: tokens } = run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 5));
    expect(tokens).toHaveLength(5);
    expect(new Set(tokens.map((t) => t.id)).size).toBe(5);
    expect(tokens.every((t) => t.variantId === variantId)).toBe(true);
  });

  it("rejects minting a zero or negative quantity", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    expect(() => run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 0))).toThrow(BusinessRuleError);
  });

  it("allows the first scan in a direction and records lastAction/lastActionAt", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withToken, result: tokens } = run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 1));
    const tokenId = tokens[0].id;
    const { state: next, result: token } = run(withToken, (draft) => engine.recordUnitScan(draft, { tokenId, action: "in" }));
    expect(token.lastAction).toBe("in");
    expect(next.unitTokens[tokenId].lastAction).toBe("in");
    expect(next.unitTokens[tokenId].lastActionAt).toBeTruthy();
  });

  it("blocks scanning the same direction twice within the cooldown window", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withToken, result: tokens } = run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 1));
    const tokenId = tokens[0].id;
    const { state: afterFirstIn } = run(withToken, (draft) => engine.recordUnitScan(draft, { tokenId, action: "in" }));
    expect(() => run(afterFirstIn, (draft) => engine.recordUnitScan(draft, { tokenId, action: "in" }))).toThrow(BusinessRuleError);
  });

  it("allows scanning the opposite direction immediately (return / picked wrong item)", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withToken, result: tokens } = run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 1));
    const tokenId = tokens[0].id;
    const { state: afterOut } = run(withToken, (draft) => engine.recordUnitScan(draft, { tokenId, action: "out" }));
    const { result: token } = run(afterOut, (draft) => engine.recordUnitScan(draft, { tokenId, action: "in" }));
    expect(token.lastAction).toBe("in");
  });

  it("allows re-scanning the same direction again once the cooldown has elapsed", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withToken, result: tokens } = run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 1));
    const tokenId = tokens[0].id;
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const staleState = produce(withToken, (draft) => {
      draft.unitTokens[tokenId].lastAction = "out";
      draft.unitTokens[tokenId].lastActionAt = fourHoursAgo;
    });
    const { result: token } = run(staleState, (draft) => engine.recordUnitScan(draft, { tokenId, action: "out" }));
    expect(token.lastAction).toBe("out");
  });

  it("throws for an unknown / unregistered token id", () => {
    const state = seedWarehouses();
    expect(() => run(state, (draft) => engine.recordUnitScan(draft, { tokenId: "unknown-id", action: "in" }))).toThrow(BusinessRuleError);
  });

  it("checkUnitTokenScan reports the exact previous scan time in the block message", () => {
    const state = seedWarehouses();
    const { state: withVariant, variantId } = seedProductWithVariant(state);
    const { state: withToken, result: tokens } = run(withVariant, (draft) => engine.mintUnitTokens(draft, variantId, 1));
    const tokenId = tokens[0].id;
    const { state: afterIn } = run(withToken, (draft) => engine.recordUnitScan(draft, { tokenId, action: "in" }));
    const check = engine.checkUnitTokenScan(afterIn.unitTokens, tokenId, "in");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain("สแกนเข้าไปแล้วเมื่อ");
  });
});
