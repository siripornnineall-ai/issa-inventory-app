import { checkUnitTokenScan } from "@/lib/store/engine";
import type { UnitToken, UnitTokenAction } from "@/lib/types";

// ตอนกู้ร่างที่สแกนค้างไว้: ป้ายบางใบอาจถูกเครื่องอื่นบันทึกไปแล้วระหว่างนั้น ต้องเช็กซ้ำกับข้อมูลล่าสุด
// ใบที่ใช้ไม่ได้แล้วตัดออกพร้อมลดจำนวนในรายการลง ไม่งั้นกดบันทึกแล้วสต็อกขยับแต่ป้ายถูกปฏิเสธทีหลัง
// ป้ายที่เครื่องนี้ยังไม่มีข้อมูล (ไม่อยู่ใน state) เก็บไว้ก่อน ตอนบันทึกจริงระบบเช็กซ้ำอีกชั้น
export function pruneRestoredTokens<L extends { variantId: string; qty: number }>(
  unitTokens: Record<string, UnitToken>,
  scanned: Record<string, string[]>,
  lines: L[],
  action: UnitTokenAction
): { scanned: Record<string, string[]>; lines: L[]; dropped: number } {
  let dropped = 0;
  const nextScanned: Record<string, string[]> = {};
  const droppedByVariant: Record<string, number> = {};
  for (const [variantId, ids] of Object.entries(scanned)) {
    const kept: string[] = [];
    for (const id of ids) {
      const token = unitTokens[id];
      if (token && !checkUnitTokenScan(unitTokens, id, action).ok) {
        dropped += 1;
        droppedByVariant[variantId] = (droppedByVariant[variantId] ?? 0) + 1;
      } else {
        kept.push(id);
      }
    }
    if (kept.length > 0) nextScanned[variantId] = kept;
  }
  const nextLines = lines
    .map((l) => ({ ...l, qty: l.qty - (droppedByVariant[l.variantId] ?? 0) }))
    .filter((l) => l.qty > 0);
  return { scanned: nextScanned, lines: nextLines, dropped };
}
