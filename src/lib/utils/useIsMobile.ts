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
