// คำนวณวัสดุ (ผ้าหลัก/ผ้ากระเป๋า) ที่ต้องใช้จากจำนวนที่ต้องผลิต: จำนวนชิ้น × อัตราใช้ต่อตัว
// อัตราเท่ากันทุกรุ่น/สี/ไซซ์ และเผื่อเสียรวมอยู่ในตัวเลขแล้ว (เจ้าของงานยืนยัน 21 พ.ย. 2026)

export interface MaterialRate {
  key: string;
  label: string;
  perPiece: number; // หลาต่อตัว
  unit: string;
}

export const DEFAULT_MATERIAL_RATES: MaterialRate[] = [
  { key: "main", label: "ผ้าหลัก", perPiece: 1.45, unit: "หลา" },
  { key: "pocket", label: "ผ้ากระเป๋า", perPiece: 0.19, unit: "หลา" },
];

export interface MaterialModelRow {
  id: string;
  name: string;
  pieces: number;
  amounts: Record<string, number>; // key ของวัสดุ -> ปริมาณ
}

export function materialNeeds(
  models: { id: string; name: string; need: number }[],
  rates: MaterialRate[]
): { rows: MaterialModelRow[]; pieces: number; totals: Record<string, number> } {
  const totals: Record<string, number> = Object.fromEntries(rates.map((r) => [r.key, 0]));
  let pieces = 0;
  const rows: MaterialModelRow[] = [];
  for (const m of models) {
    if (m.need <= 0) continue;
    const amounts: Record<string, number> = {};
    for (const r of rates) {
      amounts[r.key] = m.need * r.perPiece;
      totals[r.key] += amounts[r.key];
    }
    pieces += m.need;
    rows.push({ id: m.id, name: m.name, pieces: m.need, amounts });
  }
  return { rows, pieces, totals };
}

// อ่านอัตราที่แก้ไว้ (ค่าไม่ถูกต้อง/ไม่มี = ใช้ค่าตั้งต้น)
export function parseRates(raw: string | null): MaterialRate[] {
  if (!raw) return DEFAULT_MATERIAL_RATES;
  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    return DEFAULT_MATERIAL_RATES.map((d) => {
      const v = Number(saved?.[d.key]);
      return Number.isFinite(v) && v >= 0 && saved?.[d.key] !== "" ? { ...d, perPiece: v } : d;
    });
  } catch {
    return DEFAULT_MATERIAL_RATES;
  }
}

// ---- แยกตามสี ----
// ผ้าหลัก: หลาต่อสี (ผ้าสีเดียวกับตัวเสื้อ) / ผ้ากระเป๋า: มีสองสี ดำกับขาว ตามกลุ่มสีเสื้อ (เจ้าของงานกำหนด 21 พ.ย. 2026)
// สีที่ไม่อยู่ในรายการนี้ยังไม่ระบุ (ผู้ใช้เลือกเองในการ์ดได้) ไม่เดาให้
export type PocketColor = "ดำ" | "ขาว" | "";
export const DEFAULT_POCKET_COLOR: Record<string, PocketColor> = {
  ดำ: "ดำ",
  กรม: "ดำ",
  น้ำตาลไหม้: "ดำ",
  เทาดิน: "ดำ",
  ขาว: "ขาว",
  โอวัลติน: "ขาว",
  ครีม: "ขาว",
};

export function parsePocketMap(raw: string | null): Record<string, PocketColor> {
  const out = { ...DEFAULT_POCKET_COLOR };
  if (!raw) return out;
  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    for (const [color, v] of Object.entries(saved ?? {})) if (v === "ดำ" || v === "ขาว" || v === "") out[color] = v;
  } catch {
    // ใช้ค่าตั้งต้น
  }
  return out;
}

export interface ColorMaterialRow {
  color: string;
  pieces: number;
  main: number; // หลาผ้าหลักของสีนี้
  pocket: number; // หลาผ้ากระเป๋า (ของสีที่ใช้กับสีเสื้อนี้)
  pocketColor: PocketColor;
}

export function materialByColor(
  models: { colors: { color: string; need: number }[] }[],
  perPiece: { main: number; pocket: number },
  pocketMap: Record<string, PocketColor>
): { rows: ColorMaterialRow[]; pocketTotals: { ดำ: number; ขาว: number; ไม่ระบุ: number } } {
  const byColor = new Map<string, number>();
  for (const m of models) for (const c of m.colors) if (c.need > 0) byColor.set(c.color, (byColor.get(c.color) ?? 0) + c.need);
  const rows: ColorMaterialRow[] = [...byColor.entries()]
    .map(([color, pieces]) => ({ color, pieces, main: pieces * perPiece.main, pocket: pieces * perPiece.pocket, pocketColor: pocketMap[color] ?? "" }))
    .sort((a, b) => b.pieces - a.pieces);
  const pocketTotals = { ดำ: 0, ขาว: 0, ไม่ระบุ: 0 };
  for (const r of rows) pocketTotals[r.pocketColor === "ดำ" ? "ดำ" : r.pocketColor === "ขาว" ? "ขาว" : "ไม่ระบุ"] += r.pocket;
  return { rows, pocketTotals };
}
