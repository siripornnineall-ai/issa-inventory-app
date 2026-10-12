import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDraft } from "./useDraft";

const KEY = "issa-draft:test";

describe("useDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("พิมพ์/สแกนค้างไว้ → เก็บลงเครื่อง กลับมาเปิดใหม่ → พบร่างและกู้คืนได้", () => {
    const first = renderHook(({ v }) => useDraft({ key: KEY, value: v, hasContent: v.n > 0, onRestore: () => {} }), { initialProps: { v: { n: 0 } } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    first.rerender({ v: { n: 3 } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(JSON.parse(window.localStorage.getItem(KEY)!).value).toEqual({ n: 3 });
    first.unmount();

    // เปิดแอปใหม่: หน้าว่างเริ่มต้น ต้องไม่เขียนทับร่างเดิมก่อนผู้ใช้ตัดสินใจ
    let restored: unknown = null;
    const second = renderHook(() => useDraft({ key: KEY, value: { n: 0 }, hasContent: false, onRestore: (v: { n: number }) => (restored = v) }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(second.result.current.draft?.value).toEqual({ n: 3 });
    expect(JSON.parse(window.localStorage.getItem(KEY)!).value).toEqual({ n: 3 });
    act(() => second.result.current.restore());
    expect(restored).toEqual({ n: 3 });
  });

  it("กดทิ้ง → ลบร่าง", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ savedAt: new Date().toISOString(), value: { n: 2 } }));
    const { result } = renderHook(() => useDraft({ key: KEY, value: { n: 0 }, hasContent: false, onRestore: () => {} }));
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current.draft).not.toBeNull();
    act(() => result.current.discard());
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("บันทึกสำเร็จ (clear) แล้ว ตัวหน่วงเวลาที่ค้างอยู่ไม่เขียนร่างกลับ", () => {
    const { result, rerender } = renderHook(({ v }) => useDraft({ key: KEY, value: v, hasContent: true, onRestore: () => {} }), { initialProps: { v: { n: 1 } } });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    rerender({ v: { n: 2 } }); // มีตัวหน่วงเวลาค้าง
    act(() => result.current.clear());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
