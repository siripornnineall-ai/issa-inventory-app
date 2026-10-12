"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// เก็บร่างรายการที่ยังไม่ได้บันทึก (เช่นสแกนป้ายค้างไว้ในหน้ารับเข้า/เบิกออก) ไว้ในเครื่อง เผื่อปิดแอป/สลับแอป/เครื่องรีโหลดหน้า
// เปิดกลับมาจะถามว่าจะทำต่อไหม ไม่กู้คืนเองเงียบ ๆ (กันของเก่าค้างมาปนกับงานใหม่)
interface Stored<T> {
  savedAt: string;
  value: T;
}

function readStored<T>(key: string): Stored<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null;
  }
}

function writeStored<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), value } satisfies Stored<T>));
  } catch {
    // พื้นที่เก็บเต็ม/โหมดส่วนตัว: ข้ามเงียบ ๆ ระบบยังใช้งานได้ตามปกติ แค่ไม่มีร่างสำรอง
  }
}

function removeStored(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useDraft<T>(opts: { key: string | null; value: T; hasContent: boolean; onRestore: (value: T) => void }) {
  const { key, value, hasContent } = opts;
  const onRestoreRef = useRef(opts.onRestore);
  useEffect(() => {
    onRestoreRef.current = opts.onRestore;
  });

  const [found, setFound] = useState<Stored<T> | null>(null);
  // ยังไม่ตัดสินใจว่าจะกู้คืนหรือทิ้ง: ห้ามเขียนทับร่างเดิมด้วยฟอร์มว่างของหน้าที่เพิ่งเปิด
  const [decided, setDecided] = useState(false);
  const loadedKey = useRef<string | null>(null);
  // หลังบันทึกสำเร็จ/ยกเลิก (clear) ห้ามเขียนร่างกลับลงไปอีก แม้ยังมีตัวหน่วงเวลาค้างอยู่ก่อนหน้า
  const cleared = useRef(false);

  useEffect(() => {
    if (!key || loadedKey.current === key) return;
    loadedKey.current = key;
    const stored = readStored<T>(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- อ่านค่าจาก localStorage ได้เฉพาะฝั่งเบราว์เซอร์หลังโหลดหน้า
    if (stored) setFound(stored);
    else setDecided(true);
  }, [key]);

  // บันทึกร่างทุกครั้งที่ข้อมูลเปลี่ยน (หน่วงเล็กน้อย) ลบทิ้งเมื่อฟอร์มว่าง
  useEffect(() => {
    if (!key || !decided) return;
    const t = setTimeout(() => {
      if (cleared.current) return;
      if (hasContent) writeStored(key, value);
      else removeStored(key);
    }, 300);
    return () => clearTimeout(t);
  }, [key, decided, hasContent, value]);

  const restore = useCallback(() => {
    if (!found) return;
    onRestoreRef.current(found.value);
    setFound(null);
    setDecided(true);
  }, [found]);

  const discard = useCallback(() => {
    if (key) removeStored(key);
    setFound(null);
    setDecided(true);
  }, [key]);

  // เรียกหลังบันทึกสำเร็จ หรือเมื่อผู้ใช้กดยกเลิกเอง
  const clear = useCallback(() => {
    cleared.current = true;
    if (key) removeStored(key);
  }, [key]);

  return { draft: found, restore, discard, clear };
}
