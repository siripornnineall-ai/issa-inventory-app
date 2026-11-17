import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EquipmentForm } from "./EquipmentForm";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));

describe("EquipmentForm: หน่วยนับ", () => {
  beforeEach(() => {
    cleanup();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
    } as never);
  });

  it("เลือกหน่วย 'โหล' ได้ (เพิ่ม 17 พ.ย. 2026 สำหรับเลเบิ้ล) โดยหน่วยเดิมอย่าง 'ม้วน' ยังอยู่", () => {
    render(<EquipmentForm />);
    const option = (label: string) => screen.getAllByRole("option").find((o) => o.textContent === label);
    expect(option("โหล")).toBeTruthy();
    expect(option("ม้วน")).toBeTruthy();
  });
});
