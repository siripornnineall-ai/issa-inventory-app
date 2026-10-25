import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { produce } from "immer";
import { SourceLinkCard } from "./SourceLinkCard";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: (m: string) => toastSuccess(m) }));

const ids = { bw: "", bm: "" };

function seed() {
  const state = produce(emptyState(), (d) => {
    d.users["u1"] = { id: "u1", name: "x", email: "x@x.com", role: "admin", active: true, createdAt: "2026-10-01T00:00:00Z" } as never;
    d.currentUserId = "u1";
    ids.bw = engine.createProduct(d, { sellingName: "Billie Wide", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    ids.bm = engine.createProduct(d, { sellingName: "Bobbie Mid", sellingPrice: 1090, category: "กางเกง", status: "active", images: [] });
    for (const size of ["M", "L"]) engine.addVariant(d, ids.bw, { color: "ดำ", size, purchasePrice: 200, sellingPrice: 1090 });
    for (const [color, size] of [["ดำ", "M"], ["ดำ", "L"], ["ครีม", "M"]]) engine.addVariant(d, ids.bm, { color, size, purchasePrice: 230, sellingPrice: 1090 });
  });
  useStore.getState().actions.hydrate(state);
}

const linkedCount = (productId: string) => Object.values(useStore.getState().variants).filter((v) => v.productId === productId && v.sourceVariantId).length;

describe("SourceLinkCard: ตั้งค่าเย็บตามออเดอร์", () => {
  beforeEach(() => {
    cleanup();
    toastError.mockClear();
    toastSuccess.mockClear();
    seed();
  });

  it("เลือกรุ่นตัวเปล่าแล้วกดเชื่อม: จับคู่ตามสี/ไซซ์ และแจ้งตัวที่หาคู่ไม่เจอ", () => {
    render(<SourceLinkCard productId={ids.bm} />);
    fireEvent.change(screen.getByLabelText("รุ่นตัวเปล่า"), { target: { value: ids.bw } });
    fireEvent.click(screen.getByRole("button", { name: "เชื่อม" }));
    expect(linkedCount(ids.bm)).toBe(2);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("ครีม / M"));
    expect(screen.getByText(/รุ่นนี้ตัดตัวเปล่าจาก/).textContent).toContain("Billie Wide");
    expect(screen.getByText(/เชื่อมแล้ว 2 จาก 3 ตัวเลือก/)).toBeTruthy();
  });

  it("ไม่เลือกรุ่นแล้วกดเชื่อม: เตือน ไม่เปลี่ยนอะไร / เลิกเชื่อมแล้วกลับไปใช้สต็อกตัวเอง", () => {
    render(<SourceLinkCard productId={ids.bm} />);
    fireEvent.click(screen.getByRole("button", { name: "เชื่อม" }));
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("เลือกรุ่น"));
    expect(linkedCount(ids.bm)).toBe(0);

    fireEvent.change(screen.getByLabelText("รุ่นตัวเปล่า"), { target: { value: ids.bw } });
    fireEvent.click(screen.getByRole("button", { name: "เชื่อม" }));
    fireEvent.click(screen.getByRole("button", { name: "เลิกเชื่อม" }));
    expect(linkedCount(ids.bm)).toBe(0);
    expect(screen.getByLabelText("รุ่นตัวเปล่า")).toBeTruthy();
  });

  it("หน้าของรุ่นตัวเปล่า (Billie Wide) บอกว่ามีรุ่นไหนตัดตัวเปล่าจากรุ่นนี้", () => {
    useStore.getState().actions.linkProductSource(ids.bm, ids.bw);
    render(<SourceLinkCard productId={ids.bw} />);
    expect(screen.getByText(/ตัวเปล่ารุ่นนี้ถูกใช้เย็บเป็น/).textContent).toContain("Bobbie Mid");
  });
});
