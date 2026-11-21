import { describe, it, expect } from "vitest";
import { averageBaseline } from "./productionPlan";

const r = (month: string, productId: string, color: string, size: string, qty: number) => ({ month, productId, color, size, qty });

describe("averageBaseline (เฉลี่ยยอดขายอ้างอิงหลายเดือน)", () => {
  it("หารด้วยจำนวนเดือนของรุ่น เดือนที่สี/ไซซ์ไม่มีแถวนับเป็น 0", () => {
    const rows = [r("2026-01", "p", "ดำ", "M", 30), r("2026-01", "p", "ดำ", "L", 10), r("2026-02", "p", "ดำ", "M", 0), r("2026-03", "p", "ดำ", "L", 20)];
    const out = averageBaseline(rows, ["2026-01", "2026-02", "2026-03"]);
    const get = (c: string, s: string) => out.find((x) => x.color === c && x.size === s)?.qty;
    expect(get("ดำ", "M")).toBe(10); // (30+0+0)/3
    expect(get("ดำ", "L")).toBeCloseTo(10, 5); // (10+0+20)/3
  });

  it("รุ่นที่เพิ่งมียอดในบางเดือน หารด้วยเฉพาะเดือนที่รุ่นนั้นมีข้อมูล", () => {
    const rows = [r("2026-01", "a", "ดำ", "M", 20), r("2026-02", "a", "ดำ", "M", 40), r("2026-02", "b", "ขาว", "S", 30)];
    const out = averageBaseline(rows, ["2026-01", "2026-02"]);
    expect(out.find((x) => x.productId === "a")?.qty).toBe(30);
    expect(out.find((x) => x.productId === "b")?.qty).toBe(30); // รุ่น b มีเดือนเดียว ไม่ถูกหาร 2
  });

  it("นับเฉพาะเดือนที่เลือก", () => {
    const rows = [r("2026-01", "p", "ดำ", "M", 100), r("2026-02", "p", "ดำ", "M", 10), r("2026-03", "p", "ดำ", "M", 20)];
    expect(averageBaseline(rows, ["2026-02", "2026-03"])[0].qty).toBe(15);
  });
});
