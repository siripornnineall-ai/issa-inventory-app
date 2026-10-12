import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { UserDialog } from "./UserDialog";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { AppUser } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));
vi.mock("@/lib/supabase/adminUsers", () => ({
  MIN_PASSWORD_LENGTH: 8,
  generateTempPassword: () => "TempPass1234",
  adminCreateUser: vi.fn(),
  adminResetPassword: vi.fn(),
  adminUpdateEmail: vi.fn(),
}));

const iso = "2026-10-05T00:00:00.000Z";
const admin: AppUser = { id: "a", name: "Kalong", email: "k@x.com", role: "admin", active: true, createdAt: iso };
const nat: AppUser = { id: "w", name: "นัท", email: "n@x.com", role: "warehouse", active: true, createdAt: iso };

function seed(users: AppUser[], current: string) {
  useStore.getState().actions.hydrate({ ...emptyState(), users: Object.fromEntries(users.map((u) => [u.id, u])), currentUserId: current } as never);
}

describe("UserDialog: สิทธิ์รายบุคคล", () => {
  beforeEach(() => cleanup());

  it("ผู้ดูแลระบบเปิดดูสิทธิ์ของนัท เลือกกำหนดเอง ติ๊กออก 'เบิกออก' แล้วบันทึก → เก็บสิทธิ์เฉพาะคนนี้", async () => {
    seed([admin, nat], "a");
    const onClose = vi.fn();
    render(<UserDialog open onClose={onClose} existing={nat} />);
    expect(screen.getByText("ตามตำแหน่ง", { selector: "span" })).toBeTruthy();

    fireEvent.click(screen.getByLabelText("กำหนดสิทธิ์ของคนนี้เอง"));
    // เริ่มจากสิทธิ์ตามตำแหน่งพนักงานคลัง ซึ่งมี "เบิกออก"
    const out = screen.getByLabelText(/เบิกออก$/) as HTMLInputElement;
    expect(out.checked).toBe(true);
    fireEvent.click(out);
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = useStore.getState().users.w.customPermissions!;
    expect(saved).toContain("stock.in");
    expect(saved).not.toContain("stock.out");
    expect(saved).not.toContain("user.admin");
  });

  it("กลับมาเลือก 'ตามตำแหน่ง' แล้วบันทึก → ล้างสิทธิ์เฉพาะคน", async () => {
    const custom = { ...nat, customPermissions: ["stock.in"] };
    seed([admin, custom], "a");
    const onClose = vi.fn();
    render(<UserDialog open onClose={onClose} existing={custom} />);
    fireEvent.click(screen.getByLabelText(/ใช้ตามตำแหน่ง/));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useStore.getState().users.w.customPermissions).toBeUndefined();
  });

  it("ผู้ที่ไม่ใช่ผู้ดูแลระบบไม่เห็นส่วนกำหนดสิทธิ์", () => {
    const mgr: AppUser = { id: "m", name: "mgr", email: "m@x.com", role: "manager", active: true, createdAt: iso };
    seed([mgr, nat], "m");
    render(<UserDialog open onClose={() => {}} existing={nat} />);
    expect(screen.queryByText("สิทธิ์การใช้งานของคนนี้")).toBeNull();
  });
});
