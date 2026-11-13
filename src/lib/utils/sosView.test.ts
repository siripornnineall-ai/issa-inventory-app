import { describe, it, expect } from "vitest";
import { emptyState } from "@/lib/store/state";
import { adviceRows, skuMatrix, branchTotals, describeLine, latestImportPerBranch, periodsOf, rankModels, selectImports, selectedPeriods, sellThrough } from "./sosView";
import type { BranchMonthPnL } from "./sosAnalysis";

const imp = (id: string, branch: string, start: string) => ({ id, branch_id: branch, period_start: start, period_end: start, stock_as_of: null, file_name: null });
const imports = [imp("a1", "b1", "2026-09-01"), imp("a2", "b2", "2026-09-01"), imp("a3", "b1", "2026-10-01"), imp("a4", "b2", "2026-10-01"), imp("a5", "b3", "2026-10-01")];

describe("เลือกช่วงเวลา/สาขา", () => {
  it("เดือนล่าสุด / 2 เดือนล่าสุด / เฉพาะเดือนที่เลือก", () => {
    expect(periodsOf(imports)).toEqual(["2026-10-01", "2026-09-01"]);
    expect(selectedPeriods(imports, "latest")).toEqual(["2026-10-01"]);
    expect(selectedPeriods(imports, "last2")).toEqual(["2026-10-01", "2026-09-01"]);
    expect(selectedPeriods(imports, "2026-09-01")).toEqual(["2026-09-01"]);
    expect(selectedPeriods(imports, "2099-01-01")).toEqual(["2026-10-01"]); // ไม่มีเดือนนั้น = เดือนล่าสุด
  });

  it("กรองสาขาพร้อมช่วงเวลา และหาไฟล์ล่าสุดของแต่ละสาขา", () => {
    expect(selectImports(imports, "", "latest").map((i) => i.id)).toEqual(["a3", "a4", "a5"]);
    expect(selectImports(imports, "b1", "last2").map((i) => i.id)).toEqual(["a1", "a3"]);
    const latest = latestImportPerBranch(selectImports(imports, "", "last2"));
    expect(Object.fromEntries(latest.map((i) => [i.branch_id, i.id]))).toEqual({ b1: "a3", b2: "a4", b3: "a5" });
  });
});

const state = () =>
  ({
    ...emptyState(),
    products: { p1: { id: "p1", sellingName: "Billie Slim", status: "active", images: [] } },
    variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "A", active: true } },
  }) as never;

const line = (branch: string, code: string, description: string, qty: number, net: number, variant: string | null = null) => ({ branch_id: branch, sos_code: code, description, qty, net, variant_id: variant });

describe("จัดอันดับยอดขาย (ลงถึงสี/ไซซ์)", () => {
  it("ใช้ชื่อรุ่น/สี/ไซซ์ของเราเมื่อจับคู่ได้ ไม่งั้นอ่านจากคำอธิบายของ SOS", () => {
    expect(describeLine(state(), { variant_id: "v1", description: "อะไรก็ได้", sos_code: "X" })).toMatchObject({ model: "Billie Slim", label: "ดำ / M" });
    expect(describeLine(state(), { variant_id: null, description: "Wendy Mid ทรงกระบอกกลาง navy XL", sos_code: "Y" })).toMatchObject({ model: "Wendy Mid", color: "กรม", size: "XL", label: "กรม / XL" });
  });

  it("เรียงรุ่นตามชิ้น (ถ้าเท่ากันตามยอดเงิน) มีสัดส่วน อันดับ รายสาขา และสี/ไซซ์ย่อย", () => {
    const lines = [
      line("b1", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 2, 1290),
      line("b2", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 1, 645),
      line("b1", "C2", "Billie Wide ทรงกระบอกใหญ่ navy L", 1, 690),
      line("b1", "C3", "Wendy Mid ทรงกระบอกกลาง white L", 4, 2760),
      line("b1", "C4", "Wendy Mid ทรงกระบอกกลาง white M", 0, 0), // ไม่นับ (จำนวน 0)
    ];
    const ranks = rankModels(state(), lines);
    expect(ranks.map((r) => [r.rank, r.model, r.qty])).toEqual([
      [1, "Wendy Mid", 4],
      [2, "Billie Wide", 4],
    ]);
    expect(ranks[0].sharePct).toBe(50);
    const bw = ranks[1];
    expect(bw.byBranch).toEqual({ b1: 3, b2: 1 });
    expect(bw.skus[0]).toMatchObject({ label: "ดำ / XL", qty: 3, byBranch: { b1: 2, b2: 1 } });
    expect(bw.skus).toHaveLength(2);
  });
});

