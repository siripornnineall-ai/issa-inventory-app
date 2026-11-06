import type { ReturnSummary } from "./returnSummary";
import { formatNumber } from "./money";

// สรุป "ควรทำอะไรต่อ" จากตัวเลขสินค้าคืน/เปลี่ยน เป็นกฎง่าย ๆ ที่อ่านตรวจสอบได้ ไม่ใช่การคาดเดา
// เกณฑ์อยู่ที่ INSIGHT_RULES ที่เดียว ปรับได้ ตัวเลขน้อยกว่า minPieces จะไม่สรุปอะไร (ข้อมูลน้อยเกินสรุปไม่ได้)
export const INSIGHT_RULES = {
  minPieces: 5, // ของคืนน้อยกว่านี้ถือว่าข้อมูลยังน้อย
  rateHighPct: 10, // % ของยอดขายที่ถูกคืน: ตั้งแต่นี้ถือว่าสูง
  rateMidPct: 5,
  noReasonSharePct: 30, // ใบที่ไม่ได้ระบุเหตุผลเกินนี้ ควรให้พนักงานเลือกเหตุผลให้ครบ
  topReasonSharePct: 40, // เหตุผลเดียวกันเกินนี้ของของคืนทั้งหมด
  productMinPieces: 3,
  productRatePct: 15, // รุ่นที่คืนเกินนี้ของที่ขายรุ่นนั้น
  channelSharePct: 50,
  exchangeMinPieces: 3,
} as const;

export type ActionLevel = "high" | "mid" | "info";

export interface ReturnAction {
  id: string;
  level: ActionLevel;
  title: string;
  detail: string;
  todo: string;
  drill?: { reasonCode?: string; productId?: string };
}

const REASON_TODO: Record<string, string> = {
  size: "ตรวจตารางไซซ์และข้อมูลวัดจริงในหน้าสินค้า/หน้าร้าน ให้ลูกค้าเทียบก่อนสั่ง และดูว่ารุ่นไหนคืนเรื่องไซซ์มากสุดด้านล่าง",
  color: "ตรวจรูปสินค้ากับของจริงว่าสีตรงไหม ถ่ายรูปใหม่ในแสงธรรมชาติ หรือใส่คำเตือนเรื่องสีในรายละเอียดสินค้า",
  wrong_item: "ตรวจขั้นตอนแพ็คของ ยิงบาร์โค้ด/QR ยืนยันรุ่น-สี-ไซซ์ก่อนส่งทุกครั้ง",
  defect: "ตรวจ QC ก่อนแพ็ค และแจ้งโรงงานตามรุ่น/ล็อตที่มีตำหนิบ่อย",
  fabric: "ปรับคำอธิบายเนื้อผ้าและความหนาในรายละเอียดสินค้าให้ตรงของจริง",
  changed_mind: "เหตุผลนี้ควบคุมยาก ดูว่ามีรุ่นไหนที่ลูกค้าเปลี่ยนใจบ่อยผิดปกติ แล้วตรวจรูป/คำอธิบายของรุ่นนั้น",
  other: 'ลองดู "ข้อความและหมายเหตุล่าสุด" ด้านล่างว่าลูกค้าพูดอะไร แล้วเพิ่มตัวเลือกเหตุผลใหม่ถ้ามีข้อความซ้ำ ๆ',
};

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

