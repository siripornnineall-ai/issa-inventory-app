import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { PinReminder } from "./PinReminder";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const hasPin = vi.fn();
vi.mock("@/lib/supabase/pinAuth", async (orig) => ({
  ...(await orig<typeof import("@/lib/supabase/pinAuth")>()),
  hasPin: (...a: unknown[]) => hasPin(...a),
}));

function signIn(role: string, active = true) {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "วิชัย", email: "w@x.com", role, active, createdAt: "" } },
    currentUserId: "u1",
  } as never);
}

describe("แถบเตือนให้ตั้ง PIN", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("พนักงานที่ยังไม่มี PIN เห็นแถบเตือน กด ตั้ง PIN ตอนนี้ เปิดหน้าต่างตั้ง PIN", async () => {
    signIn("warehouse");
    hasPin.mockResolvedValue(false);
    render(<PinReminder />);
    expect((await screen.findByRole("status")).textContent).toContain("ตั้ง PIN 6 หลัก");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN ตอนนี้" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("มี PIN แล้ว ไม่เตือน", async () => {
    signIn("warehouse");
    hasPin.mockResolvedValue(true);
    render(<PinReminder />);
    await waitFor(() => expect(hasPin).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ผู้ดูแลระบบใช้ PIN ไม่ได้ จึงไม่เตือนและไม่ถามเซิร์ฟเวอร์", () => {
    signIn("admin");
    render(<PinReminder />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(hasPin).not.toHaveBeenCalled();
  });

  it("บัญชีที่ถูกปิดใช้งานไม่เตือน", () => {
    signIn("sales", false);
    render(<PinReminder />);
    expect(hasPin).not.toHaveBeenCalled();
  });

  it("กด ไว้ทีหลัง ซ่อนแถบในรอบนี้", async () => {
    signIn("sales");
    hasPin.mockResolvedValue(false);
    render(<PinReminder />);
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "ไว้ทีหลัง" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
