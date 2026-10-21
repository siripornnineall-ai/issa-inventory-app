"use client";

import { useState } from "react";

// ชนิดกระดาษที่ใช้พิมพ์ป้าย QR
// - a4-sheet: แผ่นสติกเกอร์ตัดดวงไว้ล่วงหน้า ติดบน A4 หลายดวงต่อแผ่น (ของเดิม)
// - roll: ม้วนสติกเกอร์สำหรับเครื่องพิมพ์ฉลาก/ความร้อน 1 ดวงต่อ 1 หน้ากระดาษ (เช่น 50x30 มม.)
export type LabelPaper = "a4-sheet" | "roll";

// ชนิดรหัสที่พิมพ์บนป้าย
// - barcode: บาร์โค้ด Code 128 ของรหัส SKU (ทุกชิ้นของตัวเลือกเดียวกันได้รหัสเดียวกัน) สแกนด้วยเครื่องยิงบาร์โค้ด
// - qr: QR รหัสเฉพาะตัวทุกใบ (ตรวจสแกนซ้ำรายชิ้นได้) สแกนด้วยกล้องมือถือในแอป
export type LabelCodeType = "barcode" | "qr";

// ค่าตั้งค่าตำแหน่งพิมพ์ป้าย QR ให้ตรงกับช่องสติกเกอร์จริง (ผู้ใช้ปรับเองได้ในหน้าพิมพ์ ไม่ต้องแก้โค้ด)
export interface LabelCalibration {
  paper: LabelPaper;
  codeType: LabelCodeType;
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
  // โหมด A4: true = "ขอบบน/ซ้าย" วัดจากขอบกระดาษจริง (ตัดขอบในตัวของหน้าเว็บออก) จำเป็นกับแผ่นที่ดวงเต็มแผ่น เช่น 24 ดวง
  // ไม่ตั้ง/false = วิธีเดิม (ขอบหน้าเว็บ ~6 มม. บวกเพิ่มจากค่าที่ตั้ง) เพื่อไม่ให้ค่าที่ผู้ใช้ปรับไว้แล้วเลื่อน
  a4ExactMargins?: boolean;
}

export const DEFAULT_LABEL_CALIBRATION: LabelCalibration = {
  paper: "a4-sheet",
  codeType: "barcode",
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

// แบบแผ่นสติกเกอร์ A4 สำเร็จรูป กดเลือกแล้วได้ค่าครบ (จำนวนคอลัมน์ ขนาดดวง ระยะห่าง ขอบ) ปรับละเอียดต่อได้ที่ช่อง "ตั้งค่าตำแหน่งพิมพ์"
export type A4SheetValues = Pick<LabelCalibration, "columns" | "cellWidthMm" | "cellHeightMm" | "colGapMm" | "rowGapMm" | "marginTopMm" | "marginLeftMm"> & { a4ExactMargins: boolean };

export interface A4SheetPreset {
  key: string;
  title: string;
  hint: string;
  values: A4SheetValues;
}

export const A4_SHEET_PRESETS: A4SheetPreset[] = [
  {
    key: "a4-24",
    title: "A4 แบบ 24 ดวง (3 คอลัมน์ × 8 แถว)",
    hint: "ดวงละราว 64×34 มม. เต็มแผ่น (ค่าประมาณจากภาพแผ่นสติกเกอร์ ลองพิมพ์ลงกระดาษเปล่าทาบกับแผ่นจริงก่อน แล้วปรับเพิ่มได้)",
    values: { columns: 3, cellWidthMm: 64, cellHeightMm: 34, colGapMm: 5, rowGapMm: 3, marginTopMm: 2.5, marginLeftMm: 5, a4ExactMargins: true },
  },
  {
    key: "a4-50x25",
    title: "A4 ดวง 50×25 มม. (3 คอลัมน์)",
    hint: "ค่าเริ่มต้นเดิมของระบบ",
    values: { columns: 3, cellWidthMm: 50, cellHeightMm: 25, colGapMm: 4, rowGapMm: 3, marginTopMm: 8, marginLeftMm: 8, a4ExactMargins: false },
  },
];

export function matchingA4Preset(c: Omit<A4SheetValues, "a4ExactMargins"> & { a4ExactMargins?: boolean }): A4SheetPreset | undefined {
  return A4_SHEET_PRESETS.find((p) => (Object.keys(p.values) as (keyof A4SheetValues)[]).every((k) => (k === "a4ExactMargins" ? !!c[k] === p.values[k] : p.values[k] === c[k])));
}

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
