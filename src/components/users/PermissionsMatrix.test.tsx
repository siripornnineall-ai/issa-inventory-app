import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PermissionsMatrix } from "./PermissionsMatrix";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));

describe("PermissionsMatrix", () => {
  beforeEach(() => {
    cleanup();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
    } as never);
  });

  it("ติ๊กให้สิทธิ์ตำแหน่งหนึ่ง แล้วสิทธิ์นั้นอยู่ใน store ติ๊กออกก็ถอนสิทธิ์", () => {
    render(<PermissionsMatrix />);
    const box = screen.getByLabelText("พนักงานขาย: รับเข้า") as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(useStore.getState().rolePermissions.sales).toContain("stock.in");
    expect((screen.getByLabelText("พนักงานขาย: รับเข้า") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("พนักงานขาย: รับเข้า"));
    expect(useStore.getState().rolePermissions.sales).not.toContain("stock.in");
  });

  it("คอลัมน์ผู้ดูแลระบบและสิทธิ์เฉพาะผู้ดูแลระบบถูกล็อก ไม่มีช่องติ๊ก", () => {
    render(<PermissionsMatrix />);
    expect(screen.queryByLabelText("ผู้ดูแลระบบ: รับเข้า")).toBeNull();
    expect(screen.queryByLabelText("ผู้จัดการ: สร้างบัญชี ตั้งรหัสผ่าน ลบผู้ใช้")).toBeNull();
  });

  it("ผู้ที่ไม่ใช่ผู้ดูแลระบบแก้สิทธิ์ไม่ได้ (ระบบไม่เปลี่ยนค่า)", () => {
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u2: { id: "u2", name: "mgr", role: "manager", active: true } },
      currentUserId: "u2",
    } as never);
    render(<PermissionsMatrix />);
    fireEvent.click(screen.getByLabelText("พนักงานขาย: รับเข้า"));
    expect(useStore.getState().rolePermissions.sales).not.toContain("stock.in");
  });
});
