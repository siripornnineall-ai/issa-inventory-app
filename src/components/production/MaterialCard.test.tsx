import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MaterialCard, type MaterialModel } from "./MaterialCard";
import { useMaterialSettings } from "./useMaterialSettings";

function Wrapper({ models }: { models: MaterialModel[] }) {
  const settings = useMaterialSettings();
  return <MaterialCard models={models} months="1" untilDate="21/12/2026" settings={settings} />;
}

describe("MaterialCard", () => {
  it("คำนวณผ้าหลักและผ้ากระเป๋าจากจำนวนที่ต้องผลิต และแก้อัตราได้", () => {
    render(<Wrapper models={[{ id: "a", name: "Billie Wide", need: 100, colors: [{ color: "ดำ", need: 60 }, { color: "ขาว", need: 40 }] }]} />);
    expect(screen.getByText("ผ้าหลักรวม").parentElement?.textContent).toContain("145");
    // ผ้ากระเป๋าแยกดำ/ขาว: ดำ 60 ตัว x 0.19 = 11.4, ขาว 40 ตัว x 0.19 = 7.6
    expect(screen.getByText("ผ้ากระเป๋าสีดำ").parentElement?.textContent).toContain("11.4");
    expect(screen.getByText("ผ้ากระเป๋าสีขาว").parentElement?.textContent).toContain("7.6");
    fireEvent.change(screen.getByLabelText("ผ้าหลัก ต่อตัว"), { target: { value: "2" } });
    expect(screen.getByText("ผ้าหลักรวม").parentElement?.textContent).toContain("200");
  });
});

describe("MaterialCard แยกสี", () => {
  it("แสดงผ้าหลักต่อสี และเตือนสีที่ยังไม่ระบุผ้ากระเป๋า เลือกแล้วคำเตือนหาย", () => {
    render(<Wrapper models={[{ id: "a", name: "A", need: 110, colors: [{ color: "ดำ", need: 100 }, { color: "ชมพู", need: 10 }] }]} />);
    expect(screen.getByRole("status").textContent).toContain("ยังไม่ระบุสี");
    fireEvent.change(screen.getByLabelText("สีผ้ากระเป๋าของสีชมพู"), { target: { value: "ขาว" } });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("ผ้ากระเป๋าสีขาว").parentElement?.textContent).toContain("1.9");
  });
});
