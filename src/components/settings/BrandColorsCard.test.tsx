import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BrandColorsCard } from "./BrandColorsCard";
import { BrandTag } from "@/components/ui/BrandTag";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "x", email: "x@x.com", role: "admin", active: true, createdAt: "1" } },
    currentUserId: "u1",
    brands: {
      a: { id: "a", name: "ISSA Apparel", code: "IS", active: true, color: "#0A3941", createdAt: "1" },
      b: { id: "b", name: "ISSA Activewear", code: "IA", active: true, color: "#5DADC6", createdAt: "2" },
      c: { id: "c", name: "Fasonaf", code: "FS", active: true, createdAt: "3" },
    },
  } as never);
}

describe("สีประจำแบรนด์", () => {
  beforeEach(() => {
    cleanup();
    seed();
  });

  it("หน้าตั้งค่าโชว์สีของทุกแบรนด์ และบันทึกสีใหม่ลง store ได้เมื่อพิมพ์รหัสสีถูกต้อง", () => {
    render(<BrandColorsCard />);
    const hex = screen.getByLabelText("รหัสสีของ Fasonaf") as HTMLInputElement;
    expect(hex.value.toUpperCase()).toBe("#6B7F83"); // ยังไม่ตั้ง = สีกลาง
    const save = screen.getAllByRole("button", { name: "บันทึก" })[0] as HTMLButtonElement;
    expect(save.disabled).toBe(true); // ยังไม่ได้แก้ ปุ่มกดไม่ได้

    fireEvent.change(hex, { target: { value: "#111111" } });
    const fasonafSave = hex.parentElement!.querySelector("button") as HTMLButtonElement;
    expect(fasonafSave.disabled).toBe(false);
    fireEvent.click(fasonafSave);
    expect(useStore.getState().brands.c.color).toBe("#111111");
  });

  it("รหัสสีผิดรูปแบบ → ปุ่มบันทึกกดไม่ได้ ไม่เขียนค่าผิดลง store", () => {
    render(<BrandColorsCard />);
    const hex = screen.getByLabelText("รหัสสีของ ISSA Apparel") as HTMLInputElement;
    fireEvent.change(hex, { target: { value: "#12" } });
    const btn = hex.parentElement!.querySelector("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(useStore.getState().brands.a.color).toBe("#0A3941");
  });

  it("ป้ายแบรนด์ใช้สีของแบรนด์เป็นจุด และตัวอักษรเป็นชื่อแบรนด์; ไม่มีแบรนด์ → ข้อความสำรอง", () => {
    const { container } = render(
      <>
        <BrandTag brandId="b" variant="chip" />
        <BrandTag brandId="zzz" />
      </>
    );
    expect(screen.getByText("ISSA Activewear")).toBeTruthy();
    const dot = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect(dot.style.background.toLowerCase()).toContain("rgb(93, 173, 198)");
    expect(screen.getByText("-")).toBeTruthy();
  });
});
