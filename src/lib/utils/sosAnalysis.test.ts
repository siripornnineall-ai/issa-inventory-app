import { describe, it, expect } from "vitest";
import { buildAdvice, buildPnL, modelOfDescription, stockMatrices } from "./sosAnalysis";
import { compareSizes } from "./sizes";

const branches = [
  { id: "b1", name: "NEW SOS SIAM", rent_monthly: null },
  { id: "b2", name: "SOS MEGA", rent_monthly: 10000 },
];
const imports = [
  { id: "i1", branch_id: "b1", period_start: "2026-09-01", period_end: "2026-09-30", stock_as_of: "2026-10-01", file_name: "a.xls" },
  { id: "i2", branch_id: "b2", period_start: "2026-09-01", period_end: "2026-09-30", stock_as_of: "2026-10-01", file_name: "b.xls" },
];
const summaries = [
  { import_id: "i1", sales_total: 13400, gp: 670, other_fees: 289.2, received_ex_vat: 12467.69, main_qty: 20, main_net: 13400, credit_qty: 15, credit_net: 9640, main_cogs: 3800 },
  { import_id: "i2", sales_total: 34570, gp: 5185.5, other_fees: 606.9, received_ex_vat: 28940, main_qty: 48, main_net: 34570, credit_qty: 28, credit_net: 20230, main_cogs: 9600 },
];

describe("กำไร/ขาดทุนรายสาขา", () => {
  it("กำไรก่อนค่าเช่า = ยอดที่ได้รับ - ต้นทุน และกำไรสุทธิ = หักค่าเช่า (ไม่กรอกค่าเช่า = ยังไม่คำนวณสุทธิ)", () => {
    const rows = buildPnL(branches, imports, summaries);
    const siam = rows.find((r) => r.branchName === "NEW SOS SIAM")!;
    expect(siam.profitBeforeRent).toBeCloseTo(12467.69 - 3800, 2);
    expect(siam.rent).toBeNull();
    expect(siam.netProfit).toBeNull();
    expect(siam.gpPct).toBe(5);
    expect(siam.creditQty).toBe(15);
    const mega = rows.find((r) => r.branchName === "SOS MEGA")!;
    expect(mega.profitBeforeRent).toBe(28940 - 9600);
    expect(mega.netProfit).toBe(28940 - 9600 - 10000);
    expect(mega.gpPct).toBe(15);
  });

  it("เรียงงวดใหม่ก่อน และข้ามรายการนำเข้าที่ไม่มีสรุป", () => {
    const more = [...imports, { id: "i3", branch_id: "b1", period_start: "2026-10-01", period_end: "2026-10-31", stock_as_of: null, file_name: null }];
    expect(buildPnL(branches, more, summaries)).toHaveLength(2);
    const withSummary = [...summaries, { ...summaries[0], import_id: "i3" }];
    expect(buildPnL(branches, more, withSummary)[0].periodStart).toBe("2026-10-01");
  });
});

