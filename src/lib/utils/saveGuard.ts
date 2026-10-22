"use client";

import { useCallback, useRef, useState } from "react";

// กันบันทึกซ้ำจากมือถือค้าง/กดรัว: ล็อกทันทีที่เริ่มบันทึก (ใช้ ref เพราะ state อัปเดตไม่ทันระหว่างที่คิวคำสั่งกดค้างอยู่)
// และเตือนเมื่อเพิ่งบันทึกรายการเหมือนกันเป๊ะไปไม่กี่นาทีก่อน

export interface SimilarDoc {
  no: string;
  createdAt: string;
}

// keep = บันทึกสำเร็จและหน้านี้จะเปลี่ยนไปหน้าอื่น/ขึ้นหน้ายืนยัน ให้ล็อกค้างไว้ / release = ปลดล็อก (ผิดพลาด หรือฟอร์มถูกล้างแล้วใช้ต่อได้)
export type SaveOutcome = "keep" | "release";

export function useSaveGuard() {
  const lockedRef = useRef(false);
  const pendingRef = useRef<(() => SaveOutcome) | null>(null);
  const [locked, setLocked] = useState(false);
  const [duplicate, setDuplicate] = useState<SimilarDoc | null>(null);

  const release = useCallback(() => {
    lockedRef.current = false;
    setLocked(false);
  }, []);

  const execute = useCallback(
    (save: () => SaveOutcome) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setLocked(true);
      let outcome: SaveOutcome = "release";
      try {
        outcome = save();
      } finally {
        if (outcome !== "keep") release();
      }
    },
    [release]
  );

  // similar: เจอรายการเหมือนกันที่เพิ่งบันทึกไป ให้ถามยืนยันก่อน (ยังไม่ล็อก ผู้ใช้เลือกยกเลิกได้)
  const run = useCallback(
    (save: () => SaveOutcome, similar?: SimilarDoc) => {
      if (lockedRef.current) return;
      if (similar) {
        pendingRef.current = save;
        setDuplicate(similar);
        return;
      }
      execute(save);
    },
    [execute]
  );

  const confirmDuplicate = useCallback(() => {
    const save = pendingRef.current;
    pendingRef.current = null;
    setDuplicate(null);
    if (save) execute(save);
  }, [execute]);

  const cancelDuplicate = useCallback(() => {
    pendingRef.current = null;
    setDuplicate(null);
  }, []);

  return { locked, duplicate, run, confirmDuplicate, cancelDuplicate };
}

export type SaveGuard = ReturnType<typeof useSaveGuard>;

interface DocLike {
  no: string;
  createdAt: string;
  lines: { itemId: string; qty: number }[];
}

function signature(lines: { itemId: string; qty: number }[]): string {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.itemId, (m.get(l.itemId) ?? 0) + l.qty);
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, q]) => `${id}:${q}`)
    .join("|");
}

// หาใบที่บันทึกไปเมื่อไม่นานมานี้ และมีรายการ+จำนวนเหมือนกันทุกตัว (ผู้เรียกกรองคนทำ/คลัง/ประเภทมาแล้ว)
export function findRecentSimilarDoc(
  docs: Iterable<DocLike>,
  lines: { itemId: string; qty: number }[],
  withinMs = 10 * 60 * 1000,
  now = Date.now()
): SimilarDoc | undefined {
  if (lines.length === 0) return undefined;
  const target = signature(lines);
  let best: DocLike | undefined;
  for (const d of docs) {
    const age = now - new Date(d.createdAt).getTime();
    if (age < 0 || age > withinMs) continue;
    if (signature(d.lines) !== target) continue;
    if (!best || new Date(d.createdAt).getTime() > new Date(best.createdAt).getTime()) best = d;
  }
  return best ? { no: best.no, createdAt: best.createdAt } : undefined;
}

export function formatAgo(createdAt: string, now = Date.now()): string {
  const sec = Math.max(0, Math.round((now - new Date(createdAt).getTime()) / 1000));
  if (sec < 60) return `${sec} วินาที`;
  return `${Math.round(sec / 60)} นาที`;
}
