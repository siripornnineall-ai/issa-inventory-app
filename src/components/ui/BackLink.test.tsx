import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BackLink } from "./BackLink";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

describe("BackLink", () => {
  beforeEach(() => {
    cleanup();
    back.mockClear();
    push.mockClear();
  });

  it("มีหน้าให้ย้อน: ย้อนประวัติจริง ไม่ push หน้าเดิมซ้ำ (กันวนไปมา)", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(3);
    render(<BackLink href="/products/1">กลับ</BackLink>);
    const link = screen.getByText("กลับ");
    const notPrevented = fireEvent.click(link);
    expect(back).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false); // ถูก preventDefault ไม่เปลี่ยนหน้าตามลิงก์
  });

  it("ไม่มีประวัติให้ย้อน (เปิดลิงก์ตรง): ใช้ลิงก์ปลายทางสำรองตามปกติ", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<BackLink href="/products/1">กลับ</BackLink>);
    const link = screen.getByText("กลับ");
    const notPrevented = fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
    expect(link.getAttribute("href")).toBe("/products/1");
  });
});
