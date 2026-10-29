import { isStockReturnType } from "@/lib/types";
import type { StockInDoc, StockMovement } from "@/lib/types";

// ใบรับเข้า/ใบรับคืนที่ถูกยกเลิก (รับเข้าผิด): รายการเคลื่อนไหวเดิมกับรายการหักคืนยังอยู่ในประวัติ (ลบ/แก้ตัวเลขไม่ได้)
// แต่ไม่ควรไปปนในตัวเลขสรุป (สต็อกเข้า, สินค้าคืน, ยอดขายสุทธิ, วันที่รับของล่าสุดของสินค้าค้างสต็อก)
// ใช้ WeakMap ผูกกับตัวตารางใบรับเข้า ตารางเปลี่ยนเมื่อไรก็คำนวณใหม่เมื่อนั้น (immer สร้างอ็อบเจกต์ใหม่ทุกครั้งที่แก้)
const cache = new WeakMap<object, Set<string>>();

export function cancelledStockInDocNos(state: { stockInDocs: Record<string, StockInDoc> }): Set<string> {
  const hit = cache.get(state.stockInDocs);
  if (hit) return hit;
  const set = new Set<string>();
  for (const d of Object.values(state.stockInDocs)) if (d.status === "cancelled") set.add(d.docNo);
  cache.set(state.stockInDocs, set);
  return set;
}

export function isVoidedMovement(m: Pick<StockMovement, "refNo" | "movementType">, cancelled: Set<string>): boolean {
  if (cancelled.size === 0 || !cancelled.has(m.refNo)) return false;
  return m.movementType === "cancel_stock_in" || m.movementType === "stock_in" || isStockReturnType(m.movementType);
}
