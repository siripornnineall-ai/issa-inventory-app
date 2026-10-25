import type { AppState } from "./state";
import { getStockLevel, normalizeUnitCode, UNIT_CODE_PATTERN } from "./engine";
import { STOCK_RETURN_TYPES, isStockReturnType } from "@/lib/types";
import type { Invoice, MovementType, Order, Product, StockInDoc, StockMovement, StockReturnType } from "@/lib/types";
import { sumBaht } from "@/lib/utils/money";

// หาป้ายรายชิ้นจากสิ่งที่สแกนได้: id เต็ม (QR) หรือรหัสสั้น 8 ตัว (บาร์โค้ด) พิมพ์ตัวเล็กตัวใหญ่หรือมีช่องว่าง/ขีดก็ได้
export function resolveUnitToken(state: AppState, input: string) {
  let token = state.unitTokens[input];
  if (!token) {
    const code = normalizeUnitCode(input);
    if (UNIT_CODE_PATTERN.test(code)) token = Object.values(state.unitTokens).find((t) => t.code === code) as typeof token;
  }
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

// ถือเป็น "สต็อกออก" เฉพาะการเบิก/ขาย/ใช้จริงเท่านั้น: การปรับยอดจากการนับสต็อก (ปรับลงเมื่อนับใหม่แล้วพบว่าน้อยกว่า) ไม่ใช่ของออกจากคลัง
// และการคืนสต็อกจากการยกเลิกออเดอร์ก็ไม่ใช่ (เป็นยอดเข้า)
export function isStockOutMovement(m: { qtyChange: number; movementType: string }): boolean {
  // convert_out = ตัดตัวเปล่าไปเย็บเป็นอีกรุ่น (ของยังอยู่ในคลัง ไม่ใช่ของออก)
  return m.qtyChange < 0 && m.movementType !== "cancel_restock" && m.movementType !== "adjustment" && m.movementType !== "convert_out";
}

// ตัวเลือกที่เย็บตามออเดอร์: ต้นทางที่ตัดตัวเปล่ามา (ถ้ามี)
export function sourceVariantFor(state: AppState, variantId: string) {
  const v = state.variants[variantId];
  return v?.sourceVariantId && v.sourceVariantId !== v.id ? state.variants[v.sourceVariantId] : undefined;
}

export function dashboardStats(state: AppState, fromISO: string, toISO: string): DashboardStats {
  const asOf = totalProductQtyNow(state);
  const movements = movementsInRange(state, fromISO, toISO).filter((m) => m.itemType === "product");
  const orders = ordersInRange(state, fromISO, toISO).filter((o) => o.status !== "cancelled");

  const stockInMovs = movements.filter((m) => m.movementType === "stock_in");
  const stockOutMovs = movements.filter(isStockOutMovement);

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

export interface ReturnStats {
  total: { qty: number; docs: number };
  byType: Record<StockReturnType, { qty: number; docs: number }>;
  salesQty: number;
  // ของที่รับคืนทุกประเภทรวมกัน เทียบกับยอดขาย (ชิ้น) ในช่วงเดียวกัน เป็นเปอร์เซ็นต์ / null เมื่อช่วงนั้นไม่มียอดขาย
  ratePct: number | null;
}

// สต็อกคืนสินค้า (ตีกลับ / คืน / ตำหนิ / เปลี่ยน) แยกจากสต็อกเข้า: dashboardStats.stockIn นับเฉพาะรับสินค้าเข้าใหม่อยู่แล้ว
export function returnStats(state: AppState, fromISO: string, toISO: string): ReturnStats {
  const byType = Object.fromEntries(STOCK_RETURN_TYPES.map((t) => [t, { qty: 0, docs: 0 }])) as ReturnStats["byType"];
  const docSets = Object.fromEntries(STOCK_RETURN_TYPES.map((t) => [t, new Set<string | undefined>()])) as Record<StockReturnType, Set<string | undefined>>;
  const allDocs = new Set<string | undefined>();
  let total = 0;
  let salesQty = 0;
  for (const m of movementsInRange(state, fromISO, toISO)) {
    if (m.itemType !== "product") continue;
    if (m.movementType === "sale") salesQty += Math.abs(m.qtyChange);
    if (!isStockReturnType(m.movementType)) continue;
    byType[m.movementType].qty += m.qtyChange;
    docSets[m.movementType].add(m.relatedDocNo);
    allDocs.add(m.relatedDocNo);
    total += m.qtyChange;
  }
  for (const t of STOCK_RETURN_TYPES) byType[t].docs = docSets[t].size;
  return { total: { qty: total, docs: allDocs.size }, byType, salesQty, ratePct: salesQty > 0 ? Math.round((total / salesQty) * 1000) / 10 : null };
}

// ไม่ระบุแบรนด์ (สินค้าที่ไม่ได้ผูกแบรนด์) ใช้ brandId เป็น null
export interface BrandStats {
  brandId: string | null;
  name: string;
  currentQty: number;
  stockIn: { qty: number; docs: number };
  stockOut: { qty: number; docs: number };
}

// ตัวเลขการ์ดแดชบอร์ดแยกตามแบรนด์ (จำนวนปัจจุบัน / สต็อกเข้า / สต็อกออก) นับด้วยกติกาเดียวกับ dashboardStats
// ผลรวมของทุกแบรนด์จึงเท่ากับตัวเลขรวมเสมอ แบรนด์ที่ปิดใช้งานแล้วและไม่มีตัวเลขจะไม่แสดง
export function dashboardStatsByBrand(state: AppState, fromISO: string, toISO: string): BrandStats[] {
  const brandOfVariant = (variantId: string | undefined): string | null => {
    const variant = variantId ? state.variants[variantId] : undefined;
    const product = variant ? state.products[variant.productId] : undefined;
    return product?.brandId && state.brands[product.brandId] ? product.brandId : null;
  };

  const map = new Map<string | null, BrandStats>();
  const entry = (brandId: string | null): BrandStats => {
    let e = map.get(brandId);
    if (!e) {
      e = { brandId, name: brandId ? state.brands[brandId].name : "ไม่ระบุแบรนด์", currentQty: 0, stockIn: { qty: 0, docs: 0 }, stockOut: { qty: 0, docs: 0 } };
      map.set(brandId, e);
    }
    return e;
  };
  for (const b of Object.values(state.brands)) entry(b.id);

  for (const v of Object.values(state.variants)) {
    entry(brandOfVariant(v.id)).currentQty += variantStockAcrossWarehouses(state, v.id).onHand;
  }

  const inDocs = new Map<string | null, Set<string | undefined>>();
  const outDocs = new Map<string | null, Set<string | undefined>>();
  for (const m of movementsInRange(state, fromISO, toISO)) {
    if (m.itemType !== "product") continue;
    const isIn = m.movementType === "stock_in";
    const isOut = isStockOutMovement(m);
    if (!isIn && !isOut) continue;
    const brandId = brandOfVariant(m.variantId);
    const e = entry(brandId);
    const docs = isIn ? inDocs : outDocs;
    if (!docs.has(brandId)) docs.set(brandId, new Set());
    docs.get(brandId)!.add(m.relatedDocNo);
    if (isIn) e.stockIn.qty += m.qtyChange;
    else e.stockOut.qty += Math.abs(m.qtyChange);
  }
  for (const [brandId, set] of inDocs) entry(brandId).stockIn.docs = set.size;
  for (const [brandId, set] of outDocs) entry(brandId).stockOut.docs = set.size;

  return Array.from(map.values())
    .filter((s) => s.brandId === null ? s.currentQty !== 0 || s.stockIn.qty !== 0 || s.stockOut.qty !== 0 : state.brands[s.brandId].active || s.currentQty !== 0 || s.stockIn.qty !== 0 || s.stockOut.qty !== 0)
    .sort((a, b) => (a.brandId === null ? 1 : 0) - (b.brandId === null ? 1 : 0) || (state.brands[a.brandId ?? ""]?.createdAt ?? "").localeCompare(state.brands[b.brandId ?? ""]?.createdAt ?? ""));
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
    // ตัวเลือกที่เย็บตามออเดอร์ไม่ถือสต็อกเอง แจ้งเตือนใกล้หมดที่ตัวเปล่าของรุ่นต้นทางแทน
    .filter((v) => v.active && !sourceVariantFor(state, v.id))
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
  const stockOut = movs.filter(isStockOutMovement).reduce((s, m) => s + Math.abs(m.qtyChange), 0);
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
