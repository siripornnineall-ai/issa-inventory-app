import { describe, it, expect } from "vitest";
import { buildEquipmentOverview } from "./equipmentOverview";
import type { Equipment } from "@/lib/types";

const eq = (id: string, name: string, size?: string, type = "packaging") => ({ id, name, size, type }) as Equipment;

describe("buildEquipmentOverview", () => {
  const list = [eq("a", "เลเบิ้ล", "M"), eq("b", "เลเบิ้ล", "S"), eq("c", "ซิป", undefined, "zipper"), eq("d", "ถุง", "L")];
  const qty = new Map([["a", 30], ["b", 10], ["c", 5]]);

  it("รวมไซซ์เป็นกลุ่ม เรียงไซซ์ และรวมยอด เรียงกลุ่มตามสต็อกมากไปน้อย", () => {
    const res = buildEquipmentOverview(list, qty);
    expect(res.map((r) => r.group.name)).toEqual(["เลเบิ้ล", "ซิป", "ถุง"]);
    expect(res[0].sizes.map((s) => `${s.item.size}:${s.qty}`)).toEqual(["S:10", "M:30"]);
    expect(res[0].total).toBe(40);
    expect(res[1].hasSizes).toBe(false);
  });

  it("ซ่อนรายการที่ไม่มีสต็อก และกรองตามประเภท", () => {
    expect(buildEquipmentOverview(list, qty, { hideEmpty: true }).map((r) => r.group.name)).toEqual(["เลเบิ้ล", "ซิป"]);
    expect(buildEquipmentOverview(list, qty, { type: "zipper" }).map((r) => r.group.name)).toEqual(["ซิป"]);
  });

  it("นับช่องที่ติดลบ", () => {
    const res = buildEquipmentOverview(list, new Map([["a", -2], ["b", 3]]));
    expect(res[0].negativeCells).toBe(1);
  });
});
