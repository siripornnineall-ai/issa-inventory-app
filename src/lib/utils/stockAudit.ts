import type { AppState } from "@/lib/store/state";
import type { MovementItemType, MovementType, StockMovement } from "@/lib/types";

// ตรวจว่ายอดคงเหลือปัจจุบันตรงกับบรรทัดสุดท้ายในประวัติการเคลื่อนไหวหรือไม่ (ต่อรายการ ต่อคลัง)
// ประวัติทุกบรรทัดบันทึก "ยอดหลังทำรายการ" (qtyAfter) ไว้ ถ้ายอดคงเหลือไม่เท่ากับบรรทัดสุดท้าย แปลว่ามีการเขียนข้อมูลไม่ครบ
// (เช่นประวัติเข้าแต่ยอดคงเหลือไม่เข้า) หรือมีใครแก้ยอดโดยไม่ผ่านระบบ
const OUTBOUND: MovementType[] = ["sale", "transfer_out", "damaged", "lost", "photoshoot", "internal_use", "return_to_source", "send_to_store"];

function movementWarehouse(m: StockMovement): string | undefined {
  return OUTBOUND.includes(m.movementType) ? (m.warehouseFromId ?? m.warehouseToId) : (m.warehouseToId ?? m.warehouseFromId);
}

export interface StockMismatch {
  itemType: MovementItemType;
  itemId: string;
  warehouseId: string;
  recorded: number; // ยอดหลังทำรายการตามบรรทัดสุดท้ายในประวัติ
  actual: number; // ยอดคงเหลือในระบบตอนนี้
  lastMovement: StockMovement;
}

export function findStockMismatches(state: AppState, opts: { sinceISO?: string } = {}): StockMismatch[] {
  const last = new Map<string, StockMovement>();
  for (const m of Object.values(state.movements)) {
    const wh = movementWarehouse(m);
    if (!wh) continue;
    const key = `${m.itemType}|${m.itemId}|${wh}`;
    const cur = last.get(key);
    if (!cur || m.createdAt > cur.createdAt || (m.createdAt === cur.createdAt && m.refNo > cur.refNo)) last.set(key, m);
  }
  const out: StockMismatch[] = [];
  for (const [key, m] of last) {
    if (opts.sinceISO && m.createdAt < opts.sinceISO) continue;
    const wh = key.split("|")[2];
    const map = m.itemType === "product" ? state.variantStock : state.equipmentStock;
    const actual = map[`${m.itemId}::${wh}`]?.qtyOnHand ?? 0;
    if (actual !== m.qtyAfter) out.push({ itemType: m.itemType, itemId: m.itemId, warehouseId: wh, recorded: m.qtyAfter, actual, lastMovement: m });
  }
  return out.sort((a, b) => (a.lastMovement.createdAt < b.lastMovement.createdAt ? 1 : -1));
}
