import { describe, expect, it } from "vitest";
import { resolveColorCode, suggestColorCode } from "./ids";

describe("suggestColorCode", () => {
  it("สีในพจนานุกรมได้ตัวย่อ ไม่มีเลข", () => {
    expect(suggestColorCode("ดำ")).toBe("BLK");
    expect(suggestColorCode("เขียวมิ้นท์")).toBe("GMT");
    expect(suggestColorCode("มิ้นท์")).toBe("MNT");
    expect(suggestColorCode("มินท์")).toBe("MNT");
    expect(suggestColorCode("เทาอ่อน")).toBe("LGY");
  });

  it("ชื่อประกอบสีหลัก + อ่อน/เข้ม ได้ตัวย่ออัตโนมัติ", () => {
    expect(suggestColorCode("แดงอ่อน")).toBe("LRD");
    expect(suggestColorCode("ส้มเข้ม")).toBe("DOG");
    expect(suggestColorCode("ครีมเข้ม")).toBe("DCM");
  });

  it("สีหลัก + สีย่อยที่รู้จัก ใช้รหัสสีย่อย", () => {
    expect(suggestColorCode("เขียวไวน์")).toBe("WIN");
  });

  it("ไม่ชนรหัสของสีอื่น: ใช้อักษรสีหลักนำหน้าแทนการต่อเลข", () => {
    expect(suggestColorCode("เขียวไวน์", { WIN: { thaiName: "ไวน์" } })).toBe("GWIN");
  });
});

describe("suggestColorCode: ไม่เดามั่วเป็น COL", () => {
  it("สีที่เพิ่มเข้าพจนานุกรม (กาแฟ ฯลฯ) ได้รหัสที่สื่อความหมาย", () => {
    expect(suggestColorCode("กาแฟ")).toBe("COF");
    expect(suggestColorCode("เทาสนิม")).toBe("RGY");
    expect(suggestColorCode("น้ำเงินสนิม")).toBe("RBL");
  });

  it("สีที่ไม่รู้จักเลย: คืนค่าว่าง ไม่ใช่ COL / COL2 / COL3", () => {
    expect(suggestColorCode("สีทดสอบแปลกๆ")).toBe("");
    expect(suggestColorCode("")).toBe("");
    // แม้ COL และ COL2 ถูกใช้ไปแล้ว ก็ไม่ต่อเลขเป็น COL3
    expect(suggestColorCode("สีทดสอบแปลกๆ", { COL: { thaiName: "เทาสนิม" }, COL2: { thaiName: "น้ำเงินสนิม" } })).toBe("");
  });
});

describe("resolveColorCode", () => {
  const saved = { COL: { thaiName: "เทาสนิม" }, BLK: { thaiName: "ดำ" } };

  it("สีที่เคยบันทึกแล้ว ใช้รหัสเดิม (รวมรหัสเก่า COL ที่ตั้งไปก่อนหน้า)", () => {
    expect(resolveColorCode("เทาสนิม", "", saved)).toEqual({ code: "COL" });
    expect(resolveColorCode("ดำ", "", saved)).toEqual({ code: "BLK" });
  });

  it("สีที่ระบบรู้จัก: เดารหัสให้", () => {
    expect(resolveColorCode("กาแฟ", "", saved)).toEqual({ code: "COF" });
  });

  it("สีใหม่ที่ไม่รู้จัก ไม่ได้ใส่รหัส: แจ้งให้ใส่รหัสเอง ไม่สร้างให้", () => {
    const r = resolveColorCode("สีทดสอบแปลกๆ", "", saved);
    expect("error" in r && r.error).toContain("กรุณาใส่รหัสสี");
  });

  it("ใส่รหัสเอง: ใช้ได้ (ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง) แต่ห้ามเป็น COL หรือรูปแบบผิด", () => {
    expect(resolveColorCode("สีทดสอบแปลกๆ", " abc ", saved)).toEqual({ code: "ABC" });
    expect("error" in resolveColorCode("สีทดสอบแปลกๆ", "COL3", saved)).toBe(true);
    expect("error" in resolveColorCode("สีทดสอบแปลกๆ", "COL", saved)).toBe(true);
    expect("error" in resolveColorCode("สีทดสอบแปลกๆ", "ก", saved)).toBe(true);
    expect("error" in resolveColorCode("สีทดสอบแปลกๆ", "TOOLONGCODE", saved)).toBe(true);
  });
});
