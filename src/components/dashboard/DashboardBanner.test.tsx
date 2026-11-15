import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { DashboardBanner, buildSlides } from "./DashboardBanner";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const DB_ROWS = [
  { brand_id: "f", image_url: "https://x.test/fas.png" },
  { brand_id: "a", image_url: "https://x.test/act.png" },
  { brand_id: "n", image_url: null },
];
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from() {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve(resolve({ data: DB_ROWS, error: null }));
      return chain;
    },
  }),
}));

const iso = "2026-11-01T00:00:00.000Z";
const BRANDS = [
  { id: "f", name: "Fasonaf", code: "FS" },
  { id: "a", name: "ISSA Activewear", code: "IA" },
  { id: "i", name: "ISSA Apparel", code: "IS" },
];

describe("แบนเนอร์แดชบอร์ด", () => {
  beforeEach(() => {
    cleanup();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      brands: Object.fromEntries(BRANDS.map((b) => [b.id, { ...b, active: true, createdAt: iso }])),
    } as never);
  });

  it("buildSlides: ISSA Apparel ที่ไม่มีแบนเนอร์ในฐานข้อมูลใช้รูปในแอป แบรนด์อื่นใช้ของฐานข้อมูล ข้ามแถวที่ไม่มีรูป", () => {
    const slides = buildSlides(BRANDS, DB_ROWS);
    expect(slides.map((s) => s.src)).toEqual(["/banners/issa-apparel.jpg", "https://x.test/fas.png", "https://x.test/act.png"]);
  });

  it("buildSlides: ถ้า ISSA Apparel มีแบนเนอร์ในฐานข้อมูลแล้ว ใช้ของฐานข้อมูลแทนรูปในแอป", () => {
    const slides = buildSlides(BRANDS, [{ brand_id: "i", image_url: "https://x.test/apparel-new.png" }]);
    expect(slides.map((s) => s.src)).toEqual(["https://x.test/apparel-new.png"]);
  });

  it("รูปแสดงเต็มภาพไม่ตัด (object-contain) ในกรอบความสูงคงที่", () => {
    render(<DashboardBanner />);
    const cls = screen.getByAltText(/ISSA Apparel — Comfortable/).className;
    expect(cls).toContain("object-contain");
    expect(cls).toContain("h-full");
  });

  it("โชว์รูป ISSA Apparel ก่อน แล้วโหลดของแบรนด์อื่นมาเป็นสไลด์ กดลูกศร/จุดเปลี่ยนรูปได้", async () => {
    render(<DashboardBanner />);
    expect((screen.getByAltText(/ISSA Apparel — Comfortable/) as HTMLImageElement).src).toContain("/banners/issa-apparel.jpg");
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^ไปแบนเนอร์/ })).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: "แบนเนอร์ถัดไป" }));
    expect((screen.getByAltText("Fasonaf") as HTMLImageElement).src).toBe("https://x.test/fas.png");
    fireEvent.click(screen.getByRole("button", { name: "แบนเนอร์ก่อนหน้า" }));
    expect(screen.getByAltText(/ISSA Apparel — Comfortable/)).toBeTruthy();
  });
});
