import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UpdateBanner, VERSION_CHECK_INTERVAL_MS, VERSION_SNOOZE_MS } from "./UpdateBanner";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) }, from: () => ({}) }) }));

const fetchMock = vi.fn();

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function serverVersion(id: string | null, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => (id === null ? {} : { id }) });
}

describe("ป้ายมีเวอร์ชันใหม่ของแอป", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_BUILD_ID = "aaa111";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_BUILD_ID;
  });

  it("เวอร์ชันบนเซิร์ฟเวอร์ตรงกับของเครื่อง: ไม่แสดงป้าย", async () => {
    serverVersion("aaa111");
    render(<UpdateBanner />);
    await tick(3100);
    expect(fetchMock).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
    expect(screen.queryByText("มีเวอร์ชันใหม่ของแอป")).toBeNull();
  });

  it("เซิร์ฟเวอร์มีเวอร์ชันใหม่: ขึ้นป้ายพร้อมปุ่มอัปเดต และกด ไว้ทีหลัง แล้วป้ายหายชั่วคราว กลับมาเมื่อครบเวลา", async () => {
    serverVersion("bbb222");
    render(<UpdateBanner />);
    await tick(3100);
    expect(screen.getByText("มีเวอร์ชันใหม่ของแอป")).toBeTruthy();
    expect(screen.getByRole("button", { name: "อัปเดตตอนนี้" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ไว้ทีหลัง" }));
    expect(screen.queryByText("มีเวอร์ชันใหม่ของแอป")).toBeNull();

    await tick(VERSION_CHECK_INTERVAL_MS); // ตรวจรอบถัดไป ยังอยู่ในช่วงพัก
    expect(screen.queryByText("มีเวอร์ชันใหม่ของแอป")).toBeNull();

    await tick(VERSION_SNOOZE_MS); // พ้นช่วงพักแล้ว
    expect(screen.getByText("มีเวอร์ชันใหม่ของแอป")).toBeTruthy();
  });

  it("ถามเซิร์ฟเวอร์ไม่ได้ (ออฟไลน์/ตอบผิดปกติ): ไม่ถือว่ามีเวอร์ชันใหม่ ไม่ขึ้นป้ายมั่ว", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<UpdateBanner />);
    await tick(3100);
    expect(screen.queryByText("มีเวอร์ชันใหม่ของแอป")).toBeNull();

    serverVersion(null, false);
    await tick(VERSION_CHECK_INTERVAL_MS);
    expect(screen.queryByText("มีเวอร์ชันใหม่ของแอป")).toBeNull();
  });

  it("เครื่องไม่มีเลขเวอร์ชัน (เครื่องพัฒนา): ไม่ตรวจเลย", async () => {
    process.env.NEXT_PUBLIC_BUILD_ID = "dev";
    serverVersion("bbb222");
    render(<UpdateBanner />);
    await tick(VERSION_CHECK_INTERVAL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("มีเวอร์ชันใหม่ของแอป")).toBeNull();
  });
});
