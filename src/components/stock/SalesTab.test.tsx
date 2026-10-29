import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { SalesTab } from "./SalesTab";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import * as excel from "@/lib/utils/excelMonths";

vi.mock("@/lib/utils/excelMonths", async (orig) => ({ ...(await orig<typeof import("@/lib/utils/excelMonths")>()), downloadWorkbook: vi.fn() }));

function StockOutOverviewPage() {
  const [brandId, setBrandId] = useState("");
  return <SalesTab brandId={brandId} setBrandId={setBrandId} />;
}

const line = (variantId: string, productId: string, qty: number) => ({ id: variantId + qty, productId, variantId, qty, unitPrice: 100, discount: 0 });

function seed() {
  const o = (id: string, date: string, lines: ReturnType<typeof line>[]) => ({ id, orderNo: id, date, channel: "online", warehouseId: "w1", lines, status: "completed", restocked: false, createdAt: date });
  useStore.getState().actions.hydrate({
    ...emptyState(),
    brands: {
      b1: { id: "b1", name: "ISSA Apparel", code: "IS", active: true, createdAt: "" },
      b2: { id: "b2", name: "Fasonaf", code: "FS", active: true, createdAt: "" },
    },
    products: {
      p1: { id: "p1", sellingName: "Billie Slim", brandId: "b1", createdAt: "" },
      p2: { id: "p2", sellingName: "Fitty Leggings", brandId: "b2", createdAt: "" },
    },
    variants: {
      v1: { id: "v1", productId: "p1", color: "ดำ", size: "M", sku: "a", active: true },
      v2: { id: "v2", productId: "p1", color: "ครีม", size: "M", sku: "b", active: true },
      v3: { id: "v3", productId: "p2", color: "ดำ", size: "S", sku: "c", active: true },
    },
    orders: {
      o1: o("o1", "2026-10-15T10:00:00", [line("v1", "p1", 6), line("v2", "p1", 2), line("v3", "p2", 4)]),
      o2: o("o2", "2026-09-15T10:00:00", [line("v1", "p1", 4)]),
    },
  } as never);
}

