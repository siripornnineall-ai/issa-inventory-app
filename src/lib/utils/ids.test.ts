import { describe, expect, it } from "vitest";
import { suggestColorCode } from "./ids";

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
