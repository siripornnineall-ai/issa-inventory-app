import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { KpiCard } from "./Card";
import { BrandTag } from "./BrandTag";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

describe("การ์ดตัวเลขแบบโลโก้แบรนด์", () => {
  beforeEach(() => {
    cleanup();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      brands: { a: { id: "a", name: "ISSA Apparel", code: "IS", active: true, logoUrl: "https://x.test/a.jpg", createdAt: "1" } },
    } as never);
  });

  it("label เป็นโลโก้ได้ (alt = ชื่อแบรนด์) และยังโชว์ตัวเลขตามปกติ", () => {
    render(<KpiCard label={<BrandTag brandId="a" variant="logo" />} value="17,493" unit="ชิ้น" />);
    expect((screen.getByAltText("ISSA Apparel") as HTMLImageElement).src).toBe("https://x.test/a.jpg");
    expect(screen.getByText("17,493")).toBeTruthy();
  });

  it("label เป็นข้อความได้เหมือนเดิม", () => {
    render(<KpiCard label="รวมทุกแบรนด์" value="18,117" />);
    expect(screen.getByText("รวมทุกแบรนด์")).toBeTruthy();
  });
});
