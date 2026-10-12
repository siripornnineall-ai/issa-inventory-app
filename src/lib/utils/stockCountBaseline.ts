import type { AppState } from "@/lib/store/state";

// ยอดในระบบของทุกตัวเลือกของรุ่นนี้ในคลังที่เลือก ณ ตอนนี้ (ใช้เป็น "ยอดตอนเริ่มนับ" ของรอบนับ)
export function snapshotSystemQty(state: AppState, productId: string, warehouseId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of Object.values(state.variants)) {
    if (v.productId !== productId) continue;
    out[v.id] = state.variantStock[`${v.id}::${warehouseId}`]?.qtyOnHand ?? 0;
  }
  return out;
}
