import type { AppState } from "@/lib/store/state";

// โรงงาน BC: ตัวที่ตัดเป็นชิ้นแล้วแต่ยังไม่ได้เย็บ (ไม่ใช่สต็อกสินค้า ขายไม่ได้ ไม่รวมในสต็อกรวม/แดชบอร์ด)
// ยอดคงเหลือ "ยังไม่เย็บ" ต่อสี/ไซซ์ = ผลรวมสมุดบันทึกโรงงาน (ยอดตั้งต้น + ตัดเข้า ± ปรับยอด - เสียหาย)
//                                  - จำนวนที่รับเข้าสต็อกแบบ "เย็บเสร็จจากโรงงาน BC" ในใบรับเข้าที่ไม่ถูกยกเลิก
// คิดจากใบรับเข้าโดยตรง (ไม่มีรายการหักแยก) จึงไม่ค้างครึ่งทาง และยกเลิกใบรับเข้าแล้วยอดกลับมาเอง ติดลบได้ (รับมากกว่าที่บันทึกตัด)

export function wipSewnFromStockIns(state: AppState): Map<string, number> {
  const used = new Map<string, number>();
  for (const doc of Object.values(state.stockInDocs)) {
    if (doc.status === "cancelled" || doc.itemType !== "product") continue;
    for (const line of doc.lines) {
      if (!line.fromWip) continue;
      used.set(line.itemId, (used.get(line.itemId) ?? 0) + line.qty);
    }
  }
  return used;
}

export function wipLedgerByVariant(state: AppState): Map<string, number> {
  const sum = new Map<string, number>();
  for (const e of Object.values(state.factoryWipEntries ?? {})) sum.set(e.variantId, (sum.get(e.variantId) ?? 0) + e.qtyChange);
  return sum;
}

// ยอดยังไม่เย็บของทุกตัวเลือก (เฉพาะตัวที่มีบันทึกหรือเคยรับแบบเย็บเสร็จ)
export function wipBalances(state: AppState): Map<string, number> {
  const balance = new Map(wipLedgerByVariant(state));
  for (const [variantId, qty] of wipSewnFromStockIns(state)) balance.set(variantId, (balance.get(variantId) ?? 0) - qty);
  return balance;
}

export interface WipProductSummary {
  productId: string;
  name: string;
  brandId?: string;
  total: number; // ยังไม่เย็บรวม (ติดลบได้ถ้ารับเข้ามากกว่าที่บันทึก)
  negativeCells: number;
  variants: { variantId: string; color: string; size: string; qty: number }[];
}

// รวมตามรุ่น เฉพาะรุ่นที่มีบันทึกโรงงานอย่างน้อยหนึ่งรายการ (เรียงชื่อรุ่น)
export function wipByProduct(state: AppState): WipProductSummary[] {
  const balance = wipBalances(state);
  const ledger = wipLedgerByVariant(state);
  const byProduct = new Map<string, WipProductSummary>();
  for (const [variantId, qty] of balance) {
    // ตัวเลือกที่ไม่มีบันทึกโรงงานเลยแต่ถูกรับแบบเย็บเสร็จ แสดงด้วย (ยอดติดลบ) เพื่อให้เห็นว่าบันทึกตัดไม่ครบ
    if (qty === 0 && !ledger.has(variantId)) continue;
    const v = state.variants[variantId];
    const p = v ? state.products[v.productId] : undefined;
    if (!v || !p) continue;
    const cur = byProduct.get(p.id) ?? { productId: p.id, name: p.sellingName, brandId: p.brandId, total: 0, negativeCells: 0, variants: [] };
    cur.total += qty;
    if (qty < 0) cur.negativeCells += 1;
    cur.variants.push({ variantId, color: v.color ?? "", size: v.size ?? "", qty });
    byProduct.set(p.id, cur);
  }
  return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}
