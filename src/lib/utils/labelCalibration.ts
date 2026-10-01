"use client";

import { useState } from "react";

// ชนิดกระดาษที่ใช้พิมพ์ป้าย QR
// - a4-sheet: แผ่นสติกเกอร์ตัดดวงไว้ล่วงหน้า ติดบน A4 หลายดวงต่อแผ่น (ของเดิม)
// - roll: ม้วนสติกเกอร์สำหรับเครื่องพิมพ์ฉลาก/ความร้อน 1 ดวงต่อ 1 หน้ากระดาษ (เช่น 50x30 มม.)
export type LabelPaper = "a4-sheet" | "roll";

// ค่าตั้งค่าตำแหน่งพิมพ์ป้าย QR ให้ตรงกับช่องสติกเกอร์จริง (ผู้ใช้ปรับเองได้ในหน้าพิมพ์ ไม่ต้องแก้โค้ด)
export interface LabelCalibration {
  paper: LabelPaper;
  // โหมด A4
  columns: number;
  cellWidthMm: number;
  cellHeightMm: number;
  colGapMm: number;
  rowGapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  // โหมดม้วนสติกเกอร์: ขนาดดวง และระยะเลื่อนเนื้อหา (ค่าลบ = เลื่อนไปซ้าย/ขึ้น) ไว้แก้กรณีเครื่องพิมพ์พิมพ์เยื้อง
  rollWidthMm: number;
  rollHeightMm: number;
  rollOffsetXMm: number;
  rollOffsetYMm: number;
  // ขนาดตัวอักษรบนป้ายม้วน เป็นเปอร์เซ็นต์ของค่ามาตรฐาน (100 = ปกติ) ปรับเองได้ถ้ายังเล็ก/ใหญ่ไป
  rollTextScalePct: number;
}

export const DEFAULT_LABEL_CALIBRATION: LabelCalibration = {
  paper: "a4-sheet",
  columns: 3,
  cellWidthMm: 50,
  cellHeightMm: 25,
  colGapMm: 4,
  rowGapMm: 3,
  marginTopMm: 8,
  marginLeftMm: 8,
  rollWidthMm: 50,
  rollHeightMm: 30,
  rollOffsetXMm: 0,
  rollOffsetYMm: 0,
  rollTextScalePct: 100,
};

const STORAGE_KEY = "issa-qr-label-calibration";

// เก็บค่าไว้ใน localStorage ของเบราว์เซอร์เครื่องนั้น ๆ ใช้ร่วมกันทั้งหน้าพิมพ์บาร์โค้ดแบบรุ่นเดียวและหลายรุ่น
// ค่าที่เคยบันทึกไว้ก่อนมีโหมดม้วน (ไม่มี field ใหม่) จะถูกเติมด้วยค่าเริ่มต้น จึงยังเป็นโหมด A4 เหมือนเดิม
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

  // รีเซ็ตเฉพาะตัวเลขปรับละเอียด ไม่เปลี่ยนชนิดกระดาษที่เลือกอยู่
  function reset() {
    setCalibration((prev) => {
      const next = { ...DEFAULT_LABEL_CALIBRATION, paper: prev.paper };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return { calibration, update, reset };
}
