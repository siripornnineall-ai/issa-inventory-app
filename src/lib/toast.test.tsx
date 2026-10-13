import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { ToastViewport, toastSuccess } from "./toast";

afterEach(cleanup);

describe("ToastViewport", () => {
  it("ซ่อนตอนพิมพ์ (print:hidden) แจ้งเตือนที่ค้างอยู่จะได้ไม่ถูกพิมพ์ทับป้ายบาร์โค้ด", () => {
    render(<ToastViewport />);
    act(() => toastSuccess("เพิ่ม Astra Zip Vest ขาว/L แล้ว"));
    const viewport = screen.getByText("เพิ่ม Astra Zip Vest ขาว/L แล้ว").closest(".fixed");
    expect(viewport?.className).toContain("print:hidden");
  });
});
