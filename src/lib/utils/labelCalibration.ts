"use client";

import { useState } from "react";

// ค่าตั้งค่าตำแหน่งพิมพ์ป้าย QR ให้ตรงกับช่องสติกเกอร์จริง (ผู้ใช้ปรับเองได้ในหน้าพิมพ์ ไม่ต้องแก้โค้ด)
export interface LabelCalibration {
  columns: number;
  cellWidthMm: number;
  cellHeightMm: number;
  colGapMm: number;
  rowGapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
}

export const DEFAULT_LABEL_CALIBRATION: LabelCalibration = {
  columns: 3,
  cellWidthMm: 50,
  cellHeightMm: 25,
  colGapMm: 4,
  rowGapMm: 3,
  marginTopMm: 8,
  marginLeftMm: 8,
};

const STORAGE_KEY = "issa-qr-label-calibration";

// เก็บค่าไว้ใน localStorage ของเบราว์เซอร์เครื่องนั้น ๆ ใช้ร่วมกันทั้งหน้าพิมพ์บาร์โค้ดแบบรุ่นเดียวและหลายรุ่น
export function useLabelCalibration() {
  const [calibration, setCalibration] = useState<LabelCalibration>(() => {
    if (typeof window === "undefined") return DEFAULT_LABEL_CALIBRATION;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_LABEL_CALIBRATION, ...JSON.parse(raw) };
    } catch {
      // ไม่มี localStorage หรืออ่านไม่ได้ ใช้ค่าเริ่มต้นไปก่อน
    }
    return DEFAULT_LABEL_CALIBRATION;
  });

  function update(next: Partial<LabelCalibration>) {
    setCalibration((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  }

  function reset() {
    setCalibration(DEFAULT_LABEL_CALIBRATION);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return { calibration, update, reset };
}
