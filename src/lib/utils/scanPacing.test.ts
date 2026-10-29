import { describe, it, expect } from "vitest";
import { nextQrPacing, QR_MIN_WIDTH } from "./scanPacing";

describe("จังหวะถอดรหัส QR ตามความแรงของเครื่อง", () => {
  it("เครื่องเร็ว (ถอดรหัสใช้ไม่ถึง 80 มิลลิวินาที) → ขนาดภาพและรอบคงเดิม", () => {
    expect(nextQrPacing({ width: 1280, intervalMs: 100 }, 20, 100)).toEqual({ width: 1280, intervalMs: 100 });
  });

  it("เครื่องช้า → ย่อภาพลงและเว้นรอบยาวขึ้น", () => {
    expect(nextQrPacing({ width: 1280, intervalMs: 100 }, 200, 100)).toEqual({ width: 960, intervalMs: 600 });
  });

  it("ย่อต่อเนื่องจนถึงขั้นต่ำแล้วหยุด ไม่เล็กเกินจนอ่าน QR ไม่ออก", () => {
    let p = { width: 1280, intervalMs: 100 };
    for (let i = 0; i < 10; i++) p = nextQrPacing(p, 300, 100);
    expect(p.width).toBe(QR_MIN_WIDTH);
  });

  it("เครื่องกลับมาเร็ว → รอบกลับไปที่ค่าฐาน", () => {
    expect(nextQrPacing({ width: 640, intervalMs: 900 }, 10, 100).intervalMs).toBe(100);
  });
});
