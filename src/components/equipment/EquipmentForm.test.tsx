import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EquipmentForm } from "./EquipmentForm";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("no supabase in test"); } }));

describe("EquipmentForm: เพิ่มหลายไซซ์", () => {
  beforeEach(() => {
    cleanup();
    replace.mockClear();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      users: { u1: { id: "u1", name: "admin", role: "admin", active: true } },
      currentUserId: "u1",
      warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: "2026-10-05T00:00:00.000Z" } },
    } as never);
  });

  it("เลือก S, M, L และพิมพ์ 7XL ค้างไว้ → สร้างอุปกรณ์ 4 รายการ ไซซ์ละรายการ รหัสไม่ซ้ำ", () => {
    const { container } = render(<EquipmentForm />);
    const nameInput = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("ชื่ออุปกรณ์"))!.parentElement!.querySelector("input")!;
    fireEvent.change(nameInput, { target: { value: "เลเบิ้ล Issa" } });
    for (const s of ["S", "M", "L"]) fireEvent.click(screen.getByRole("button", { name: s }));
    fireEvent.change(screen.getByPlaceholderText(/ไซซ์อื่น ๆ/), { target: { value: "7XL" } });
    fireEvent.submit(container.querySelector("form")!);

    const items = Object.values(useStore.getState().equipment);
    expect(items.map((e) => e.size).sort()).toEqual(["7XL", "L", "M", "S"]);
    expect(new Set(items.map((e) => e.code)).size).toBe(4);
    expect(items.every((e) => e.name === "เลเบิ้ล Issa")).toBe(true);
    expect(replace).toHaveBeenCalledWith("/equipment");
  });

  it("ไม่เลือกไซซ์ → สร้างรายการเดียวไม่มีไซซ์", () => {
    const { container } = render(<EquipmentForm />);
    const nameInput = Array.from(container.querySelectorAll("label")).find((l) => l.textContent?.includes("ชื่ออุปกรณ์"))!.parentElement!.querySelector("input")!;
    fireEvent.change(nameInput, { target: { value: "ซิป" } });
    fireEvent.submit(container.querySelector("form")!);
    const items = Object.values(useStore.getState().equipment);
    expect(items).toHaveLength(1);
    expect(items[0].size).toBeUndefined();
  });
});
