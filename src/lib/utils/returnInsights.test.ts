import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { returnSummary, trendGrainFor } from "./returnSummary";
import { buildActions } from "./returnInsights";

const NOW = Date.now();
const DATE = new Date(NOW).toISOString();
const RANGE = { from: NOW - 30 * 86400000, to: NOW + 86400000 };

function seed(returnsOfSize: number, sold = 20) {
  const ids = { brandA: "", brandB: "", slim: "", slimVar: "", wendyVar: "" };
  const state = produce(emptyState(), (d) => {
    const wh = engine.upsertWarehouse(d, { name: "คลังหลัก", type: "main" });
    ids.brandA = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    ids.brandB = engine.upsertBrand(d, { name: "Fasonaf", code: "FS" });
    ids.slim = engine.createProduct(d, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกง", status: "active", images: [], brandId: ids.brandA });
    const wendy = engine.createProduct(d, { sellingName: "Wendy Mid", sellingPrice: 1290, category: "กางเกง", status: "active", images: [], brandId: ids.brandB });
    ids.slimVar = engine.addVariant(d, ids.slim, { color: "ดำ", size: "XL", purchasePrice: 400, sellingPrice: 1090 });
    ids.wendyVar = engine.addVariant(d, wendy, { color: "ดำ", size: "XL", purchasePrice: 400, sellingPrice: 1290 });
    engine.stockIn(d, { itemType: "product", date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "รับ", lines: [{ itemId: ids.slimVar, qty: 100 }, { itemId: ids.wendyVar, qty: 100 }] });
    engine.stockOut(d, { itemType: "product", date: DATE, warehouseId: wh, reasonType: "sale", actorId: "u1", actorName: "ขาย", channel: "shopee", lines: [{ itemId: ids.slimVar, qty: sold }, { itemId: ids.wendyVar, qty: sold }] });
    const base = { date: DATE, warehouseId: wh, receivedBy: "u1", receivedByName: "คืน" };
    if (returnsOfSize > 0) engine.stockReturn(d, { ...base, returnType: "return_customer", channel: "shopee", lines: [{ itemId: ids.slimVar, qty: returnsOfSize, unitPrice: 1000, reason: "size" }] });
    engine.stockReturn(d, { ...base, returnType: "return_defective", channel: "shopee", lines: [{ itemId: ids.wendyVar, qty: 1, unitPrice: 1290, reason: "defect" }] });
  });
  return { state, ...ids };
}

describe("สรุป 'ควรทำอะไรต่อ'", () => {
  it("ของคืนน้อยกว่า 5 ชิ้น: บอกว่าข้อมูลยังน้อย ไม่สรุปเกินจริง", () => {
    const { state } = seed(2); // รวม 3 ชิ้น
    const a = buildActions(returnSummary(state, RANGE));
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe("few");
  });

  it("ไม่มีของคืน: ไม่มีข้อสรุป", () => {
    expect(buildActions(returnSummary(emptyState(), RANGE))).toEqual([]);
  });

  it("เหตุผลเดียวกันเกิน 40% และรุ่นที่คืนสูง: แนะนำให้ตรวจตารางไซซ์ และปุ่มดูรายการชี้ไปเหตุผล/รุ่นนั้น", () => {
    const { state, slim } = seed(8, 20); // Billie Slim คืน 8 จากขาย 20 = 40%
    const s = returnSummary(state, RANGE);
    const a = buildActions(s);
    const reason = a.find((x) => x.id === "reason-size")!;
    expect(reason.level).toBe("high");
    expect(reason.todo).toContain("ตารางไซซ์");
    expect(reason.drill).toEqual({ reasonCode: "size" });
    const prod = a.find((x) => x.id === `product-${slim}`)!;
    expect(prod.title).toContain("Billie Slim");
    expect(prod.drill).toEqual({ productId: slim });
    expect(a[0].level).toBe("high"); // เรียงเรื่องด่วนก่อน
  });

  it("แยกตามแบรนด์: ข้อสรุปของแบรนด์ที่ไม่มีปัญหาไม่ปนกับแบรนด์ที่มี", () => {
    const { state, brandA, brandB } = seed(8, 20);
    const fas = buildActions(returnSummary(state, { ...RANGE, brandId: brandB }));
    expect(fas.map((x) => x.id)).toEqual(["few"]); // Fasonaf คืนแค่ 1 ชิ้น
    const iss = buildActions(returnSummary(state, { ...RANGE, brandId: brandA }));
    expect(iss.some((x) => x.id === "reason-size")).toBe(true);
  });
});

describe("ตัวกรองเจาะรายละเอียดและแนวโน้ม", () => {
  it("กรองตามเหตุผลและรุ่น ยอดขายเทียบเฉพาะรุ่นที่เลือก", () => {
    const { state, slim } = seed(8, 20);
    const bySize = returnSummary(state, { ...RANGE, reasonCode: "size" });
    expect(bySize.pieces).toBe(8);
    const byProduct = returnSummary(state, { ...RANGE, productId: slim });
    expect(byProduct.pieces).toBe(8);
    expect(byProduct.salesPieces).toBe(20);
    expect(byProduct.byProduct[0].salesPieces).toBe(20);
  });

  it("แนวโน้มรวมยอดเท่ากับของคืนทั้งหมด และเลือกความละเอียดตามความยาวช่วง", () => {
    const { state } = seed(8, 20);
    const s = returnSummary(state, RANGE);
    expect(s.trendGrain).toBe("day");
    expect(s.trend.reduce((sum, p) => sum + p.pieces, 0)).toBe(s.pieces);
    expect(s.trend.reduce((sum, p) => sum + p.byType.return_customer, 0)).toBe(8);
    expect(trendGrainFor(0, 30 * 86400000)).toBe("day");
    expect(trendGrainFor(0, 90 * 86400000)).toBe("week");
    expect(trendGrainFor(0, 365 * 86400000)).toBe("month");
  });
});
