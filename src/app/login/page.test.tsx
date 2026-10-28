import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import { PinError } from "@/lib/supabase/pinAuth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const pinList = vi.fn();
const pinLogin = vi.fn();
const hasPin = vi.fn();
vi.mock("@/lib/supabase/pinAuth", async (orig) => ({
  ...(await orig<typeof import("@/lib/supabase/pinAuth")>()),
  pinList: (...a: unknown[]) => pinList(...a),
  pinLogin: (...a: unknown[]) => pinLogin(...a),
  hasPin: (...a: unknown[]) => hasPin(...a),
}));

const setSession = vi.fn();
const signIn = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { setSession, signInWithPassword: signIn, signOut } }) }));

const fetchAppState = vi.fn();
vi.mock("@/lib/supabase/fetch", () => ({ fetchAppState: (...a: unknown[]) => fetchAppState(...a) }));

const staff = { id: "u1", name: "วิชัย ศรีสุข", email: "w@x.com", role: "warehouse", active: true, createdAt: "" };
const stateWith = (user = staff) => ({ ...emptyState(), users: { [user.id]: user } });

async function pressPin(digits: string) {
  for (const d of digits) fireEvent.click(screen.getByRole("button", { name: d }));
}

describe("หน้าเข้าสู่ระบบ: การ์ดชื่อ + PIN", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    useStore.getState().actions.hydrate(emptyState());
    pinList.mockResolvedValue([
      { id: "u1", name: "วิชัย ศรีสุข", role: "warehouse" },
      { id: "u2", name: "นภา วงศ์ไทย", role: "manager" },
    ]);
    fetchAppState.mockResolvedValue(stateWith());
    setSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    signOut.mockResolvedValue({});
  });

  it("มีคนตั้ง PIN แล้ว: โชว์การ์ดชื่อและตำแหน่งของแต่ละคน พร้อมทางเข้าด้วยอีเมล", async () => {
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "เลือกบัญชีของคุณ" })).toBeTruthy();
    expect(screen.getByText("วิชัย ศรีสุข")).toBeTruthy();
    expect(screen.getByText("นภา วงศ์ไทย")).toBeTruthy();
    expect(screen.getByRole("button", { name: "เข้าด้วยอีเมลและรหัสผ่าน" })).toBeTruthy();
  });

  it("ยังไม่มีใครตั้ง PIN (หรือโหลดรายชื่อไม่ได้): ตกไปหน้าอีเมลและรหัสผ่านเหมือนเดิม", async () => {
    pinList.mockResolvedValue([]);
    render(<LoginPage />);
    expect(await screen.findByRole("heading", { name: "เข้าสู่ระบบ" })).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.queryByText("กลับไปเลือกชื่อ")).toBeNull();
  });

  it("แตะชื่อ แล้วกด PIN ครบ 6 หลัก: ส่งไปตรวจที่เซิร์ฟเวอร์ ตั้งเซสชัน แล้วเข้าแดชบอร์ด", async () => {
    pinLogin.mockResolvedValue({ access_token: "a", refresh_token: "r" });
    render(<LoginPage />);
    fireEvent.click(await screen.findByText("วิชัย ศรีสุข"));
    expect(screen.getByRole("heading", { name: "วิชัย ศรีสุข" })).toBeTruthy();
    await pressPin("482915");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(pinLogin).toHaveBeenCalledWith("u1", "482915");
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    expect(useStore.getState().currentUserId).toBe("u1");
  });

  it("PIN ผิด: แจ้งเหลือกี่ครั้ง ล้างจุดที่กรอก และกรอกใหม่ได้", async () => {
    pinLogin.mockRejectedValue(new PinError("PIN ไม่ถูกต้อง", 401, { attemptsLeft: 3 }));
    render(<LoginPage />);
    fireEvent.click(await screen.findByText("วิชัย ศรีสุข"));
    await pressPin("482916");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("PIN ไม่ถูกต้อง");
    expect(alert.textContent).toContain("เหลืออีก 3 ครั้ง");
    expect(replace).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "1" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ถูกล็อก: แสดงข้อความของเซิร์ฟเวอร์ และปิดแป้นกด PIN ไว้", async () => {
    pinLogin.mockRejectedValue(new PinError("ใส่ PIN ผิด 5 ครั้ง บัญชีนี้ถูกล็อกชั่วคราว", 423, { minutesLeft: 15 }));
    render(<LoginPage />);
    fireEvent.click(await screen.findByText("วิชัย ศรีสุข"));
    await pressPin("482916");
    expect((await screen.findByRole("alert")).textContent).toContain("ถูกล็อกชั่วคราว");
    await waitFor(() => expect((screen.getByRole("button", { name: "1" }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("บัญชีถูกปิดใช้งานระหว่างนั้น: ไม่ให้เข้า และออกจากเซสชัน", async () => {
    pinLogin.mockResolvedValue({ access_token: "a", refresh_token: "r" });
    fetchAppState.mockResolvedValue(stateWith({ ...staff, active: false }));
    render(<LoginPage />);
    fireEvent.click(await screen.findByText("วิชัย ศรีสุข"));
    await pressPin("482915");
    expect((await screen.findByRole("alert")).textContent).toContain("ถูกปิดใช้งาน");
    expect(signOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("กด เปลี่ยนบัญชี กลับไปหน้าการ์ด และ ลืม PIN พาไปหน้าอีเมล", async () => {
    render(<LoginPage />);
    fireEvent.click(await screen.findByText("วิชัย ศรีสุข"));
    fireEvent.click(screen.getByRole("button", { name: /เปลี่ยนบัญชี/ }));
    expect(screen.getByRole("heading", { name: "เลือกบัญชีของคุณ" })).toBeTruthy();
    fireEvent.click(screen.getByText("นภา วงศ์ไทย"));
    fireEvent.click(screen.getByRole("button", { name: /ลืม PIN/ }));
    expect(screen.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeTruthy();
    expect(screen.getByText("กลับไปเลือกชื่อ")).toBeTruthy();
  });
});

describe("หน้าเข้าสู่ระบบ: เข้าด้วยรหัสผ่านแล้วชวนตั้ง PIN", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    useStore.getState().actions.hydrate(emptyState());
    pinList.mockResolvedValue([]);
    signIn.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    signOut.mockResolvedValue({});
  });

  async function loginWithPassword() {
    render(<LoginPage />);
    await screen.findByRole("heading", { name: "เข้าสู่ระบบ" });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "w@x.com" } });
    fireEvent.change(document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement, { target: { value: "รหัสผ่านเดิม1" } });
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
  }

  it("พนักงานที่ยังไม่มี PIN: ถามก่อนเข้าระบบ กด ไว้ทีหลัง แล้วเข้าต่อและไม่ถามซ้ำภายใน 7 วัน", async () => {
    fetchAppState.mockResolvedValue(stateWith());
    hasPin.mockResolvedValue(false);
    await loginWithPassword();
    expect(await screen.findByText("ตั้ง PIN เพื่อเข้าระบบเร็วขึ้น")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ไว้ทีหลัง" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(localStorage.getItem("issa-pin-prompt-snooze:u1")).not.toBeNull();

    cleanup();
    replace.mockClear();
    useStore.getState().actions.hydrate(emptyState());
    await loginWithPassword();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("ตั้ง PIN เพื่อเข้าระบบเร็วขึ้น")).toBeNull();
  });

  it("มี PIN อยู่แล้ว: เข้าระบบเลย ไม่ถาม", async () => {
    fetchAppState.mockResolvedValue(stateWith());
    hasPin.mockResolvedValue(true);
    await loginWithPassword();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("ตั้ง PIN เพื่อเข้าระบบเร็วขึ้น")).toBeNull();
  });

  it("ผู้ดูแลระบบไม่ถูกชวนตั้ง PIN (ใช้ PIN ไม่ได้)", async () => {
    fetchAppState.mockResolvedValue(stateWith({ ...staff, role: "admin" }));
    hasPin.mockResolvedValue(false);
    await loginWithPassword();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(hasPin).not.toHaveBeenCalled();
  });

  it("อีเมลหรือรหัสผ่านผิด: แจ้งข้อความเดิม", async () => {
    signIn.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    await loginWithPassword();
    expect(await screen.findByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeTruthy();
  });
});
