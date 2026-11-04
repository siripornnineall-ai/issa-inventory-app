import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const fake = vi.hoisted(() => ({ row: null as unknown, error: null as { message: string } | null }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: fake.row ? [fake.row] : [], error: fake.error }),
        }),
      }),
    }),
  }),
}));

import { NightlyCheckCard } from "./NightlyCheckCard";

describe("NightlyCheckCard (ผลตรวจประจำคืน)", () => {
  beforeEach(() => {
    fake.row = null;
    fake.error = null;
  });

  it("ไม่มีความผิดปกติ: ขึ้นข้อความปกติ", async () => {
    fake.row = { checked_at: "2026-11-05T03:10:00+07:00", mismatches: 0, detail: [], integrity: [] };
    render(<NightlyCheckCard />);
    await waitFor(() => expect(screen.getByText("ไม่พบความผิดปกติ")).toBeTruthy());
  });

  it("สต็อกไม่ตรงและข้อมูลไม่ครบ: แสดงรายการพร้อมคำอธิบายภาษาไทย", async () => {
    fake.row = {
      checked_at: "2026-11-05T03:10:00+07:00",
      mismatches: 1,
      detail: [{ type: "product", sku: "IS-BS-BLK-M", expected: 232, actual: 223, diff: -9 }],
      integrity: [{ kind: "image_color_without_variant", ref: "Nova Jogger Pants / ครีม", at: null }],
    };
    render(<NightlyCheckCard />);
    await waitFor(() => expect(screen.getByText("IS-BS-BLK-M")).toBeTruthy());
    expect(screen.getByText(/สต็อกไม่ตรงกับประวัติ 1 รายการ/)).toBeTruthy();
    expect(screen.getByText("-9")).toBeTruthy();
    expect(screen.getByText("มีรูปของสีนี้ แต่ไม่มีตัวเลือกสีนี้")).toBeTruthy();
    expect(screen.getByText("Nova Jogger Pants / ครีม")).toBeTruthy();
  });

  it("ยังไม่มีผลตรวจ (หรือไม่ใช่ผู้ดูแลระบบ): บอกไว้ ไม่ขึ้นว่าปกติ", async () => {
    render(<NightlyCheckCard />);
    await waitFor(() => expect(screen.getByText(/ยังไม่มีผลตรวจ/)).toBeTruthy());
    expect(screen.queryByText("ไม่พบความผิดปกติ")).toBeNull();
  });

  it("โหลดไม่สำเร็จ: แจ้งข้อผิดพลาด", async () => {
    fake.error = { message: "network down" };
    render(<NightlyCheckCard />);
    await waitFor(() => expect(screen.getByText(/โหลดผลตรวจไม่สำเร็จ: network down/)).toBeTruthy());
  });
});
