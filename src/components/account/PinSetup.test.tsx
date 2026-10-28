import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { PinSetupDialog } from "./PinSetup";
import { PinError } from "@/lib/supabase/pinAuth";

const pinSet = vi.fn();
const pinClear = vi.fn();
const hasPin = vi.fn();
vi.mock("@/lib/supabase/pinAuth", async (orig) => ({
  ...(await orig<typeof import("@/lib/supabase/pinAuth")>()),
  pinSet: (...a: unknown[]) => pinSet(...a),
  pinClear: (...a: unknown[]) => pinClear(...a),
  hasPin: (...a: unknown[]) => hasPin(...a),
}));
vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

const type = (id: string, value: string) => fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });

describe("ตั้ง PIN เข้าระบบ", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    hasPin.mockResolvedValue(false);
    pinSet.mockResolvedValue(undefined);
  });

  it("โหมดชวนหลังเข้าด้วยรหัสผ่าน: ไม่ถามรหัสผ่านซ้ำ ตั้ง PIN ส่งรหัสผ่านที่รู้แล้วไปยืนยัน", async () => {
    const onClose = vi.fn();
    render(<PinSetupDialog open prompt password="รหัสเดิม1" onClose={onClose} />);
    expect(document.getElementById("pin-password")).toBeNull();
    type("pin-new", "482915");
    type("pin-confirm", "482915");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN" }));
    await waitFor(() => expect(pinSet).toHaveBeenCalledWith("482915", "รหัสเดิม1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("ตรวจก่อนส่ง: ไม่ครบ 6 หลัก / เดาง่าย / ไม่ตรงกัน จะไม่เรียกเซิร์ฟเวอร์", () => {
    render(<PinSetupDialog open prompt password="x" onClose={() => {}} />);
    type("pin-new", "1234");
    type("pin-confirm", "1234");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN" }));
    expect(screen.getByRole("alert").textContent).toContain("6 หลัก");

    type("pin-new", "123456");
    type("pin-confirm", "123456");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN" }));
    expect(screen.getByRole("alert").textContent).toContain("เรียงกัน");

    type("pin-new", "482915");
    type("pin-confirm", "482916");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN" }));
    expect(screen.getByRole("alert").textContent).toContain("ไม่ตรงกัน");
    expect(pinSet).not.toHaveBeenCalled();
  });

  it("พิมพ์ได้เฉพาะตัวเลข ไม่เกิน 6 หลัก", () => {
    render(<PinSetupDialog open prompt password="x" onClose={() => {}} />);
    type("pin-new", "48a2-9158");
    expect((document.getElementById("pin-new") as HTMLInputElement).value).toBe("482915");
  });

  it("โหมดจากเมนูโปรไฟล์: ต้องกรอกรหัสผ่านปัจจุบัน และแสดงข้อความผิดจากเซิร์ฟเวอร์", async () => {
    pinSet.mockRejectedValue(new PinError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 401));
    render(<PinSetupDialog open onClose={() => {}} />);
    type("pin-new", "482915");
    type("pin-confirm", "482915");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN" }));
    expect(screen.getByRole("alert").textContent).toContain("กรอกรหัสผ่านปัจจุบัน");
    type("pin-password", "ผิด");
    fireEvent.click(screen.getByRole("button", { name: "ตั้ง PIN" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("รหัสผ่านปัจจุบันไม่ถูกต้อง"));
  });

  it("เคยตั้ง PIN แล้ว: เปลี่ยนเป็นปุ่ม บันทึก PIN ใหม่ และมีปุ่ม ลบ PIN", async () => {
    hasPin.mockResolvedValue(true);
    pinClear.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<PinSetupDialog open onClose={onClose} />);
    expect(await screen.findByRole("button", { name: "บันทึก PIN ใหม่" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ลบ PIN" }));
    await waitFor(() => expect(pinClear).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
