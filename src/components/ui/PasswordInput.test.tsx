import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("เริ่มต้นซ่อนรหัส กดรูปตาแล้วแสดง กดอีกครั้งซ่อนกลับ", () => {
    render(<PasswordInput data-testid="pw" defaultValue="secret123" />);
    const input = screen.getByTestId("pw") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่าน" }));
    expect(input.type).toBe("text");
    expect(input.value).toBe("secret123");
    fireEvent.click(screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" }));
    expect(input.type).toBe("password");
  });

  it("ปุ่มรูปตาไม่ส่งฟอร์ม", () => {
    let submitted = false;
    render(
      <form onSubmit={(e) => { e.preventDefault(); submitted = true; }}>
        <PasswordInput />
      </form>
    );
    fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่าน" }));
    expect(submitted).toBe(false);
  });
});
