"use client";

import { useSyncExternalStore } from "react";

// จอมือถือ (< 640px = ต่ำกว่าจุด sm ของ Tailwind) ฝั่งเซิร์ฟเวอร์/เทสต์ที่ไม่มี matchMedia ถือเป็นจอใหญ่
const QUERY = "(max-width: 639px)";

function subscribe(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && !!window.matchMedia ? window.matchMedia(QUERY).matches : false),
    () => false
  );
}

// ตัวเลขในช่องตารางไซซ์: บนมือถือช่องแคบมาก ตั้งแต่ 1,000 ขึ้นไปย่อเป็น 1.2k ให้พอดีช่อง (จอใหญ่/เทสต์แสดงเต็มเหมือนเดิม)
export function compactCellNumber(n: number, mobile: boolean, full: (n: number) => string): string {
  if (!mobile || Math.abs(n) < 1000) return full(n);
  const k = Math.round(Math.abs(n) / 100) / 10;
  return `${n < 0 ? "-" : ""}${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}
