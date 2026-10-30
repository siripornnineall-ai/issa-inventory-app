// เหตุผลที่ลูกค้าคืน/เปลี่ยนสินค้า: ผู้บันทึกกดเลือกแทนการพิมพ์เอง เพื่อให้นับสรุปได้ (ภาษาไทยไม่เว้นวรรค นับจากข้อความพิมพ์เองไม่แม่น)
// รหัสเก็บในฐานข้อมูล (stock_in_lines.return_reason) ห้ามเปลี่ยนรหัสของข้อที่ใช้แล้ว เพิ่มข้อใหม่ได้ แก้ข้อความที่แสดงได้
export const RETURN_REASONS = [
  { code: "size", label: "ไซซ์ไม่พอดี" },
  { code: "color", label: "สีไม่ตรงรูป" },
  { code: "wrong_item", label: "ส่งผิดรุ่น/สี/ไซซ์" },
  { code: "defect", label: "สินค้ามีตำหนิ" },
  { code: "changed_mind", label: "ไม่ชอบ/เปลี่ยนใจ" },
  { code: "fabric", label: "ผ้าไม่ถูกใจ" },
  { code: "other", label: "อื่น ๆ" },
] as const;

export type ReturnReasonCode = (typeof RETURN_REASONS)[number]["code"];

// สิ่งที่ลูกค้าพูด (ไม่บังคับ เลือกได้หลายข้อ) ใช้นับว่าพูดอะไรบ่อยที่สุด
export const RETURN_TAGS = ["ใหญ่ไป", "เล็กไป", "ยาวไป", "สั้นไป", "ผ้าบาง", "ใส่ไม่สวย", "สีไม่เหมือนรูป", "ได้ของช้า"] as const;

export const RETURN_REASON_LABEL_TH: Record<string, string> = Object.fromEntries(RETURN_REASONS.map((r) => [r.code, r.label]));

export const NO_REASON_LABEL = "ไม่ได้ระบุ";

export function isReturnReason(value: unknown): value is ReturnReasonCode {
  return typeof value === "string" && RETURN_REASONS.some((r) => r.code === value);
}

export function returnReasonLabel(code: string | undefined | null): string {
  return code && RETURN_REASON_LABEL_TH[code] ? RETURN_REASON_LABEL_TH[code] : NO_REASON_LABEL;
}