describe("แท็บยอดขาย (สต็อกภาพรวม)", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T09:00:00"));
    seed();
  });
  afterEach(() => vi.useRealTimers());

  it("เปิดมาเป็นเดือนนี้ แสดงยอดสุทธิรวมและทุกรุ่นที่ขายได้ เรียงมากไปน้อย", () => {
    render(<StockOutOverviewPage />);
    expect(screen.getByRole("status").textContent).toContain("12 ชิ้น จาก 2 รุ่น");
    const names = screen.getAllByText(/^(Billie Slim|Fitty Leggings)$/).map((e) => e.textContent);
    expect(names).toEqual(["Billie Slim", "Fitty Leggings"]);
    expect(screen.getByText(/ขาย 8 − คืน 0 = /).textContent).toContain("สุทธิ 8 ชิ้น");
    expect(screen.getByText(/เดือนก่อน 4/)).toBeTruthy(); // กันยายน 4 ชิ้น
  });

  it("กดเดือนก่อน: เห็นยอดของเดือนนั้น และเดือนถัดไป/เดือนนี้ใช้ได้ แต่เดือนอนาคตกดไม่ได้", () => {
    render(<StockOutOverviewPage />);
    const next = screen.getByRole("button", { name: "เดือนถัดไป" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    expect(screen.getByRole("status").textContent).toContain("4 ชิ้น จาก 1 รุ่น");
    expect(next.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "เดือนนี้" }));
    expect(screen.getByRole("status").textContent).toContain("12 ชิ้น");
  });

  it("เดือนที่เริ่มก่อน 12 ต.ค. 2569 มีคำเตือนว่าข้อมูลอาจไม่ครบ ส่วนเดือนหลังจากนั้นไม่มี", () => {
    render(<StockOutOverviewPage />);
    expect(screen.getByRole("alert").textContent).toContain("ก่อนที่ระบบเริ่มบันทึกการขายจริง"); // ต.ค. เริ่มวันที่ 1
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("แถบหัวตารางเปลี่ยนสีตามแบรนด์ของรุ่น: แบรนด์ที่ตั้งสีไว้ได้สีของตัวเอง แบรนด์ที่ไม่มีสียังเป็นสีเดิม", () => {
    useStore.setState((st) => ({ brands: { ...st.brands, b2: { ...st.brands.b2, color: "#5DADC6" } } }));
    const { container } = render(<StockOutOverviewPage />);
    const card = (name: string) => screen.getByText(name).closest("details")!.parentElement as HTMLElement;
    expect(card("Fitty Leggings").style.getPropertyValue("--bar")).toBe("#5DADC6");
    expect(card("Fitty Leggings").style.getPropertyValue("--bar-fg")).toBe("#0c1e20"); // ฟ้าอ่อน ใช้ตัวอักษรเข้ม
    expect(card("Billie Slim").style.getPropertyValue("--bar")).toBe(""); // แบรนด์ไม่มีสี
    expect(container).toBeTruthy();
  });

  it("กรองด้วยแบรนด์และค้นหาชื่อรุ่น", () => {
    render(<StockOutOverviewPage />);
    fireEvent.change(screen.getByLabelText("แบรนด์"), { target: { value: "b2" } });
    expect(screen.queryByText("Billie Slim")).toBeNull();
    expect(screen.getByText("Fitty Leggings")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("แบรนด์"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("ค้นหารุ่น"), { target: { value: "billie" } });
    expect(screen.getByText("Billie Slim")).toBeTruthy();
    expect(screen.queryByText("Fitty Leggings")).toBeNull();
  });

  it("ตารางรุ่น: สีเรียงมากไปน้อย มี % และรวมต่อไซซ์", () => {
    render(<StockOutOverviewPage />);
    const table = screen.getAllByRole("table")[0];
    const rows = within(table).getAllByRole("row");
    expect(rows[1].textContent).toContain("ดำ");
    expect(rows[1].textContent).toContain("75%");
    expect(rows[2].textContent).toContain("ครีม");
    expect(rows[2].textContent).toContain("25%");
    expect(rows[3].textContent).toContain("รวมต่อไซซ์");
  });

  it("เดือนที่ไม่มียอดแสดงข้อความว่างและปุ่มส่งออกกดไม่ได้", () => {
    render(<StockOutOverviewPage />);
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    expect(screen.getByText("ไม่มียอดขายในช่วงนี้")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Excel ช่วงที่เลือก/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Excel ทุกเดือนย้อนหลัง: ไฟล์เดียว หนึ่งชีตต่อเดือน เรียงใหม่ไปเก่า ใช้ตัวกรองแบรนด์เดียวกัน", () => {
    const download = vi.mocked(excel.downloadWorkbook);
    download.mockClear();
    render(<StockOutOverviewPage />);
    fireEvent.click(screen.getByRole("button", { name: /Excel ทุกเดือนย้อนหลัง/ }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe("ยอดขาย-ทุกเดือน.xlsx");
    expect(download.mock.calls[0][1].map((s) => s.name)).toEqual(["2026-10", "2026-09"]);
    expect(download.mock.calls[0][1][1].rows.flat().join(" ")).toContain("ช่วงก่อน 12 ต.ค. 2569 อาจไม่ครบ");

    download.mockClear();
    fireEvent.change(screen.getByLabelText("แบรนด์"), { target: { value: "b2" } });
    fireEvent.click(screen.getByRole("button", { name: /Excel ทุกเดือนย้อนหลัง/ }));
    expect(download.mock.calls[0][1].map((s) => s.name)).toEqual(["2026-10"]); // Fitty ขายแค่ ต.ค.
  });

  it("Excel ช่วงที่เลือก: ได้เฉพาะเดือนที่ดูอยู่", () => {
    const download = vi.mocked(excel.downloadWorkbook);
    download.mockClear();
    render(<StockOutOverviewPage />);
    fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
    fireEvent.click(screen.getByRole("button", { name: /Excel ช่วงที่เลือก/ }));
    expect(download.mock.calls[0][0]).toBe("ยอดขาย-2026-09.xlsx");
    expect(download.mock.calls[0][1].map((s) => s.name)).toEqual(["2026-09"]);
  });
  it("เลือกเป็นช่วงวันที่ได้: นับเฉพาะวันในช่วง เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน และส่งออกเป็นช่วงนั้น", () => {
    const download = vi.mocked(excel.downloadWorkbook);
    download.mockClear();
    render(<StockOutOverviewPage />);
    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("ถึงวันที่"), { target: { value: "2026-10-20" } });
    expect(screen.getByRole("status").textContent).toContain("ช่วง"); // ไม่ใช่ทั้งเดือนแล้ว
    expect(screen.getByRole("status").textContent).toContain("12 ชิ้น จาก 2 รุ่น"); // ออเดอร์ o1 วันที่ 15 อยู่ในช่วง
    expect(screen.getByText("กำหนดช่วงเอง")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: "2026-10-16" } });
    expect(screen.getByText("ไม่มียอดขายในช่วงนี้")).toBeTruthy(); // วันที่ 15 หลุดช่วงแล้ว

    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: "2026-10-14" } });
    fireEvent.click(screen.getByRole("button", { name: /Excel ช่วงที่เลือก/ }));
    expect(download.mock.calls[0][0]).toBe("ยอดขาย-2026-10-14_2026-10-20.xlsx");
    expect(download.mock.calls[0][1].map((s) => s.name)).toEqual(["2026-10-14_2026-10-20"]);
  });

  it("เลือกวันเริ่มเลยวันสิ้นสุด: วันสิ้นสุดตามมา และกด เดือนนี้ กลับเป็นทั้งเดือน", () => {
    render(<StockOutOverviewPage />);
    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("ถึงวันที่"), { target: { value: "2026-10-21" } });
    fireEvent.change(screen.getByLabelText("ตั้งแต่วันที่"), { target: { value: "2026-10-25" } });
    expect((screen.getByLabelText("ถึงวันที่") as HTMLInputElement).value).toBe("2026-10-25");
    fireEvent.click(screen.getByRole("button", { name: "เดือนนี้" }));
    expect((screen.getByLabelText("ตั้งแต่วันที่") as HTMLInputElement).value).toBe("2026-10-01");
    expect((screen.getByLabelText("ถึงวันที่") as HTMLInputElement).value).toBe("2026-10-31");
  });});
