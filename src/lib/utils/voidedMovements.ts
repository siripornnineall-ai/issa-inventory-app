import type { Order, StockInDoc, StockMovement } from "@/lib/types";

// เอกสารที่ถูกยกเลิกเพราะลงผิด: รายการเคลื่อนไหวของเอกสารนั้นยังอยู่ในประวัติ (ลบ/แก้ตัวเลขไม่ได้) แต่ไม่ควรไปปนในตัวเลขสรุป
// (สต็อกเข้า/ออก, สินค้าคืน, ยอดขายสุทธิ, วันที่รับของล่าสุดของสินค้าค้างสต็อก) มี 2 แบบ
//  1) ใบรับเข้า/ใบรับคืนที่ยกเลิก (status = cancelled) ใช้หักสต็อกคืนด้วยรายการ cancel_stock_in
//  2) ใบเบิกออกที่เป็น "ขายหลอก" ซึ่งผู้ดูแลระบบยกเลิกออเดอร์แบบไม่คืนสต็อก (ออเดอร์ cancelled แต่ restocked = false)
//     สต็อกไม่เปลี่ยนเพราะถูกต้องอยู่แล้ว (ขายหลอกถูกบันทึกมาเพื่อลบของที่รับเข้าผิด)
// ใช้ WeakMap ผูกกับตารางที่อ่าน ตารางเปลี่ยนเมื่อไรก็คำนวณใหม่เมื่อนั้น (immer สร้างอ็อบเจกต์ใหม่ทุกครั้งที่แก้)
const cache = new WeakMap<object, WeakMap<object, Set<string>>>();

export function isVoidedSaleOrder(o: Pick<Order, "status" | "restocked">): boolean {
  return o.status === "cancelled" && !o.restocked;
}

export function voidedDocNos(state: { stockInDocs: Record<string, StockInDoc>; orders: Record<string, Order> }): Set<string> {
  let byOrders = cache.get(state.stockInDocs);
  if (!byOrders) {
    byOrders = new WeakMap();
    cache.set(state.stockInDocs, byOrders);
  }
  const hit = byOrders.get(state.orders);
  if (hit) return hit;
  const set = new Set<string>();
  for (const d of Object.values(state.stockInDocs)) if (d.status === "cancelled") set.add(d.docNo);
  for (const o of Object.values(state.orders)) if (o.stockOutDocNo && isVoidedSaleOrder(o)) set.add(o.stockOutDocNo);
  byOrders.set(state.orders, set);
  return set;
}

export function isVoidedMovement(m: Pick<StockMovement, "refNo">, voided: Set<string>): boolean {
  return voided.size > 0 && voided.has(m.refNo);
}
