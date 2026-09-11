import type { AppState } from "./state";
import { getStockLevel } from "./engine";
import type { Invoice, MovementType, Order, Product, StockInDoc, StockMovement } from "@/lib/types";
import { sumBaht } from "@/lib/utils/money";

export function resolveUnitToken(state: AppState, tokenId: string) {
  const token = state.unitTokens[tokenId];
  if (!token) return undefined;
  const variant = state.variants[token.variantId];
  if (!variant) return undefined;
  return { token, variant };
}

export function variantStockAcrossWarehouses(state: AppState, variantId: string) {
  let onHand = 0;
  let reserved = 0;
  const byWarehouse: Record<string, { onHand: number; reserved: number }> = {};
  for (const wh of Object.values(state.warehouses)) {
    const s = getStockLevel(state.variantStock, variantId, wh.id);
    onHand += s.qtyOnHand;
    reserved += s.qtyReserved;
    byWarehouse[wh.id] = { onHand: s.qtyOnHand, reserved: s.qtyReserved };
  }
  return { onHand, reserved, available: Math.max(0, onHand - reserved), byWarehouse };
}

export function equipmentStockAcrossWarehouses(state: AppState, equipmentId: string) {
  let onHand = 0;
  const byWarehouse: Record<string, number> = {};
  for (const wh of Object.values(state.warehouses)) {
    const s = getStockLevel(state.equipmentStock, equipmentId, wh.id);
    onHand += s.qtyOnHand;
    byWarehouse[wh.id] = s.qtyOnHand;
  }
  return { onHand, byWarehouse };
}

export function productVariants(state: AppState, productId: string) {
  return Object.values(state.variants).filter((v) => v.productId === productId);
}

export function productAggregate(state: AppState, productId: string) {
  const variants = productVariants(state, productId);
  let onHand = 0;
  let reserved = 0;
  for (const v of variants) {
    const s = variantStockAcrossWarehouses(state, v.id);
    onHand += s.onHand;
    reserved += s.reserved;
  }
  return { onHand, reserved, available: Math.max(0, onHand - reserved), variantCount: variants.length };
}

export function totalProductQtyNow(state: AppState): number {
  return Object.values(state.variants).reduce((sum, v) => sum + variantStockAcrossWarehouses(state, v.id).onHand, 0);
}

export function movementsInRange(state: AppState, fromISO: string, toISO: string): StockMovement[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return Object.values(state.movements).filter((m) => {
    const t = new Date(m.createdAt).getTime();
    return t >= from && t <= to;
  });
}

export function ordersInRange(state: AppState, fromISO: string, toISO: string): Order[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return Object.values(state.orders).filter((o) => {
    const t = new Date(o.date).getTime();
    return t >= from && t <= to;
  });
}

export function purchaseOrdersInRange(state: AppState, fromISO: string, toISO: string): StockInDoc[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return Object.values(state.stockInDocs).filter((d) => {
    if (!d.issuePo) return false;
    const t = new Date(d.date).getTime();
    return t >= from && t <= to;
  });
}

export function stockInDocTotal(doc: StockInDoc): number {
  return sumBaht(doc.lines.map((l) => (l.unitCost ?? 0) * l.qty));
}

export function orderNetTotal(order: Order): number {
  return sumBaht(order.lines.map((l) => l.unitPrice * l.qty - l.discount));
}

export function invoicesInRange(state: AppState, fromISO: string, toISO: string): Invoice[] {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return Object.values(state.invoices).filter((i) => {
    const t = new Date(i.date).getTime();
    return t >= from && t <= to;
  });
}

export function invoiceGrandTotal(state: AppState, invoice: Invoice): number {
  return sumBaht(invoice.orderIds.map((id) => (state.orders[id] ? orderNetTotal(state.orders[id]) : 0)));
}

export function orderQty(order: Order): number {
  return order.lines.reduce((sum, l) => sum + l.qty, 0);
}

export interface DashboardStats {
  currentQty: number;
  sales: { baht: number; qty: number; orders: number };
  stockIn: { qty: number; docs: number };
  stockOut: { qty: number; docs: number; byReason: Record<string, number> };
  cancelled: { orders: number; qty: number; baht: number };
}

