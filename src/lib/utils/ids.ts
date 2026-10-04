import { v4 as uuidv4 } from "uuid";

export function newId(): string {
  return uuidv4();
}

// เลขที่เอกสารรูปแบบ PREFIX-YYYYMMDD-XXXX เรียงตามลำดับที่ให้มา
export function genDocNo(prefix: string, seq: number): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${day}-${String(seq).padStart(4, "0")}`;
}

export function slugifyForSku(text: string): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim();
  if (!cleaned) return "GEN";
  return cleaned
    .split(/\s+/)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 9);
}

export function genSku(params: { productName: string; category?: string; color: string; size: string; seq: number }): string {
  const base = slugifyForSku(params.productName) || "ISSA";
  const color = params.color.slice(0, 3).toUpperCase().replace(/\s/g, "") || "STD";
  const size = params.size.toUpperCase().replace(/\s/g, "") || "OS";
  return `ISSA-${base}-${color}-${size}-${String(params.seq).padStart(3, "0")}`;
}

// รูปแบบ SKU ใหม่: [แบรนด์]-[รหัสรุ่น]-[DF ถ้ามีตำหนิ]-[รหัสสี]-[ไซซ์]
// ตัวอย่าง: IS-WEN-BLK-M, IS-WEN-DF-BLK-M (มีตำหนิ)
export function genSkuV2(params: { brandCode: string; modelCode: string; colorCode: string; size: string; isDefective?: boolean }): string {
  const size = params.size.toUpperCase().replace(/\s+/g, "");
  const parts = [params.brandCode.toUpperCase(), params.modelCode.toUpperCase()];
  if (params.isDefective) parts.push("DF");
  parts.push(params.colorCode.toUpperCase(), size);
  return parts.join("-");
}

// เดารหัสรุ่นจากอักษรแรกของแต่ละคำในชื่อสินค้า (เช่น "Billie Slim" -> BS, "Move High Waist" -> MHW)
// ถ้าชนกับรหัสที่ใช้ไปแล้วในแบรนด์เดียวกัน (existingCodes) จะขยายคำแรกให้ยาวขึ้นทีละตัวจนกว่าจะไม่ซ้ำ
// ผู้ดูแลยังแก้ไขเองได้ก่อนบันทึกอยู่ดี นี่เป็นแค่ค่าเดาเริ่มต้น
export function suggestModelCode(sellingName: string, existingCodes: string[] = []): string {
  const cleaned = sellingName
    .normalize("NFKD")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "GEN";

  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  const restInitials = words
    .slice(1)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  for (let len = 1; len <= words[0].length; len++) {
    const code = (words[0].slice(0, len) + restInitials).toUpperCase();
    if (!taken.has(code)) return code;
  }

  const base = (words[0][0] + restInitials).toUpperCase() || "GEN";
  let suffix = 2;
  while (taken.has(`${base}${suffix}`)) suffix++;
  return `${base}${suffix}`;
}

// พจนานุกรมชื่อสีไทย -> รหัสภาษาอังกฤษ สำหรับสีที่ใช้บ่อยในวงการเสื้อผ้า
// (เดารหัสให้เป็นภาษาอังกฤษเสมอ ไม่ใช้ตัวอักษรไทยเป็นรหัส)
const THAI_COLOR_CODE_DICTIONARY: Record<string, string> = {
  ดำ: "BLK",
  ขาว: "WHT",
  แดง: "RED",
  เขียว: "GRN",
  เหลือง: "YEL",
  น้ำเงิน: "BLU",
  ฟ้า: "SKY",
  ฟ้าอ่อน: "LSK",
  ส้ม: "ORG",
  ส้มอิฐ: "BRK",
  ม่วง: "PPL",
  ม่วงเทา: "PGY",
  ชมพู: "PNK",
  เทา: "GRY",
  เทาดิน: "EGY",
  น้ำตาล: "BRN",
  น้ำตาลไหม้: "BBR",
  น้ำตาลทอง: "GBR",
  ครีม: "CRM",
  กรม: "NVY",
  ทอง: "GLD",
  เงิน: "SLV",
  กากี: "KHK",
  เบจ: "BEG",
  โกโก้: "COC",
  ชานม: "MLT",
  โอวัลติน: "OVT",
  เขียวขี้ม้า: "ARM",
  เขียวโอลีฟ: "OLV",
  เขียวเข้ม: "DGR",
  พีช: "PCH",
  มินท์: "MNT",
  ไวน์: "WIN",
  แดงเลือดหมู: "MRN",
  เทาอ่อน: "LGY",
  เทาเข้ม: "DGY",
  เขียวมิ้นท์: "GMT",
  เขียวอ่อน: "LGN",
  เขียวพาสเทล: "PGN",
  ฟ้าเข้ม: "DSK",
  น้ำเงินเข้ม: "DBL",
  แดงเข้ม: "DRD",
  ชมพูอ่อน: "LPK",
  ชมพูเข้ม: "DPK",
  ม่วงอ่อน: "LPL",
  น้ำตาลอ่อน: "LBR",
  น้ำตาลเข้ม: "DBR",
  เหลืองอ่อน: "LYL",
  มัสตาร์ด: "MST",
  ลาเวนเดอร์: "LAV",
  เทอร์ควอยซ์: "TRQ",
  เบอร์กันดี: "BGD",
  กุหลาบ: "ROS",
  โอลด์โรส: "ORS",
  ทับทิม: "RBY",
  เทาดำ: "CHR",
  ขาวนวล: "OFW",
  ชาเขียว: "MCH",
  ทราย: "SND",
  สีเนื้อ: "NDE",
  ลายพราง: "CMO",
  ชมพูพาสเทล: "PPK",
  ฟ้าพาสเทล: "PSK",
  ม่วงพาสเทล: "PPP",
  เหลืองพาสเทล: "PYL",
};

// รายการสีสำเร็จรูปสำหรับให้เลือกตอนพิมพ์ (ชื่อไทยที่ไม่ซ้ำกันเมื่อไม่นับวรรณยุกต์)
export const PRESET_COLOR_NAMES: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of Object.keys(THAI_COLOR_CODE_DICTIONARY)) {
    const key = normalizeThaiColor(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
})();

// ตัดวรรณยุกต์ (่ ้ ๊ ๋) และช่องว่างออกก่อนเทียบ เพื่อให้ "มิ้นท์" กับ "มินท์" ถือเป็นสีเดียวกัน
export function normalizeThaiColor(name: string): string {
  let out = "";
  for (const ch of name.trim()) {
    const c = ch.charCodeAt(0);
    if ((c >= 0x0e48 && c <= 0x0e4b) || ch === " ") continue;
    out += ch;
  }
  return out;
}

const NORMALIZED_DICTIONARY: Record<string, string> = Object.fromEntries(
  Object.entries(THAI_COLOR_CODE_DICTIONARY).map(([k, v]) => [normalizeThaiColor(k), v]),
);

// สีหลัก เรียงจากชื่อยาวไปสั้น เพื่อแยกชื่อประกอบ เช่น "เขียวมิ้นท์" = เขียว + มิ้นท์
const BASE_COLOR_NAMES = ["น้ำตาล", "น้ำเงิน", "เหลือง", "เขียว", "ม่วง", "ชมพู", "ฟ้า", "แดง", "ส้ม", "เทา", "ดำ", "ขาว", "ครีม"].map(normalizeThaiColor);
const SOFT_TONE = normalizeThaiColor("อ่อน");
const DEEP_TONE = normalizeThaiColor("เข้ม");

// เดารหัสสีจากชื่อสี (ไม่ต้องพิมพ์เอง) — รหัสที่ได้เป็นตัวย่อภาษาอังกฤษเสมอ ไม่มีตัวเลข
// 1) พจนานุกรมสีที่ใช้บ่อย 2) ชื่อประกอบ: สีหลัก + อ่อน/เข้ม (LGY, DBR) หรือสีหลัก + สีย่อย (ใช้รหัสสีย่อย)
// 3) ชื่อที่มีตัวอักษรอังกฤษปนอยู่ใช้ 3 ตัวแรก 4) ถ้าไม่รู้จักเลยใช้ COL (ซ้ำจะต่อเลขเป็นทางสุดท้าย)
function baseColorCode(name: string, taken: (code: string) => boolean): string {
  const key = normalizeThaiColor(name);
  const direct = NORMALIZED_DICTIONARY[key];
  if (direct) return direct;

  for (const b of BASE_COLOR_NAMES) {
    if (!key.startsWith(b) || key.length === b.length) continue;
    const rest = key.slice(b.length);
    const baseCode = NORMALIZED_DICTIONARY[b];
    if (rest === SOFT_TONE || rest === DEEP_TONE) {
      const letter = rest === DEEP_TONE ? "D" : "L";
      return letter + baseCode[0] + baseCode[baseCode.length - 1];
    }
    const sub = NORMALIZED_DICTIONARY[rest];
    if (sub) return taken(sub) ? baseCode[0] + sub : sub;
  }
  return "";
}

export function suggestColorCode(name: string, existingCodes: Record<string, { thaiName: string }> = {}): string {
  const trimmed = name.trim();
  if (!trimmed) return "COL";
  const taken = (code: string) => Boolean(existingCodes[code]) && existingCodes[code].thaiName !== trimmed;
  let base = baseColorCode(trimmed, taken);
  if (!base) {
    const latinOnly = trimmed.normalize("NFKD").replace(/[^a-zA-Z]/g, "");
    base = latinOnly.slice(0, 3).toUpperCase();
  }
  if (!base) base = "COL";
  let candidate = base;
  let i = 2;
  while (existingCodes[candidate] && existingCodes[candidate].thaiName !== trimmed) {
    candidate = `${base}${i}`;
    i += 1;
  }
  return candidate;
}
