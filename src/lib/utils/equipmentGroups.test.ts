import { describe, it, expect } from "vitest";
import { groupEquipment, equipmentSiblings } from "./equipmentGroups";
import type { Equipment } from "@/lib/types";

const eq = (id: string, name: string, size?: string) => ({ id, name, size }) as Equipment;

describe("groupEquipment", () => {
  const list = [eq("1", "เลเบิ้ล Issa", "XL"), eq("2", "เลเบิ้ล Issa", "S"), eq("3", "เลเบิ้ล Issa", "M"), eq("4", "ซิป"), eq("5", "ซิป"), eq("6", "ถุง", "L")];

  it("รวมรายการที่ชื่อเดียวกันและมีไซซ์เป็นกลุ่มเดียว เรียงไซซ์ S, M, XL", () => {
    const groups = groupEquipment(list);
    const label = groups.find((g) => g.name === "เลเบิ้ล Issa")!;
    expect(label.items.map((i) => i.size)).toEqual(["S", "M", "XL"]);
    expect(label.primary.id).toBe("2");
  });

  it("รายการไม่มีไซซ์ไม่ถูกรวมกัน แม้ชื่อซ้ำ", () => {
    const groups = groupEquipment(list);
    expect(groups.filter((g) => g.name === "ซิป")).toHaveLength(2);
    expect(groups).toHaveLength(4);
  });

  it("equipmentSiblings คืนทั้งกลุ่มเรียงไซซ์", () => {
    expect(equipmentSiblings(list, list[0]).map((i) => i.id)).toEqual(["2", "3", "1"]);
    expect(equipmentSiblings(list, list[3]).map((i) => i.id)).toEqual(["4"]);
  });
});