describe("ขายแล้ว เทียบกับของที่มี", () => {
  it("ค้าง = มีของ 5 ชิ้นขึ้นไปแต่ไม่ขาย / ใกล้หมด = ของเหลือน้อยกว่าที่ขาย / อื่นๆ ปกติ", () => {
    const sales = [line("b1", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 3, 1)];
    const stock = [line("b1", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 1, 0), line("b1", "C7", "Old Model ทรงกระบอกเล็ก black M", 6, 0), line("b1", "C8", "Calm Model ทรงกระบอกเล็ก black M", 2, 0)];
    const out = Object.fromEntries(sellThrough(state(), sales, stock).map((r) => [r.model, r.status]));
    expect(out).toEqual({ "Billie Wide": "low", "Old Model": "stuck", "Calm Model": "ok" });
  });

  it("แยกจำนวนของที่มีรายสาขา (ใช้ทำคอลัมน์ต่อสาขาในตารางสต็อก)", () => {
    const stock = [line("b1", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 3, 0), line("b2", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 2, 0), line("b2", "C2", "Billie Wide ทรงกระบอกใหญ่ navy L", 4, 0)];
    const r = sellThrough(state(), [], stock)[0];
    expect(r).toMatchObject({ model: "Billie Wide", stock: 9, stockByBranch: { b1: 3, b2: 6 } });
  });
});

describe("สรุปรายสาขาหลายเดือน", () => {
  const row = (id: string, branch: string, name: string, start: string, received: number, cogs: number, rent: number | null): BranchMonthPnL => ({
    importId: id, branchId: branch, branchName: name, periodStart: start, periodEnd: start, pieces: 10, salesTotal: 100, gp: 10, gpPct: 10, otherFees: 1, received, cogs, profitBeforeRent: received - cogs, rent, netProfit: rent === null ? null : received - cogs - rent, creditQty: 5, creditNet: 50,
  });
  it("รวมหลายเดือนต่อสาขา ค่าเช่า = ค่าเช่าต่อเดือน x จำนวนเดือน เรียงตามกำไรมากไปน้อย", () => {
    const t = branchTotals([
      row("1", "b1", "MEGA", "2026-10-01", 1000, 400, 300),
      row("2", "b1", "MEGA", "2026-09-01", 900, 300, 300),
      row("3", "b2", "SIAM", "2026-10-01", 5000, 1000, null),
    ]);
    expect(t.map((x) => x.branchName)).toEqual(["SIAM", "MEGA"]); // กำไร 4000 > สุทธิของ MEGA 800
    const mega = t.find((x) => x.branchName === "MEGA")!;
    expect(mega).toMatchObject({ months: 2, pieces: 20, received: 1900, cogs: 700, profitBeforeRent: 1200, rentTotal: 600, netProfit: 600, creditQty: 10, creditNet: 100 });
    expect(t.find((x) => x.branchName === "SIAM")).toMatchObject({ rentTotal: null, netProfit: null });
  });
});

