import type { AppState } from "@/lib/store/state";
import { STOCK_RETURN_LABEL_TH, STOCK_RETURN_TYPES, isStockReturnType } from "@/lib/types";
import type { StockInDoc, StockReturnType } from "@/lib/types";
import { RETURN_REASONS, NO_REASON_LABEL, returnReasonLabel } from "./returnReasons";

// สรุปสินค้าคืน/เปลี่ยน/ตีกลับ/ตำหนิ จากใบรับคืน (SRT) ที่ไม่ถูกยกเลิก ในช่วงวันที่ที่เลือก
// มูลค่า = จำนวน x ราคาต่อชิ้นที่บันทึกในใบ ใบเก่าที่ยังไม่มีราคาใช้ราคาขายปัจจุบันของสินค้าประมาณให้ (นับไว้ใน estimatedLines)
export interface ReturnFilters {
  from: number;
  to: number;
  brandId?: string; // "" / undefined = ทุกแบรนด์
  returnType?: StockReturnType | ""; // "" / undefined = ทุกประเภท
}

export interface Bucket {
  pieces: number;
  value: number;
}

export interface ReturnRow {
  docNo: string;
  date: string;
  typeLabel: string;
  returnType: StockReturnType;
  channel: string;
  productName: string;
  color: string;
  size: string;
  sku: string;
  brandName: string;
  qty: number;
  unitPrice: number;
  value: number;
  reasonCode: string;
  reasonLabel: string;
  tags: string[];
  exchangeTo: string;
  note: string;
}

export interface ReturnSummary {
  docs: number;
  pieces: number;
  value: number;
  estimatedLines: number; // บรรทัดที่ไม่มีราคาในใบ ใช้ราคาขายปัจจุบันประมาณ
  salesPieces: number;
  ratePct: number | null;
  byType: Record<StockReturnType, Bucket & { docs: number }>;
  byReason: ({ code: string; label: string; lines: number } & Bucket)[];
  byTag: { tag: string; pieces: number }[];
  byProduct: ({ productId: string; name: string } & Bucket)[];
  byVariant: ({ variantId: string; label: string } & Bucket)[];
  byChannel: ({ channel: string } & Bucket)[];
  exchanges: { from: string; to: string; pieces: number }[];
  exchangeModels: { from: string; to: string; pieces: number }[];
  notes: { docNo: string; date: string; label: string; reasonLabel: string; text: string }[];
  rows: ReturnRow[];
}

const NO_CHANNEL = "ไม่ระบุช่องทาง";

function add(map: Map<string, Bucket>, key: string, pieces: number, value: number) {
  const cur = map.get(key) ?? { pieces: 0, value: 0 };
  cur.pieces += pieces;
  cur.value += value;
  map.set(key, cur);
}

const byPiecesDesc = <T extends { pieces: number }>(a: T, b: T) => b.pieces - a.pieces;

