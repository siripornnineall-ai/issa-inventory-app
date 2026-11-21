import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MaterialCard } from "./MaterialCard";

describe("MaterialCard", () => {
  it("คำนวณผ้าหลักและผ้ากระเป๋าจากจำนวนที่ต้องผลิต และแก้อัตราได้", () => {
    render(<MaterialCard models={[{ id: "a", name: "Billie Wide", need: 100 }]} months="1" untilDate="21/12/2026" />);
    expect(screen.getByText("ผ้าหลักรวม").parentElement?.textContent).toContain("145");
    expect(screen.getByText("ผ้ากระเป๋ารวม").parentElement?.textContent).toContain("19");
    fireEvent.change(screen.getByLabelText("ผ้าหลัก ต่อตัว"), { target: { value: "2" } });
    expect(screen.getByText("ผ้าหลักรวม").parentElement?.textContent).toContain("200");
  });
});
