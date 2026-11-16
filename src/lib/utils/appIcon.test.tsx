import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { AppIconMark, loadBrandLogoDataUrl } from "./appIcon";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(res: Partial<Response> | Error) {
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res as Response;
  }));
}

describe("ไอคอนแอปโลโก้ ISSA", () => {
  it("ดึงโลโก้สำเร็จ → คืน data URL ของรูป", async () => {
    stubFetch({ ok: true, headers: new Headers({ "content-type": "image/jpeg" }), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    expect(await loadBrandLogoDataUrl("https://x.test/logo.jpg")).toBe("data:image/jpeg;base64,AQID");
  });

  it("ดึงไม่ได้ (เครือข่ายล้ม / ไม่ใช่ไฟล์รูป / ตอบไม่ ok) → คืน null เพื่อใช้ไอคอน IS แทน ไม่ throw", async () => {
    stubFetch(new Error("network"));
    expect(await loadBrandLogoDataUrl("https://x.test/a")).toBeNull();
    stubFetch({ ok: false, headers: new Headers() });
    expect(await loadBrandLogoDataUrl("https://x.test/a")).toBeNull();
    stubFetch({ ok: true, headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new ArrayBuffer(4) });
    expect(await loadBrandLogoDataUrl("https://x.test/a")).toBeNull();
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
