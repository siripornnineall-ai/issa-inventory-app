import { describe, expect, it } from "vitest";
import { filterColorOptions, listColorOptions } from "./colorOptions";

describe("color options", () => {
  const saved = { MNT: { thaiName: "มิ้นท์" }, BLK: { thaiName: "ดำ" } };

  it("รวมสีที่บันทึกไว้กับสีสำเร็จรูป ไม่ซ้ำกันแม้สะกดวรรณยุกต์ต่างกัน", () => {
    const options = listColorOptions(saved);
    expect(options[0]).toEqual({ name: "มิ้นท์", code: "MNT" });
    expect(options.filter((o) => o.name === "มินท์" || o.name === "มิ้นท์")).toHaveLength(1);
    expect(options.length).toBeGreaterThan(40);
    expect(options.some((o) => o.name === "ลาเวนเดอร์")).toBe(true);
  });

  it("พิมพ์แล้วกรองตามชื่อหรือรหัส", () => {
    const options = listColorOptions(saved);
    const names = filterColorOptions(options, "เขียว", new Set(), 60).map((o) => o.name);
    expect(names).toContain("เขียวมิ้นท์");
    expect(names).toContain("เขียวขี้ม้า");
    expect(names).not.toContain("ดำ");
    expect(filterColorOptions(options, "blk", new Set(), 60).map((o) => o.name)).toEqual(["ดำ"]);
  });

  it("ข้ามสีที่เลือกไปแล้ว และจำกัดจำนวน", () => {
    const options = listColorOptions(saved);
    expect(filterColorOptions(options, "", new Set(["ดำ".normalize()]), 5)).toHaveLength(5);
  });

  it("รหัสสีสำเร็จรูปไม่ชนรหัสที่บันทึกไว้", () => {
    const options = listColorOptions({ GMT: { thaiName: "สีอื่น" } });
    const codes = options.map((o) => o.code);
    expect(new Set(codes).size).toBe(codes.length);
    // สีสำเร็จรูปทุกสีได้ตัวย่อล้วน ไม่มีเลขต่อท้าย
    expect(listColorOptions({}).filter((o) => /[0-9]/.test(o.code))).toEqual([]);
  });
});
