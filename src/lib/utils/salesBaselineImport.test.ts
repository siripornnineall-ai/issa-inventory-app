import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";
import { matchBaseline, parseBaselineCsv, parseCsv } from "./salesBaselineImport";

const CSV = [
  ",,,,",
  "1 month,จากข้อมูลล่าสุด,,,",
  "สต๊อกยอดขาย,,,,",
  "B Slim,S,M,รวมจำนวนต่อสี,",
  "ดำ,35,85,120,51.27%",
  "โอวันติน,1,7,8,4.10%",
  "ม่วง,,,0,",
  "เขียวขี้ม้า,#REF!,3,3,",
  'รวมจำนวนต่อไซส์,36,95,"1,024",',
  ",,,,",
  "Wendy / Vicky,S,M,รวมจำนวนต่อสี",
  "ดำ,0,10,10",
  "รวมจำนวนต่อไซส์,0,10,10",
  "ยอดขาย7 เดือน,,,",
  "Justin WIde,S,M,รวมจำนวนต่อสี",
  "ฟ้า,7,14,21",
  "Unknown Model,S,รวมจำนวนต่อสี",
  "ดำ,5,5",
  "รวมจำนวนต่อไซส์,5,5",
  " B.C สั่งตัด,,,",
  "Vicky Slim,S,รวมจำนวนต่อสี",
  "ดำ,#REF!,#REF!",
].join("\n");

function seed() {
  const ids = { slimBlkM: "", slimOvaM: "", wendyBlkM: "", justinBlueM: "" };
  const state = produce(emptyState(), (d) => {
    const brand = engine.upsertBrand(d, { name: "ISSA Apparel", code: "IS" });
    const mk = (name: string) => engine.createProduct(d, { sellingName: name, sellingPrice: 1000, category: "กางเกง", status: "active", images: [], brandId: brand });
    const slim = mk("Billie Slim");
    const wendy = mk("Wendy Mid");
    const justin = mk("Justin Wide");
    const v = (p: string, color: string, size: string) => engine.addVariant(d, p, { color, size, purchasePrice: 400, sellingPrice: 1000 });
    v(slim, "ดำ", "S");
    ids.slimBlkM = v(slim, "ดำ", "M");
    v(slim, "โอวัลติน", "S");
    ids.slimOvaM = v(slim, "โอวัลติน", "M");
    ids.wendyBlkM = v(wendy, "ดำ", "M");
    ids.justinBlueM = v(justin, "ฟ้า", "M");
  });
  return { state, ...ids };
}

describe("อ่านไฟล์ยอดขายรายเดือน (CSV)", () => {
  it("parseCsv รองรับเครื่องหมายคำพูด/ตัวเลขมีจุลภาค", () => {
    expect(parseCsv('a,"1,024",c\nx,y,z')).toEqual([["a", "1,024", "c"], ["x", "y", "z"]]);
  });

  it("แยกบล็อกต่อรุ่น ข้ามสีที่เป็น 0/ว่าง/#REF! ข้ามแถวรวม และหยุดที่ 'สั่งตัด'", () => {
    const blocks = parseBaselineCsv(CSV);
    expect(blocks.map((b) => b.label)).toEqual(["B Slim", "Wendy / Vicky", "Justin WIde", "Unknown Model"]);
    expect(blocks[0].rows).toEqual([
      { color: "ดำ", size: "S", qty: 35 },
      { color: "ดำ", size: "M", qty: 85 },
      { color: "โอวันติน", size: "S", qty: 1 },
      { color: "โอวันติน", size: "M", qty: 7 },
      { color: "เขียวขี้ม้า", size: "M", qty: 3 },
    ]);
    expect(blocks[0].months).toBe(1);
    expect(blocks[2].months).toBe(7); // "ยอดขาย7 เดือน"
  });

  it("จับคู่รุ่นตามชื่อที่เจ้าของงานยืนยัน หารยอดหลายเดือนเป็นต่อเดือน แปลงชื่อสี และรายงานที่จับคู่ไม่ได้", () => {
    const { state } = seed();
    const m = matchBaseline(state, parseBaselineCsv(CSV));
    const get = (name: string, color: string, size: string) => m.rows.find((r) => r.productName === name && r.color === color && r.size === size)?.qty;
    expect(get("Billie Slim", "ดำ", "M")).toBe(85);
    expect(get("Billie Slim", "โอวัลติน", "M")).toBe(7); // โอวันติน -> โอวัลติน
    expect(get("Wendy Mid", "ดำ", "M")).toBe(10);
    expect(get("Justin Wide", "ฟ้า", "M")).toBe(2); // 14 ชิ้น / 7 เดือน
    expect(m.unmatchedModels).toEqual(["Unknown Model"]);
    expect(m.unmatchedCells.map((c) => `${c.color}${c.size}`)).toEqual(["เขียวขี้ม้าM", "ฟ้าS"]);
  });
});
