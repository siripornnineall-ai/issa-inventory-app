import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SyncStatusBanner } from "./SyncStatusBanner";
import { SaveSuccessCard } from "@/components/stock/SaveSuccessCard";
import { emptyState } from "@/lib/store/state";
import { recordFailure, resetSyncStatusForTests, setPendingSyncs, failedSyncCount } from "@/lib/store/syncStatus";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) }, from: () => ({}) }) }));

const info = { docNo: "SIN-20261031-0600", totalQty: 3, lineCount: 1 };

describe("แถบเตือนบันทึกไม่สำเร็จ และสถานะบนหน้ายืนยัน", () => {
  beforeEach(() => {
    cleanup();
    resetSyncStatusForTests();
  });

  it("ไม่มีรายการค้าง: ไม่แสดงแถบ", () => {
    render(<SyncStatusBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("มีรายการที่ส่งไม่สำเร็จ: แถบแดงค้างบอกจำนวน สาเหตุ และมีปุ่มส่งอีกครั้ง/ทิ้ง", () => {
    render(<SyncStatusBanner />);
    act(() => {
      recordFailure(emptyState(), emptyState(), "บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ 2 รายการ", "u1");
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("มี 1 รายการที่ยังไม่ถูกบันทึกลงระบบ");
    expect(alert.textContent).toContain("ไม่สำเร็จ 2 รายการ");
    expect(screen.getByRole("button", { name: "ส่งอีกครั้งตอนนี้" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ทิ้งรายการที่ค้าง" }));
    expect(screen.getByRole("dialog").textContent).toContain("จะหายไปถาวร");
    expect(failedSyncCount()).toBe(1); // ยังไม่ทิ้งจนกว่าจะยืนยัน
  });

  it("หน้ายืนยันการบันทึก: ส่งเสร็จแล้วเขียว / ระหว่างส่งบอกกำลังบันทึก / ส่งไม่สำเร็จเตือนแดงและไม่บอกว่าเรียบร้อย", () => {
    const { rerender } = render(<SaveSuccessCard title="บันทึกแล้ว" info={info} againLabel="ต่อ" onAgain={() => {}} backHref="/x" backLabel="กลับ" />);
    expect(screen.getByRole("status").textContent).toContain("บันทึกลงฐานข้อมูลเรียบร้อยแล้ว");

    act(() => setPendingSyncs(1));
    expect(screen.getByRole("status").textContent).toContain("กำลังบันทึกลงฐานข้อมูล");
    expect(screen.getByRole("status").textContent).not.toContain("เรียบร้อยแล้ว");

    act(() => {
      recordFailure(emptyState(), emptyState(), "x", "u1");
      setPendingSyncs(0);
    });
    rerender(<SaveSuccessCard title="บันทึกแล้ว" info={info} againLabel="ต่อ" onAgain={() => {}} backHref="/x" backLabel="กลับ" />);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toContain("ยังไม่เข้าฐานข้อมูล");
    expect(text).not.toContain("เรียบร้อยแล้ว");
  });
});
