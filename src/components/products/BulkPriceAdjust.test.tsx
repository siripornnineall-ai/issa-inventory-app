import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BulkPriceAdjust } from "./BulkPriceAdjust";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: (m: string) => toastSuccess(m) }));

const rows = [
  { size: "S", sellingPrice: 1090, purchasePrice: 200 },
  { size: "XL", sellingPrice: 1090, purchasePrice: 200 },
  { size: "XL", sellingPrice: 1090, purchasePrice: 200 }, // สีที่สอง ไซซ์เดียวกัน
  { size: "2XL", sellingPrice: 1190, purchasePrice: 200 },
];

const setAmount = (v: string) => fireEvent.change(screen.getByLabelText("จำนวนเงินที่จะปรับ"), { target: { value: v } });
const pickSize = (s: string) => fireEvent.click(screen.getByRole("button", { name: s }));
const update = () => fireEvent.click(screen.getByRole("button", { name: "อัปเดตราคา" }));

describe("BulkPriceAdjust: ปรับราคาเป็นกลุ่ม", () => {
  beforeEach(() => {
    cleanup();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("ใส่จำนวนเงิน เลือกไซซ์ กดอัปเดต: เพิ่มราคาขายให้ไซซ์นั้นทุกสี และบอกจำนวนที่ปรับ", () => {
    const onChange = vi.fn();
    render(<BulkPriceAdjust rows={rows} onChange={onChange} />);
    setAmount("100");
    pickSize("XL");
    expect(screen.getByText(/จะเพิ่มราคาขาย 100 บาท ให้ 2 ตัวเลือก/)).toBeTruthy();
    update();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((r: { sellingPrice: number }) => r.sellingPrice)).toEqual([1090, 1190, 1190, 1190]);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("2 ตัวเลือก"));
  });

  it("เลือกลด และปรับราคาซื้อแทนราคาขายได้", () => {
    const onChange = vi.fn();
    render(<BulkPriceAdjust rows={rows} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("ราคาที่จะปรับ"), { target: { value: "purchasePrice" } });
    fireEvent.change(screen.getByLabelText("เพิ่มหรือลด"), { target: { value: "down" } });
    setAmount("50");
    pickSize("S");
    update();
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ purchasePrice: 150, sellingPrice: 1090 });
  });

  it("ปุ่มเลือกทั้งหมด เลือกครบทุกไซซ์ที่มีในตาราง (ไม่ซ้ำ) และปุ่มล้างเอาออก", () => {
    const onChange = vi.fn();
    render(<BulkPriceAdjust rows={rows} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "เลือกทั้งหมด" }));
    for (const s of ["S", "XL", "2XL"]) expect(screen.getByRole("button", { name: s }).getAttribute("aria-pressed")).toBe("true");
    setAmount("10");
    update();
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("4 ตัวเลือก"));
    fireEvent.click(screen.getByRole("button", { name: "ล้าง" }));
    expect(screen.getByRole("button", { name: "S" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("ไม่ใส่จำนวนเงิน หรือไม่เลือกไซซ์: เตือนและไม่เปลี่ยนราคา", () => {
    const onChange = vi.fn();
    render(<BulkPriceAdjust rows={rows} onChange={onChange} />);
    pickSize("S");
    update(); // ยังไม่ใส่จำนวนเงิน
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("จำนวนเงิน"));
    pickSize("S"); // เอาออก = ไม่มีไซซ์ที่เลือก
    setAmount("100");
    update();
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("เลือกไซซ์"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ลดจนราคาติดลบ: ไม่ปรับให้ และบอกไซซ์ที่มีปัญหา", () => {
    const onChange = vi.fn();
    render(<BulkPriceAdjust rows={rows} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("ราคาที่จะปรับ"), { target: { value: "purchasePrice" } });
    fireEvent.change(screen.getByLabelText("เพิ่มหรือลด"), { target: { value: "down" } });
    setAmount("500");
    pickSize("S");
    update();
    expect(onChange).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenLastCalledWith(expect.stringContaining("ติดลบ"));
  });
});
