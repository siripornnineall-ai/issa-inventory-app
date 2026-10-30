import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedChoice } from "./SegmentedChoice";

const options = [
  { value: "a", label: "ตัวเลือก A", hint: "อธิบาย A" },
  { value: "b", label: "ตัวเลือก B" },
] as const;

describe("SegmentedChoice (กล่องเลือก)", () => {
  it("กล่องที่เลือกอยู่ aria-pressed เป็น true กล่องอื่นเป็น false", () => {
    render(<SegmentedChoice options={[...options]} value="b" onChange={() => {}} ariaLabel="เลือก" />);
    expect(screen.getByRole("button", { name: "ตัวเลือก B" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /ตัวเลือก A/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("ยังไม่ได้เลือก (ค่าว่าง): ไม่มีกล่องไหนถูกเลือก และกดแล้วส่งค่ากลับ", () => {
    const onChange = vi.fn();
    render(<SegmentedChoice options={[...options]} value="" onChange={onChange} ariaLabel="เลือก" />);
    expect(screen.getAllByRole("button").every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /ตัวเลือก A/ }));
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("แสดงข้อความอธิบายใต้ชื่อ", () => {
    render(<SegmentedChoice options={[...options]} value="" onChange={() => {}} ariaLabel="เลือก" />);
    expect(screen.getByText("อธิบาย A")).toBeTruthy();
  });
});
