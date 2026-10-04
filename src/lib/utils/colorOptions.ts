import { PRESET_COLOR_NAMES, normalizeThaiColor, suggestColorCode } from "@/lib/utils/ids";

export interface ColorOption {
  name: string;
  code: string;
}

// รวมสีที่เคยบันทึกในระบบ (ใช้รหัสเดิม) กับสีสำเร็จรูป (รหัสเดาให้ ไม่ชนรหัสที่มีอยู่)
// สีที่บันทึกไว้อยู่ก่อน แล้วตามด้วยสีสำเร็จรูปที่ยังไม่เคยใช้
export function listColorOptions(saved: Record<string, { thaiName: string }>): ColorOption[] {
  const options: ColorOption[] = [];
  const seen = new Set<string>();
  for (const [code, c] of Object.entries(saved)) {
    const key = normalizeThaiColor(c.thaiName);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ name: c.thaiName, code });
  }
  // สะสมรหัสที่แจกไปแล้ว เพื่อไม่ให้สีสำเร็จรูปสองสีได้รหัสเดียวกัน
  const taken: Record<string, { thaiName: string }> = { ...saved };
  for (const name of PRESET_COLOR_NAMES) {
    const key = normalizeThaiColor(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const code = suggestColorCode(name, taken);
    taken[code] = { thaiName: name };
    options.push({ name, code });
  }
  return options;
}

// กรองตามสิ่งที่พิมพ์ (ชื่อหรือรหัส ไม่สนวรรณยุกต์/ตัวพิมพ์เล็กใหญ่) ถ้ายังไม่พิมพ์อะไรแสดงตั้งแต่ต้นรายการ
export function filterColorOptions(options: ColorOption[], query: string, exclude: Set<string>, limit: number): ColorOption[] {
  const q = normalizeThaiColor(query).toLowerCase();
  const out: ColorOption[] = [];
  for (const o of options) {
    if (exclude.has(normalizeThaiColor(o.name))) continue;
    if (q && !normalizeThaiColor(o.name).toLowerCase().includes(q) && !o.code.toLowerCase().includes(q)) continue;
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}