const P = (name: string) => `${name} ทรงกระบอกเล็ก black M`;
describe("แนะนำ SKU", () => {
  const stock = [
    { code: "OLD", description: P("Old Model"), qty: 4 }, // มีของ ไม่ขาย -> ถอน
    { code: "SOLDOUT", description: P("Hot Model"), qty: 0 }, // ขายแล้วหมด -> เติม
    { code: "OK", description: P("Fine Model"), qty: 2 },
  ];
  const sales = [
    { code: "SOLDOUT", description: P("Hot Model"), qty: 5 },
    { code: "OK", description: P("Fine Model"), qty: 1 },
  ];
  const other = [
    { code: "NEWHOT", description: P("Other Hot"), qty: 3 },
    { code: "NEWLOW", description: P("Other Low"), qty: 1 },
  ];

  it("เติมของที่ขายแล้วหมด / เพิ่มรายการที่ขายดีสาขาอื่น / ถอนของที่ไม่ขายเลย", () => {
    const a = buildAdvice({ sales, stock, otherBranchSales: other, feedback: [] });
    expect(a.restock.map((x) => x.code)).toEqual(["SOLDOUT"]);
    expect(a.restock[0].qty).toBe(3); // ขาย 5 แนะนำเติมไม่เกิน 3
    expect(a.addNew.map((x) => x.code)).toEqual(["NEWHOT"]); // ขายที่อื่นอย่างน้อย 2 ชิ้นเท่านั้น
    expect(a.remove.map((x) => x.code)).toEqual(["OLD"]);
    expect(a.removePieces).toBe(4);
  });

  it("เพิ่มได้ไม่เกินโควตาสุทธิ (+capacity รวมจำนวนที่ถอน) รายการที่เกินไปอยู่ในรายการข้าม", () => {
    const a = buildAdvice({ sales, stock: [{ code: "SOLDOUT", description: P("Hot Model"), qty: 0 }], otherBranchSales: other, feedback: [], capacity: 3 });
    expect(a.restock).toHaveLength(1); // ใช้โควตา 3 หมด
    expect(a.addNew).toHaveLength(0);
    expect(a.skippedOverCapacity.map((x) => x.code)).toEqual(["OK", "NEWHOT"]); // OK ขายได้ 1 แต่ไม่ได้ส่งสต็อกเข้ามาในกรณีนี้ จึงถูกนับว่าของหมด
    expect(a.addPieces).toBe(3);
  });

  it("ถอนของออกแล้วเพิ่มได้อีกเท่าที่ถอน", () => {
    const a = buildAdvice({ sales, stock, otherBranchSales: other, feedback: [], capacity: 0 });
    expect(a.removePieces).toBe(4);
    expect(a.addPieces).toBe(4); // เติม 3 + เพิ่มรายการใหม่ 1 ภายใน 0 + 4
  });

  it("feedback ใช้ประกอบเท่านั้น: เตือนก่อนถอนถ้าทีมขายบอกขายดี แต่ไม่เปลี่ยนว่าเป็นรายการถอน", () => {
    const a = buildAdvice({ sales, stock, otherBranchSales: other, feedback: [{ kind: "good", note: "ลูกค้าถามหาบ่อย", product_name: "Old Model" }] });
    expect(a.remove.map((x) => x.code)).toEqual(["OLD"]);
    expect(a.remove[0].caution).toContain("ตรวจก่อนถอน");
    expect(a.remove[0].notes).toEqual(["ลูกค้าถามหาบ่อย"]);
  });

  it("ควรถอนมี 2 ระดับ: ทั้งรุ่นไม่ขายเลย (strong) กับ รุ่นขายอยู่แต่สี/ไซซ์ไม่ขยับ (weak, มีของตั้งแต่ 2 ชิ้น) ส่วนมีของ 1 ชิ้นในรุ่นที่ขายอยู่ไม่แนะนำถอน", () => {
    const a = buildAdvice({
      sales: [{ code: "S1", description: "Hot Model ทรงกระบอกเล็ก black M", qty: 4 }],
      stock: [
        { code: "S1", description: "Hot Model ทรงกระบอกเล็ก black M", qty: 1 },
        { code: "W2", description: "Hot Model ทรงกระบอกเล็ก grey XL", qty: 2 }, // weak
        { code: "W1", description: "Hot Model ทรงกระบอกเล็ก grey S", qty: 1 }, // ไม่แนะนำ
        { code: "ST", description: "Dead Model ทรงกระบอกเล็ก black M", qty: 1 }, // strong แม้มีของ 1 ชิ้น
      ],
      otherBranchSales: [],
      feedback: [],
    });
    expect(a.remove.map((x) => [x.code, x.strength])).toEqual([["ST", "strong"], ["W2", "weak"]]);
  });

  it("ค่าส่ง (EMS) ไม่นับเป็นสินค้าที่ต้องเติม/ถอน และสต็อกติดลบไม่นับเป็นของที่มี", () => {
    const a = buildAdvice({ sales: [{ code: "EMS", description: "EMS Issa อื่นๆ", qty: 9 }], stock: [{ code: "NEG", description: P("Neg Model"), qty: -1 }], otherBranchSales: [], feedback: [] });
    expect(a.restock).toHaveLength(0);
    expect(a.remove).toHaveLength(0);
  });
});

describe("ตารางสต็อกสี x ไซซ์", () => {
  it("ชื่อรุ่น = คำก่อนภาษาไทยตัวแรก และจัดตารางตามสี/ไซซ์ (สีแปลที่อ่านไม่ได้ไปรายการอื่น)", () => {
    expect(modelOfDescription("Billie Slim ทรงกระบอกเล็ก brown M")).toBe("Billie Slim");
    const { matrices, other } = stockMatrices(
      [
        { code: "1", description: "Billie Slim ทรงกระบอกเล็ก black M", qty: 3 },
        { code: "2", description: "Billie Slim ทรงกระบอกเล็ก black XL", qty: 2 },
        { code: "3", description: "Billie Slim ทรงกระบอกเล็ก grey M", qty: 1 },
        { code: "4", description: "เข็มขัดหนัง Cacia belt brown ยาว 95 cm", qty: 5 },
      ],
      compareSizes
    );
    expect(matrices).toHaveLength(1);
    expect(matrices[0]).toMatchObject({ model: "Billie Slim", total: 6, sizes: ["M", "XL"] });
    expect(matrices[0].colors[0]).toMatchObject({ color: "ดำ", total: 5 });
    expect(other.map((o) => o.code)).toEqual(["4"]);
  });
});