export function buildActions(s: ReturnSummary): ReturnAction[] {
  const r = INSIGHT_RULES;
  if (s.pieces === 0) return [];
  if (s.pieces < r.minPieces) {
    return [{ id: "few", level: "info", title: "ข้อมูลยังน้อยเกินสรุป", detail: `มีของคืนแค่ ${formatNumber(s.pieces)} ชิ้นในช่วงนี้`, todo: "ลองขยายช่วงวันที่ให้ยาวขึ้น (เช่น 30 วัน) แล้วดูอีกครั้ง" }];
  }

  const out: ReturnAction[] = [];

  if (s.ratePct !== null) {
    if (s.ratePct >= r.rateHighPct) {
      out.push({ id: "rate", level: "high", title: `อัตราคืน/เปลี่ยนสูง ${s.ratePct}% ของยอดขาย`, detail: `คืน ${formatNumber(s.pieces)} จาก ${formatNumber(s.salesPieces)} ชิ้นที่ขาย`, todo: "ไล่ดูเหตุผลหลักและรุ่นที่คืนบ่อยด้านล่าง แล้วแก้ที่ต้นเหตุก่อน" });
    } else if (s.ratePct >= r.rateMidPct) {
      out.push({ id: "rate", level: "mid", title: `อัตราคืน/เปลี่ยน ${s.ratePct}% ของยอดขาย`, detail: `คืน ${formatNumber(s.pieces)} จาก ${formatNumber(s.salesPieces)} ชิ้นที่ขาย`, todo: "เฝ้าดูต่อเนื่อง ถ้าเพิ่มขึ้นให้ไล่ดูเหตุผลหลักด้านล่าง" });
    }
  }

  const noReason = s.byReason.find((x) => x.code === "none");
  if (noReason && pct(noReason.pieces, s.pieces) >= r.noReasonSharePct) {
    out.push({
      id: "no-reason",
      level: "mid",
      title: `${pct(noReason.pieces, s.pieces)}% ไม่ได้ระบุเหตุผล`,
      detail: `${formatNumber(noReason.pieces)} ชิ้น (ส่วนมากเป็นใบเก่าก่อนมีตัวเลือกเหตุผล)`,
      todo: "ให้พนักงานเลือกเหตุผลทุกครั้งตอนรับคืน ตัวเลขสรุปจะได้แม่นขึ้น",
      drill: { reasonCode: "none" },
    });
  }

  const specified = s.byReason.filter((x) => x.code !== "none");
  const specifiedTotal = specified.reduce((sum, x) => sum + x.pieces, 0);
  const top = specified[0];
  if (top && specifiedTotal >= r.minPieces && pct(top.pieces, specifiedTotal) >= r.topReasonSharePct) {
    out.push({
      id: `reason-${top.code}`,
      level: top.code === "changed_mind" ? "info" : "high",
      title: `เหตุผลหลักคือ "${top.label}" (${pct(top.pieces, specifiedTotal)}% ของที่ระบุเหตุผล)`,
      detail: `${formatNumber(top.pieces)} ชิ้น มูลค่า ${formatNumber(top.value)} บาท`,
      todo: REASON_TODO[top.code] ?? REASON_TODO.other,
      drill: { reasonCode: top.code },
    });
  }

  for (const p of s.byProduct) {
    if (p.pieces < r.productMinPieces || p.salesPieces <= 0) continue;
    const rate = pct(p.pieces, p.salesPieces);
    if (rate < r.productRatePct) continue;
    out.push({
      id: `product-${p.productId}`,
      level: "high",
      title: `${p.name} ถูกคืน ${rate}% ของที่ขาย`,
      detail: `คืน ${formatNumber(p.pieces)} จาก ${formatNumber(p.salesPieces)} ชิ้น`,
      todo: "ดูเหตุผลของรุ่นนี้โดยเฉพาะ (กดปุ่มด้านขวา) แล้วตรวจรูป ตารางไซซ์ และคุณภาพของรุ่นนี้",
      drill: { productId: p.productId },
    });
    if (out.filter((a) => a.id.startsWith("product-")).length >= 3) break;
  }

  const topVariant = s.byVariant[0];
  if (topVariant && topVariant.pieces >= r.productMinPieces && pct(topVariant.pieces, s.pieces) >= 30) {
    out.push({ id: "variant", level: "mid", title: `${topVariant.label} ถูกคืนมากสุด`, detail: `${formatNumber(topVariant.pieces)} ชิ้น (${pct(topVariant.pieces, s.pieces)}% ของที่คืนทั้งหมด)`, todo: "เช็กของจริงในคลังว่าตัวนี้มีปัญหาเฉพาะล็อต/ไซซ์/สีหรือไม่" });
  }

  const ex = s.exchangeModels[0];
  if (ex && ex.pieces >= r.exchangeMinPieces) {
    if (ex.from === ex.to) {
      out.push({ id: "exchange", level: "mid", title: `ลูกค้าเปลี่ยนไซซ์/สีภายในรุ่น ${ex.from} บ่อย`, detail: `${formatNumber(ex.pieces)} ชิ้น`, todo: "ตรวจตารางไซซ์ของรุ่นนี้ และดูตารางด้านล่างว่าเปลี่ยนจากไซซ์ไหนเป็นไซซ์ไหนบ่อย" });
    } else {
      out.push({ id: "exchange", level: "info", title: `ลูกค้าเปลี่ยนจาก ${ex.from} ไปเป็น ${ex.to} บ่อย`, detail: `${formatNumber(ex.pieces)} ชิ้น`, todo: "ดูว่าสองรุ่นนี้ลูกค้าสับสนกัน หรือรุ่นปลายทางเป็นที่ต้องการกว่า แล้วเตรียมสต็อกรุ่นปลายทางให้พอ" });
    }
  }

  const ch = s.byChannel[0];
  if (ch && s.byChannel.length > 1 && pct(ch.pieces, s.pieces) >= r.channelSharePct) {
    out.push({ id: "channel", level: "info", title: `ช่องทาง ${ch.channel} คืนมากสุด (${pct(ch.pieces, s.pieces)}%)`, detail: `${formatNumber(ch.pieces)} ชิ้น`, todo: "ดูว่าช่องทางนี้ขายสัดส่วนมากอยู่แล้วหรือคืนสูงผิดปกติ (เทียบกับยอดขายของช่องทางนั้น)" });
  }

  const order: Record<ActionLevel, number> = { high: 0, mid: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
