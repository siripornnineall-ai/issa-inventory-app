import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { UserDialog } from "./UserDialog";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import type { AppUser } from "@/lib/types";

const adminUpdateEmail = vi.fn(async (_id: string, email: string) => email.toLowerCase());

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/supabase/adminUsers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/adminUsers")>()),
  adminUpdateEmail: (id: string, email: string) => adminUpdateEmail(id, email),
}));

const kalong: AppUser = { id: "u-admin", name: "Kalong", email: "admin@issa.demo", role: "admin", active: true, createdAt: "2026-07-29T00:00:00Z" };
const manager: AppUser = { id: "u-mgr", name: "น้ำฝน", email: "mgr@example.com", role: "manager", active: true, createdAt: "2026-09-01T00:00:00Z" };

function signInAs(current: AppUser) {
  useStore.getState().actions.hydrate({ ...emptyState(), users: { [kalong.id]: kalong, [manager.id]: manager }, currentUserId: current.id });
}

describe("UserDialog — เปลี่ยนอีเมล", () => {
  beforeEach(() => {
    cleanup();
    adminUpdateEmail.mockClear();
  });

  it("lets an admin change their own email: calls the server, then updates the local user", async () => {
    signInAs(kalong);
    render(<UserDialog open onClose={vi.fn()} existing={kalong} />);
    const input = document.getElementById("user-email") as HTMLInputElement;
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: "Owner@Issa-Apparel.com" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(adminUpdateEmail).toHaveBeenCalledWith("u-admin", "Owner@Issa-Apparel.com"));
    await waitFor(() => expect(useStore.getState().users["u-admin"].email).toBe("owner@issa-apparel.com"));
  });

  it("does not call the server when the email is left unchanged", async () => {
    signInAs(kalong);
    const onClose = vi.fn();
    render(<UserDialog open onClose={onClose} existing={kalong} />);
    fireEvent.change(document.getElementById("user-name") as HTMLInputElement, { target: { value: "Kalong K." } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(adminUpdateEmail).not.toHaveBeenCalled();
    expect(useStore.getState().users["u-admin"].name).toBe("Kalong K.");
  });

  it("keeps the email locked for a manager, who cannot change login emails", () => {
    signInAs(manager);
    render(<UserDialog open onClose={vi.fn()} existing={kalong} />);
    expect((document.getElementById("user-email") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/เฉพาะผู้ดูแลระบบเปลี่ยนอีเมลได้/)).toBeTruthy();
  });
});
