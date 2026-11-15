import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BrandTag } from "@/components/ui/BrandTag";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

describe("BrandTag แบบโลโก้", () => {
  beforeEach(() => {
    cleanup();
    useStore.getState().actions.hydrate({
      ...emptyState(),
      brands: {
        a: { id: "a", name: "ISSA Apparel", code: "IS", active: true, logoUrl: "https://x.test/a.jpg", createdAt: "1" },
        b: { id: "b", name: "Fasonaf", code: "FS", active: true, createdAt: "2" },
      },
    } as never);
  });

  it("มีโลโก้ → โชว์รูปโลโก้ (alt = ชื่อแบรนด์) ไม่โชว์ป้ายชื่อ", () => {
    render(<BrandTag brandId="a" variant="logo" />);
    const img = screen.getByAltText("ISSA Apparel") as HTMLImageElement;
    expect(img.src).toBe("https://x.test/a.jpg");
    expect(screen.queryByText("ISSA Apparel")).toBeNull();
  });

  it("ไม่มีโลโก้ → ตกไปใช้ป้ายชื่อแบบ chip", () => {
    render(<BrandTag brandId="b" variant="logo" />);
    expect(screen.getByText("Fasonaf")).toBeTruthy();
  });
});
