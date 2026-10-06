import { describe, it, expect } from "vitest";
import { equipmentLabel } from "./equipmentLabel";

describe("equipmentLabel", () => {
  it("มีไซซ์ต่อท้ายชื่อ ไม่มีไซซ์ใช้ชื่อเดิม", () => {
    expect(equipmentLabel({ name: "เลเบิ้ล Issa", size: "M" })).toBe("เลเบิ้ล Issa (M)");
    expect(equipmentLabel({ name: "เลเบิ้ล Issa" })).toBe("เลเบิ้ล Issa");
    expect(equipmentLabel({ name: "เลเบิ้ล Issa", size: "  " })).toBe("เลเบิ้ล Issa");
    expect(equipmentLabel(undefined)).toBe("");
  });
});