export function dashboardStats(state: AppState, fromISO: string, toISO: string): DashboardStats {
  const asOf = totalProductQtyNow(state);
  const movements = movementsInRange(state, fromISO, toISO).filter((m) => m.itemType === "product");
  const orders = ordersInRange(state, fromISO, toISO).filter((o) => o.status !== "cancelled");

  const stockInMovs = movements.filter((m) => m.movementType === "stock_in");
  const stockOutMovs = movements.filter((m) => m.qtyChange < 0 && m.movementType !== "cancel_restock");

  const byReason: Record<string, number> = {};
  for (const m of stockOutMovs) {
    byReason[m.movementType] = (byReason[m.movementType] ?? 0) + Math.abs(m.qtyChange);
  }

  const cancelledOrders = Object.values(state.orders).filter(
    (o) => o.status === "cancelled" && o.cancelledAt && new Date(o.cancelledAt).getTime() >= new Date(fromISO).getTime() && new Date(o.cancelledAt).getTime() <= new Date(toISO).getTime()
  );

  return {
    currentQty: asOf,
    sales: {
      baht: sumBaht(orders.map(orderNetTotal)),
      qty: orders.reduce((s, o) => s + orderQty(o), 0),
      orders: orders.length,
    },
    stockIn: {
      qty: stockInMovs.reduce((s, m) => s + m.qtyChange, 0),
      docs: new Set(stockInMovs.map((m) => m.relatedDocNo)).size,
    },
    stockOut: {
      qty: stockOutMovs.reduce((s, m) => s + Math.abs(m.qtyChange), 0),
      docs: new Set(stockOutMovs.map((m) => m.relatedDocNo)).size,
      byReason,
    },
    cancelled: {
      orders: cancelledOrders.length,
      qty: cancelledOrders.reduce((s, o) => s + orderQty(o), 0),
      baht: sumBaht(cancelledOrders.map(orderNetTotal)),
    },
  };
}

export function dailySeries(state: AppState, fromISO: string, toISO: string) {
  const days: { date: string; label: string; sales: number; stockIn: number }[] = [];
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const dayMovs = movementsInRange(state, dayStart.toISOString(), dayEnd.toISOString()).filter((m) => m.itemType === "product");
    const salesQty = dayMovs.filter((m) => m.movementType === "sale").reduce((s, m) => s + Math.abs(m.qtyChange), 0);
    const stockInQty = dayMovs.filter((m) => m.movementType === "stock_in").reduce((s, m) => s + m.qtyChange, 0);
    days.push({
      date: dayStart.toISOString(),
      label: dayStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      sales: salesQty,
      stockIn: stockInQty,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function bestSellers(state: AppState, fromISO: string, toISO: string, limit = 5) {
  const orders = ordersInRange(state, fromISO, toISO).filter((o) => o.status !== "cancelled");
  const map = new Map<string, { product: Product; qty: number; revenue: number }>();
  for (const o of orders) {
    for (const line of o.lines) {
      const product = state.products[line.productId];
      if (!product) continue;
      const entry = map.get(product.id) ?? { product, qty: 0, revenue: 0 };
      entry.qty += line.qty;
      entry.revenue = sumBaht([entry.revenue, line.unitPrice * line.qty - line.discount]);
      map.set(product.id, entry);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function lowStockVariants(state: AppState) {
  return Object.values(state.variants)
    .filter((v) => v.active)
    .map((v) => ({ variant: v, stock: variantStockAcrossWarehouses(state, v.id) }))
    .filter((x) => x.stock.onHand <= x.variant.reorderPoint);
}

export function lowStockEquipment(state: AppState) {
  return Object.values(state.equipment)
    .filter((e) => e.status === "active")
    .map((e) => ({ equipment: e, stock: equipmentStockAcrossWarehouses(state, e.id) }))
    .filter((x) => x.stock.onHand <= x.equipment.reorderPoint);
}

export function recentMovements(state: AppState, limit = 10) {
  return Object.values(state.movements)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function equipmentOverview(state: AppState, fromISO: string, toISO: string) {
  const onHand = Object.values(state.equipment).reduce((s, e) => s + equipmentStockAcrossWarehouses(state, e.id).onHand, 0);
  const movs = movementsInRange(state, fromISO, toISO).filter((m) => m.itemType === "equipment");
  const stockIn = movs.filter((m) => m.movementType === "stock_in").reduce((s, m) => s + m.qtyChange, 0);
  const stockOut = movs.filter((m) => m.qtyChange < 0).reduce((s, m) => s + Math.abs(m.qtyChange), 0);
  return { onHand, stockIn, stockOut, lowStockCount: lowStockEquipment(state).length };
}

export function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    sale: "ขาย",
    send_to_store: "ส่งหน้าร้าน",
    transfer_out: "โอนคลัง",
    size_change: "เปลี่ยนไซซ์",
    color_change: "เปลี่ยนสี",
    damaged: "เสียหาย",
    lost: "สูญหาย",
    photoshoot: "ถ่ายภาพ",
    internal_use: "ใช้ภายใน",
    return_to_source: "คืนร้านต้นทาง",
    adjustment: "ปรับยอด",
    other: "อื่น ๆ",
  };
  return labels[reason] ?? reason;
}

export function movementTypeIsInbound(t: MovementType): boolean {
  return t === "stock_in" || t === "transfer_in" || t === "cancel_restock";
}
