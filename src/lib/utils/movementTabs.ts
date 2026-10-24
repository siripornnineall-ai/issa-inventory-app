import { STOCK_RETURN_TYPES, type MovementType, type StockMovement } from "@/lib/types";

// แยกประวัติการเคลื่อนไหวเป็น 5 มุมมอง: ทั้งหมด / สินค้าเข้า / สินค้าออก / นับสต็อก-ปรับยอด / สินค้าคืน
export type HistoryTab = "all" | "in" | "out" | "adjust" | "return";

export const HISTORY_TAB_LABEL: Record<HistoryTab, string> = {
  all: "ทั้งหมด",
  in: "สินค้าเข้า",
  out: "สินค้าออก",
  adjust: "นับสต็อก/ปรับยอด",
  return: "สินค้าคืน",
};

const IN_TYPES: MovementType[] = ["stock_in", "transfer_in", "cancel_restock"];
const OUT_TYPES: MovementType[] = ["sale", "transfer_out", "damaged", "lost", "photoshoot", "internal_use", "return_to_source", "send_to_store", "size_change", "color_change"];
const RETURN_TYPES: MovementType[] = [...STOCK_RETURN_TYPES];

// ทิศทางของการเคลื่อนไหวหนึ่งรายการ "ปรับยอด" และ "สินค้าคืน" แยกเป็นของตัวเองเสมอ ไม่ปนกับเข้า/ออก
// ประเภท "อื่น ๆ" ดูจากเครื่องหมายของจำนวน (บวก = เข้า, ลบ = ออก, 0 = ปรับยอด)
export function movementDirection(m: Pick<StockMovement, "movementType" | "qtyChange">): Exclude<HistoryTab, "all"> {
  if (m.movementType === "adjustment") return "adjust";
  if (RETURN_TYPES.includes(m.movementType)) return "return";
  if (IN_TYPES.includes(m.movementType)) return "in";
  if (OUT_TYPES.includes(m.movementType)) return "out";
  if (m.qtyChange > 0) return "in";
  if (m.qtyChange < 0) return "out";
  return "adjust";
}

export function movementTypesForTab(tab: HistoryTab): MovementType[] | null {
  if (tab === "all") return null;
  if (tab === "in") return IN_TYPES;
  if (tab === "out") return OUT_TYPES;
  if (tab === "return") return RETURN_TYPES;
  return ["adjustment"];
}

// การนับสต็อกที่ตรงกับระบบ บันทึกเป็นปรับยอดที่เปลี่ยน 0 ชิ้น (ยืนยันยอด) ซ่อนไว้ตามค่าเริ่มต้น เพราะนับรอบเดียวมีเป็นหลายสิบบรรทัด
export function isVerificationOnly(m: Pick<StockMovement, "movementType" | "qtyChange">): boolean {
  return m.movementType === "adjustment" && m.qtyChange === 0;
}

export interface HistoryTotals {
  inQty: number;
  inCount: number;
  outQty: number;
  outCount: number;
  returnQty: number;
  returnCount: number;
  adjustUp: number;
  adjustDown: number;
  adjustCount: number;
  verifiedCount: number;
}

export function summarizeMovements(list: Pick<StockMovement, "movementType" | "qtyChange">[]): HistoryTotals {
  const t: HistoryTotals = { inQty: 0, inCount: 0, outQty: 0, outCount: 0, returnQty: 0, returnCount: 0, adjustUp: 0, adjustDown: 0, adjustCount: 0, verifiedCount: 0 };
  for (const m of list) {
    const d = movementDirection(m);
    if (d === "in") {
      t.inQty += m.qtyChange;
      t.inCount += 1;
    } else if (d === "out") {
      t.outQty += Math.abs(m.qtyChange);
      t.outCount += 1;
    } else if (d === "return") {
      t.returnQty += m.qtyChange;
      t.returnCount += 1;
    } else if (m.qtyChange === 0) {
      t.verifiedCount += 1;
    } else {
      t.adjustCount += 1;
      if (m.qtyChange > 0) t.adjustUp += m.qtyChange;
      else t.adjustDown += Math.abs(m.qtyChange);
    }
  }
  return t;
}
