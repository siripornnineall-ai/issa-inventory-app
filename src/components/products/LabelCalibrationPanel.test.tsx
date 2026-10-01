import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LabelCalibrationPanel } from "./LabelCalibrationPanel";
import { DEFAULT_LABEL_CALIBRATION } from "@/lib/utils/labelCalibration";

describe("LabelCalibrationPanel — เลือกกระดาษที่ใช้พิมพ์", () => {
  beforeEach(() => cleanup());

  it("shows both papers and marks A4 as the one in use by default", () => {
    render(<LabelCalibrationPanel calibration={DEFAULT_LABEL_CALIBRATION} onChange={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole("button", { name: /แผ่น A4/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /ม้วนสติกเกอร์ 50×30 มม\./ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to the 50x30 roll when tapped", () => {
    const onChange = vi.fn();
    render(<LabelCalibrationPanel calibration={DEFAULT_LABEL_CALIBRATION} onChange={onChange} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /ม้วนสติกเกอร์ 50×30 มม\./ }));
    expect(onChange).toHaveBeenCalledWith({ paper: "roll" });
  });

  it("in roll mode shows roll size and offset fields plus the print-dialog tip, not the A4 grid fields", () => {
    render(<LabelCalibrationPanel calibration={{ ...DEFAULT_LABEL_CALIBRATION, paper: "roll" }} onChange={vi.fn()} onReset={vi.fn()} />);
    expect(document.getElementById("cal-roll-width")).not.toBeNull();
    expect(document.getElementById("cal-roll-height")).not.toBeNull();
    expect(document.getElementById("cal-roll-offset-x")).not.toBeNull();
    expect(document.getElementById("cal-roll-offset-y")).not.toBeNull();
    expect(document.getElementById("cal-columns")).toBeNull();
    expect(screen.getByText(/ตั้งขนาดกระดาษเป็น 50×30 มม\./)).toBeTruthy();
  });
});
