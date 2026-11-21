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
