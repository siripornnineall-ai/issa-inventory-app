import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { findRecentSimilarDoc, formatAgo, useSaveGuard } from "./saveGuard";

const NOW = new Date("2026-10-22T13:40:00.000Z").getTime();
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

describe("useSaveGuard: ล็อกกันบันทึกซ้ำ", () => {
  it("กดสองครั้งติดกันในจังหวะเดียว (มือถือค้างแล้วคิวคำสั่งกดไหลมาพร้อมกัน) บันทึกแค่ครั้งเดียว", () => {
    const { result } = renderHook(() => useSaveGuard());
    const save = vi.fn((): "keep" => "keep");
    act(() => {
      result.current.run(save);
      result.current.run(save); // ตัวที่สองมาก่อนที่หน้าจะวาดใหม่ ปุ่มยังไม่ทันเปลี่ยนเป็นกำลังบันทึก
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.locked).toBe(true);
    act(() => result.current.run(save));
    expect(save).toHaveBeenCalledTimes(1); // สำเร็จแล้ว (keep) ล็อกค้างไว้ ไม่ปลดเอง
  });

  it("บันทึกไม่สำเร็จ (release) ปลดล็อกให้ลองใหม่ได้", () => {
    const { result } = renderHook(() => useSaveGuard());
    const save = vi.fn((): "release" => "release");
    act(() => result.current.run(save));
    expect(result.current.locked).toBe(false);
    act(() => result.current.run(save));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("ถ้า save โยน error ก็ปลดล็อก ไม่ค้างกดไม่ได้อีก", () => {
    const { result } = renderHook(() => useSaveGuard());
    expect(() => act(() => result.current.run(() => { throw new Error("boom"); }))).toThrow("boom");
    expect(result.current.locked).toBe(false);
  });

  it("เจอรายการเหมือนกันที่เพิ่งบันทึก: ถามก่อน ยังไม่บันทึก / ยืนยันแล้วค่อยบันทึก / ยกเลิกแล้วไม่บันทึก", () => {
    const { result } = renderHook(() => useSaveGuard());
    const save = vi.fn((): "keep" => "keep");
    act(() => result.current.run(save, { no: "SIN-1", createdAt: ago(5) }));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.duplicate?.no).toBe("SIN-1");
    expect(result.current.locked).toBe(false);

    act(() => result.current.cancelDuplicate());
    expect(result.current.duplicate).toBeNull();
    expect(save).not.toHaveBeenCalled();

    act(() => result.current.run(save, { no: "SIN-1", createdAt: ago(5) }));
    act(() => result.current.confirmDuplicate());
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.duplicate).toBeNull();
  });
});

describe("findRecentSimilarDoc", () => {
  const doc = (no: string, createdAt: string, lines: { itemId: string; qty: number }[]) => ({ no, createdAt, lines });

  it("รายการและจำนวนเหมือนกันทุกตัว ภายใน 10 นาที = ซ้ำ (ลำดับแถวไม่สำคัญ)", () => {
    const found = findRecentSimilarDoc(
      [doc("A", ago(5), [{ itemId: "v1", qty: 3 }, { itemId: "v2", qty: 1 }])],
      [{ itemId: "v2", qty: 1 }, { itemId: "v1", qty: 3 }],
      undefined,
      NOW
    );
    expect(found?.no).toBe("A");
  });

  it("จำนวนต่างกัน / มีรายการเพิ่ม / เกิน 10 นาที = ไม่ถือว่าซ้ำ", () => {
    const lines = [{ itemId: "v1", qty: 3 }];
    expect(findRecentSimilarDoc([doc("A", ago(5), [{ itemId: "v1", qty: 4 }])], lines, undefined, NOW)).toBeUndefined();
    expect(findRecentSimilarDoc([doc("A", ago(5), [{ itemId: "v1", qty: 3 }, { itemId: "v2", qty: 1 }])], lines, undefined, NOW)).toBeUndefined();
    expect(findRecentSimilarDoc([doc("A", ago(11 * 60), lines)], lines, undefined, NOW)).toBeUndefined();
    expect(findRecentSimilarDoc([], lines, undefined, NOW)).toBeUndefined();
    expect(findRecentSimilarDoc([doc("A", ago(5), lines)], [], undefined, NOW)).toBeUndefined();
  });

  it("ถ้ามีหลายใบที่เหมือนกัน เลือกใบที่ใหม่สุด", () => {
    const lines = [{ itemId: "v1", qty: 1 }];
    expect(findRecentSimilarDoc([doc("OLD", ago(300), lines), doc("NEW", ago(10), lines)], lines, undefined, NOW)?.no).toBe("NEW");
  });
});

describe("formatAgo", () => {
  it("แสดงเป็นวินาทีถ้าไม่ถึงนาที ไม่งั้นเป็นนาที", () => {
    expect(formatAgo(ago(5), NOW)).toBe("5 วินาที");
    expect(formatAgo(ago(180), NOW)).toBe("3 นาที");
  });
});
