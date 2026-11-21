import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MaterialSideTable } from "./MaterialSideTable";
import { useMaterialSettings } from "./useMaterialSettings";

function Wrapper() {
  const settings = useMaterialSettings();
  return <MaterialSideTable colors={[{ color: "ดำ", need: 100 }, { color: "ขาว", need: 50 }, { color: "ชมพู", need: 0 }]} settings={settings} />;
}

describe("MaterialSideTable", () => {
  it("ต่อสี: หลาผ้าหลัก + ผ้ากระเป๋าดำ/ขาว และแถวรวม ความสูงแถวเท่าจำนวนสี + หัว + รวม", () => {
    const { container } = render(<Wrapper />);
    const rows = Array.from(container.querySelectorAll("tr")).map((tr) => Array.from(tr.children).map((c) => c.textContent));
    expect(rows).toHaveLength(5); // หัว + 3 สี + รวม
    expect(rows[1]).toEqual(["145", "19", "–"]); // ดำ 100 ตัว: 145 หลา กระเป๋าดำ 19
    expect(rows[2]).toEqual(["72.5", "–", "9.5"]); // ขาว 50 ตัว
    expect(rows[4]).toEqual(["217.5", "19", "9.5"]);
  });
});