export function returnSummary(state: AppState, f: ReturnFilters): ReturnSummary {
  // ช่องทางที่ขายเก็บอยู่ในเหตุผลของรายการเคลื่อนไหว ("ประเภท · ช่องทาง") ใบรับคืนไม่ได้เก็บช่องทางแยก
  const channelOfDoc = new Map<string, string>();
  for (const m of Object.values(state.movements)) {
    if (!isStockReturnType(m.movementType) || channelOfDoc.has(m.refNo)) continue;
    channelOfDoc.set(m.refNo, m.reason?.split(" · ")[1] ?? "");
  }

  const rows: ReturnRow[] = [];
  const docIds = new Set<string>();
  const byType = Object.fromEntries(STOCK_RETURN_TYPES.map((t) => [t, { docs: 0, pieces: 0, value: 0 }])) as ReturnSummary["byType"];
  const typeDocs = Object.fromEntries(STOCK_RETURN_TYPES.map((t) => [t, new Set<string>()])) as Record<StockReturnType, Set<string>>;
  const reasons = new Map<string, Bucket & { lines: number }>();
  const tags = new Map<string, number>();
  const products = new Map<string, { name: string } & Bucket>();
  const variants = new Map<string, { label: string } & Bucket>();
  const channels = new Map<string, Bucket>();
  const pairs = new Map<string, { from: string; to: string; pieces: number }>();
  const modelPairs = new Map<string, { from: string; to: string; pieces: number }>();
  const notes: ReturnSummary["notes"] = [];
  let estimatedLines = 0;

  const variantLabel = (id: string) => {
    const v = state.variants[id];
    const p = v ? state.products[v.productId] : undefined;
    return `${p?.sellingName ?? "ไม่ทราบชื่อสินค้า"} ${v?.color ?? ""} ${v?.size ?? ""}`.replace(/\s+/g, " ").trim();
  };

  const docs: StockInDoc[] = Object.values(state.stockInDocs).filter((d) => {
    if (!d.returnType || d.status === "cancelled") return false;
    if (f.returnType && d.returnType !== f.returnType) return false;
    const t = new Date(d.date).getTime();
    return t >= f.from && t <= f.to;
  });

  for (const doc of docs) {
    const returnType = doc.returnType as StockReturnType;
    for (const line of doc.lines) {
      const variant = state.variants[line.itemId];
      const product = variant ? state.products[variant.productId] : undefined;
      if (f.brandId && product?.brandId !== f.brandId) continue;
      const hasPrice = line.unitPrice !== undefined && line.unitPrice !== null;
      if (!hasPrice) estimatedLines += 1;
      const unitPrice = hasPrice ? (line.unitPrice as number) : (variant?.sellingPrice ?? 0);
      const value = line.qty * unitPrice;
      const channel = channelOfDoc.get(doc.docNo) || NO_CHANNEL;
      const reasonCode = line.returnReason ?? "";
      const label = returnReasonLabel(reasonCode);

      docIds.add(doc.id);
      typeDocs[returnType].add(doc.id);
      byType[returnType].pieces += line.qty;
      byType[returnType].value += value;
      const r = reasons.get(reasonCode || "none") ?? { pieces: 0, value: 0, lines: 0 };
      r.pieces += line.qty;
      r.value += value;
      r.lines += 1;
      reasons.set(reasonCode || "none", r);
      for (const t of line.returnTags ?? []) tags.set(t, (tags.get(t) ?? 0) + line.qty);
      const pk = product?.id ?? "?";
      const pr = products.get(pk) ?? { name: product?.sellingName ?? "ไม่ทราบชื่อสินค้า", pieces: 0, value: 0 };
      pr.pieces += line.qty;
      pr.value += value;
      products.set(pk, pr);
      const vr = variants.get(line.itemId) ?? { label: variantLabel(line.itemId), pieces: 0, value: 0 };
      vr.pieces += line.qty;
      vr.value += value;
      variants.set(line.itemId, vr);
      add(channels, channel, line.qty, value);

      let exchangeTo = "";
      if (returnType === "return_exchange" && line.exchangeToId) {
        exchangeTo = variantLabel(line.exchangeToId);
        const from = variantLabel(line.itemId);
        const pk2 = `${line.itemId}>${line.exchangeToId}`;
        const cur = pairs.get(pk2) ?? { from, to: exchangeTo, pieces: 0 };
        cur.pieces += line.qty;
        pairs.set(pk2, cur);
        const toVariant = state.variants[line.exchangeToId];
        const toProduct = toVariant ? state.products[toVariant.productId] : undefined;
        const mk = `${product?.id}>${toProduct?.id}`;
        const mp = modelPairs.get(mk) ?? { from: product?.sellingName ?? "ไม่ทราบชื่อสินค้า", to: toProduct?.sellingName ?? "ไม่ทราบชื่อสินค้า", pieces: 0 };
        mp.pieces += line.qty;
        modelPairs.set(mk, mp);
      }

      const text = [(line.returnTags ?? []).join(", "), doc.note ?? ""].filter(Boolean).join(" · ");
      if (text) notes.push({ docNo: doc.docNo, date: doc.date, label: variantLabel(line.itemId), reasonLabel: label, text });

      rows.push({
        docNo: doc.docNo,
        date: doc.date,
        typeLabel: STOCK_RETURN_LABEL_TH[returnType],
        returnType,
        channel,
        productName: product?.sellingName ?? "ไม่ทราบชื่อสินค้า",
        color: variant?.color ?? "",
        size: variant?.size ?? "",
        sku: variant?.sku ?? "",
        brandName: product?.brandId ? (state.brands[product.brandId]?.name ?? "") : "",
        qty: line.qty,
        unitPrice,
        value,
        reasonCode,
        reasonLabel: label,
        tags: line.returnTags ?? [],
        exchangeTo,
        note: doc.note ?? "",
      });
    }
  }
  for (const t of STOCK_RETURN_TYPES) byType[t].docs = typeDocs[t].size;

  // ยอดขาย (ชิ้น) ในช่วงเดียวกัน ไว้เทียบเป็นเปอร์เซ็นต์ (ออเดอร์ที่ไม่ยกเลิก ตามวันที่ขาย)
  let salesPieces = 0;
  for (const o of Object.values(state.orders)) {
    if (o.status === "cancelled") continue;
    const t = new Date(o.date).getTime();
    if (!(t >= f.from && t <= f.to)) continue;
    for (const l of o.lines) {
      if (f.brandId && state.products[l.productId]?.brandId !== f.brandId) continue;
      salesPieces += l.qty;
    }
  }

  const pieces = rows.reduce((s, r) => s + r.qty, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);

  const reasonOrder = [...RETURN_REASONS.map((r) => r.code as string), "none"];
  const byReason = [...reasons.entries()]
    .map(([code, b]) => ({ code, label: code === "none" ? NO_REASON_LABEL : returnReasonLabel(code), ...b }))
    .sort((a, b) => b.pieces - a.pieces || reasonOrder.indexOf(a.code) - reasonOrder.indexOf(b.code));

  return {
    docs: docIds.size,
    pieces,
    value,
    estimatedLines,
    salesPieces,
    ratePct: salesPieces > 0 ? Math.round((pieces / salesPieces) * 1000) / 10 : null,
    byType,
    byReason,
    byTag: [...tags.entries()].map(([tag, p]) => ({ tag, pieces: p })).sort(byPiecesDesc),
    byProduct: [...products.entries()].map(([productId, b]) => ({ productId, ...b })).sort(byPiecesDesc),
    byVariant: [...variants.entries()].map(([variantId, b]) => ({ variantId, ...b })).sort(byPiecesDesc),
    byChannel: [...channels.entries()].map(([channel, b]) => ({ channel, ...b })).sort(byPiecesDesc),
    exchanges: [...pairs.values()].sort(byPiecesDesc),
    exchangeModels: [...modelPairs.values()].sort(byPiecesDesc),
    notes: notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    rows: rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}