describe("ตารางสี x ไซซ์ของยอดขายรุ่นหนึ่ง", () => {
  const sku = (key: string, color: string, size: string, qty: number) => ({ key, label: `${color} / ${size}`, color, size, qty, net: qty * 690, byBranch: {} });
  it("จัดเป็นตาราง สีเรียงตามลำดับสี (ดำ กรม ... ไม่ตามยอด) ไซซ์เรียง S ถึง 9XL มีรวมแถว/คอลัมน์", () => {
    const m = skuMatrix([sku("1", "ครีม", "XL", 5), sku("2", "ดำ", "XL", 2), sku("3", "ดำ", "S", 1), sku("4", "กรม", "2XL", 1), sku("5", "ดำ", "XL", 1)]);
    expect(m.sizes).toEqual(["S", "XL", "2XL"]);
    expect(m.rows.map((r) => r.color)).toEqual(["ดำ", "กรม", "ครีม"]);
    expect(m.rows[0]).toMatchObject({ color: "ดำ", total: 4, cells: { S: 1, XL: 3 } });
    expect(m.sizeTotals).toEqual({ S: 1, XL: 8, "2XL": 1 });
    expect(m.max).toBe(5);
  });
  it("ใช้ลำดับสีของรุ่นถ้าตั้งไว้ และเก็บรายการอ่านสี/ไซซ์ไม่ได้แยกไว้", () => {
    const m = skuMatrix([sku("1", "ดำ", "M", 1), sku("2", "ครีม", "M", 1), { ...sku("3", "", "", 2), label: "เสื้อ Free" }], { colorOrder: ["ครีม", "ดำ"] });
    expect(m.rows.map((r) => r.color)).toEqual(["ครีม", "ดำ"]);
    expect(m.other.map((o) => o.key)).toEqual(["3"]);
  });
});

describe("คำแนะนำเป็นตารางเดียว (รวมเป็นรุ่น)", () => {
  const item = (code: string, description: string, qty: number, extra: Record<string, unknown> = {}) => ({ code, description, qty, notes: [] as string[], ...extra });
  it("รวมสี/ไซซ์ของรุ่นเดียวกันเป็นแถวเดียว เรียง เติม > เพิ่มใหม่ > ถอน (ถอนก่อนก่อน) และใช้ชื่อสีไทยของเรา", () => {
    const st = {
      ...emptyState(),
      products: { p1: { id: "p1", sellingName: "Billie Wide", status: "active", images: [] } },
      variants: { v1: { id: "v1", productId: "p1", color: "ดำ", size: "S", sku: "A", active: true } },
    } as never;
    const rows = adviceRows(
      st,
      {
        restock: [item("R1", "Billie Wide ทรงกระบอกใหญ่ black S", 3), item("R2", "Billie Wide ทรงกระบอกใหญ่ black M", 1)],
        addNew: [item("N1", "Snow Mid กระบอกกลาง khaki L", 1)],
        remove: [item("W1", "Wendy Mid ทรงกระบอกกลาง grey S", 2, { strength: "weak" }), item("S1", "Old Model ทรงกระบอกเล็ก black M", 4, { strength: "strong", notes: ["ลูกค้าถามหา"], caution: "ตรวจก่อนถอน" })],
      },
      { R1: "v1" }
    );
    expect(rows.map((r) => [r.action, r.model, r.qty])).toEqual([
      ["restock", "Billie Wide", 4],
      ["addNew", "Snow Mid", 1],
      ["remove", "Old Model", 4], // strong ก่อน weak
      ["remove", "Wendy Mid", 2],
    ]);
    expect(rows[0].cells).toEqual([{ label: "ดำ / S", qty: 3 }, { label: "ดำ / M", qty: 1 }]);
    expect(rows[2]).toMatchObject({ strong: true, caution: true, notes: ["ลูกค้าถามหา"] });
  });

  it("ค่าส่ง (EMS) ไม่นับในอันดับขายดี และไม่นับในสถานะรายรุ่น", () => {
    const sales = [line("b1", "E1", "EMS Issa อื่นๆ", 3, 150), line("b1", "C1", "Billie Wide ทรงกระบอกใหญ่ black XL", 1, 690)];
    expect(rankModels(state(), sales).map((r) => r.model)).toEqual(["Billie Wide"]);
    expect(sellThrough(state(), sales, sales).map((r) => r.model)).toEqual(["Billie Wide"]);
  });
});
