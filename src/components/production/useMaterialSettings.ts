"use client";

import { useMemo, useState } from "react";
import { parsePocketMap, parseRates, type MaterialRate, type PocketColor } from "@/lib/utils/materialPlan";

const RATES_KEY = "issa-material-rates";
const POCKET_KEY = "issa-material-pocket-colors";

function read(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // เก็บไม่ได้ก็ใช้ค่าในหน้านี้ไปก่อน
  }
}

// อัตราใช้ผ้าต่อตัวและสีผ้ากระเป๋าของแต่ละสี: ใช้ร่วมกันระหว่างการ์ดวัสดุกับตารางข้างตารางที่ต้องผลิตของแต่ละรุ่น จำไว้ในเครื่องนี้
export function useMaterialSettings() {
  const [rates, setRates] = useState<MaterialRate[]>(() => parseRates(read(RATES_KEY)));
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rates.map((x) => [x.key, String(x.perPiece)])));
  const [pocketMap, setPocketMap] = useState<Record<string, PocketColor>>(() => parsePocketMap(read(POCKET_KEY)));

  function editRate(key: string, text: string) {
    setDraft((d) => ({ ...d, [key]: text }));
    const v = Number(text);
    if (text.trim() === "" || !Number.isFinite(v) || v < 0) return;
    const next = rates.map((r) => (r.key === key ? { ...r, perPiece: v } : r));
    setRates(next);
    write(RATES_KEY, Object.fromEntries(next.map((r) => [r.key, r.perPiece])));
  }

  function setPocket(color: string, value: PocketColor) {
    const next = { ...pocketMap, [color]: value };
    setPocketMap(next);
    write(POCKET_KEY, next);
  }

  const perPiece = useMemo(() => ({ main: rates.find((r) => r.key === "main")?.perPiece ?? 0, pocket: rates.find((r) => r.key === "pocket")?.perPiece ?? 0 }), [rates]);
  return { rates, draft, pocketMap, perPiece, editRate, setPocket };
}

export type MaterialSettings = ReturnType<typeof useMaterialSettings>;
