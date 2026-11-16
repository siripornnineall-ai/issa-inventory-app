import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AppIconMark, loadBrandLogoDataUrl } from "./appIcon";

describe("ไอคอนแอปโลโก้ ISSA", () => {
  it("อ่านไฟล์โลโก้ในแอปได้ → data URL แบบ PNG", async () => {
    const url = await loadBrandLogoDataUrl();
    expect(url).not.toBeNull();
    expect(url!.startsWith("data:image/png;base64,iVBOR")).toBe(true); // ลายเซ็น PNG
  });

  it("หาไฟล์ไม่เจอ → คืน null เพื่อใช้ไอคอน IS แทน ไม่ throw", async () => {
    expect(await loadBrandLogoDataUrl("ไม่มีไฟล์นี้.png")).toBeNull();
  });

  it("AppIconMark: มีโลโก้ → โชว์รูปบนพื้นขาว ไม่มีโลโก้ → ตัวอักษร IS บนพื้นเขียวเข้มแบบเดิม", () => {
    const withLogo = render(<AppIconMark size={192} logo="data:image/png;base64,AAAA" />);
    expect(withLogo.container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    withLogo.unmount();
    const without = render(<AppIconMark size={192} />);
    expect(without.container.querySelector("img")).toBeNull();
    expect(without.getByText("IS")).toBeTruthy();
  });
});
