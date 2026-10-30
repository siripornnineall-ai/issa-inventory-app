import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReturnNav } from "./ReturnNav";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const now = new Date().toISOString();

function seed(role: "admin" | "sales") {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: now } },
    currentUserId: "u1",
  } as never);
}

describe("ReturnNav (แถบกล่องสลับหน้าสินค้าคืน)", () => {
  beforeEach(() => cleanup());

  it("มีกล่อง บันทึกรับคืน / สรุป / ยกเลิกใบรับเข้า และกล่องของหน้าปัจจุบันถูกทำเครื่องหมาย", () => {
    seed("admin");
    render(<ReturnNav active="summary" />);
    const record = screen.getByRole("link", { name: "บันทึกรับคืน" });
    const summary = screen.getByRole("link", { name: "สรุปสินค้าคืน/เปลี่ยน" });
    expect(record.getAttribute("href")).toBe("/stock-return");
    expect(summary.getAttribute("href")).toBe("/stock-return/summary");
    expect(summary.getAttribute("aria-current")).toBe("page");
    expect(record.getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: /ยกเลิกใบรับเข้า/ }).getAttribute("href")).toBe("/stock-in/cancel");
  });

  it("ฝ่ายขาย (ไม่มีสิทธิ์ปรับยอดสต็อก) ไม่เห็นกล่องยกเลิกใบรับเข้า", () => {
    seed("sales");
    render(<ReturnNav active="record" />);
    expect(screen.getByRole("link", { name: "บันทึกรับคืน" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /ยกเลิกใบรับเข้า/ })).toBeNull();
  });
});
