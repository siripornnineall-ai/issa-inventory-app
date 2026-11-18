import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { ProductModelPicker, type ModelOption } from "./ProductModelPicker";

const OPTIONS: ModelOption[] = [
  { id: "a", name: "Billie Slim", brand: "ISSA Apparel", shape: "ทรงกระบอกเล็ก", code: "BS" },
  { id: "b", name: "Billie Wide", brand: "ISSA Apparel", shape: "ทรงกระบอกใหญ่", code: "BW" },
  { id: "c", name: "Aero Light Hood Jacket", brand: "Fasonaf", code: "ALH" },
];

function Harness({ onChange }: { onChange?: (id: string) => void }) {
  const [v, setV] = useState("");
  return (
    <ProductModelPicker
      options={OPTIONS}
      value={v}
      onChange={(id) => {
        setV(id);
        onChange?.(id);
      }}
    />
  );
}

const box = () => screen.getByRole("combobox") as HTMLInputElement;

describe("ProductModelPicker: เลือกรุ่นแบบพิมพ์ค้นหา", () => {
  beforeEach(() => cleanup());

  it("กดช่องแล้วเห็นทุกรุ่น พิมพ์แล้วเหลือเฉพาะที่ตรง (ชื่อ / แบรนด์ / ทรง / รหัส)", () => {
    render(<Harness />);
    fireEvent.focus(box());
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.change(box(), { target: { value: "wide" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Billie WideISSA Apparel · ทรงกระบอกใหญ่"]);
    fireEvent.change(box(), { target: { value: "fasonaf" } }); // แบรนด์
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.change(box(), { target: { value: "กระบอกเล็ก" } }); // ทรง
    expect(screen.getAllByRole("option")[0].textContent).toContain("Billie Slim");
    fireEvent.change(box(), { target: { value: "alh" } }); // รหัสรุ่น
    expect(screen.getAllByRole("option")[0].textContent).toContain("Aero");
  });

  it("คลิกรุ่นแล้วเลือก: ช่องแสดงชื่อรุ่น+แบรนด์ รายการปิด และเรียก onChange", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.click(screen.getByRole("option", { name: /Billie Wide/ }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(box().value).toBe("Billie Wide · ISSA Apparel");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ลูกศรลง + Enter เลือกรายการที่ไฮไลต์ และ Esc ปิดรายการโดยไม่เปลี่ยนรุ่น", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("b"); // ตำแหน่งที่สอง
    onChange.mockClear();
    fireEvent.focus(box());
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ไม่พบรุ่น → ขึ้นข้อความ; กดกากบาทเปลี่ยนรุ่น → ล้างค่าและเปิดรายการใหม่", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: "zzz" } });
    expect(screen.getByText(/ไม่พบรุ่นที่ตรงกับ/)).toBeTruthy();
    fireEvent.change(box(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("option", { name: /Billie Slim/ }));
    fireEvent.click(screen.getByRole("button", { name: "เปลี่ยนรุ่น" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });
});
