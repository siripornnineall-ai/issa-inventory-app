import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Input } from "./Field";
import { normalizeLeadingZeros } from "@/lib/utils/numberInput";

function Harness({ initial = 0 }: { initial?: number }) {
  const [v, setV] = useState(initial);
  return <Input data-testid="n" type="number" value={v} onChange={(e) => setV(Number(e.target.value))} />;
}

describe("normalizeLeadingZeros", () => {
  it("ตัดเลข 0 นำหน้าแต่คงทศนิยมและ 0 เดี่ยว ๆ", () => {
    expect(normalizeLeadingZeros("0180")).toBe("180");
    expect(normalizeLeadingZeros("007")).toBe("7");
    expect(normalizeLeadingZeros("00.5")).toBe("0.5");
    expect(normalizeLeadingZeros("-05")).toBe("-5");
    expect(normalizeLeadingZeros("0")).toBe("0");
    expect(normalizeLeadingZeros("0.5")).toBe("0.5");
    expect(normalizeLeadingZeros("0.05")).toBe("0.05");
    expect(normalizeLeadingZeros("")).toBe("");
    expect(normalizeLeadingZeros("100")).toBe("100");
  });
});

describe("Input type=number", () => {
  it("พิมพ์ทับค่า 0 แล้วเลข 0 นำหน้าหายเอง", () => {
    render(<Harness />);
    const el = screen.getByTestId("n") as HTMLInputElement;
    expect(el.value).toBe("0");
    fireEvent.change(el, { target: { value: "01" } });
    expect(el.value).toBe("1");
    fireEvent.change(el, { target: { value: "18" } });
    fireEvent.change(el, { target: { value: "180" } });
    expect(el.value).toBe("180");
  });

  it("0180 กลายเป็น 180 และส่งค่าที่ถูกต้องให้หน้าที่ใช้", () => {
    render(<Harness initial={180} />);
    const el = screen.getByTestId("n") as HTMLInputElement;
    fireEvent.change(el, { target: { value: "0180" } });
    expect(el.value).toBe("180");
  });

  it("ทศนิยมยังพิมพ์ได้ตามปกติ", () => {
    render(<Harness />);
    const el = screen.getByTestId("n") as HTMLInputElement;
    fireEvent.change(el, { target: { value: "0.5" } });
    expect(el.value).toBe("0.5");
  });
});
