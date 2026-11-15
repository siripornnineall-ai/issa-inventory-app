import type { AppState } from "@/lib/store/state";

// อ่านไฟล์ยอดขายรายเดือนของเจ้าของงาน (CSV จากชีต): หนึ่งบล็อกต่อรุ่น แถวหัว = ชื่อรุ่น + ไซซ์ แถวถัดไป = สี + จำนวนต่อไซซ์ จบที่แถว "รวมจำนวนต่อไซส์"
// หัวข้อ "ยอดขาย7 เดือน" ก่อนบล็อกใด แปลว่าตัวเลขของบล็อกนั้นเป็นยอดหลายเดือน (หารเป็นต่อเดือน) ส่วนที่ขึ้น "B.C สั่งตัด" เป็นต้นไปไม่อ่าน
// ผลลัพธ์ใช้เป็น "ยอดขายอ้างอิง" วางแผนผลิตเท่านั้น ไม่ใช่ออเดอร์และไม่แตะสต็อก

export interface BaselineBlock {
  label: string; // ชื่อรุ่นตามหัวบล็อกในไฟล์
  months: number; // ตัวเลขในบล็อกนี้เป็นยอดกี่เดือน
  rows: { color: string; size: string; qty: number }[]; // qty = ยอดทั้งช่วงตามไฟล์ (ยังไม่หาร)
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function toNumber(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.replace(/[,\s]/g, "");
  if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) return null; // ข้าม #REF! #DIV/0! และเปอร์เซ็นต์
  return Number(s);
}

export function parseBaselineCsv(text: string): BaselineBlock[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const blocks: BaselineBlock[] = [];
  let months = 1;
  let cur: { label: string; sizes: string[]; months: number; rows: BaselineBlock["rows"] } | null = null;
  for (const r of rows) {
    const first = (r[0] ?? "").trim();
    if (first.includes("สั่งตัด")) break;
    const heading = first.match(/ยอดขาย\s*(\d+)\s*เดือน/);
    if (heading) {
      months = Math.max(1, Number(heading[1]));
      continue;
    }
    if (/^\d+\s*month/i.test(first)) {
      months = Math.max(1, Number(first.match(/^(\d+)/)![1]));
      continue;
    }
    const isHeader = first !== "" && r.some((c) => c.trim() === "รวมจำนวนต่อสี");
    if (isHeader) {
      if (cur) blocks.push({ label: cur.label, months: cur.months, rows: cur.rows });
      const sizes: string[] = [];
      for (let i = 1; i < r.length; i++) {
        const c = r[i].trim();
        if (c === "รวมจำนวนต่อสี") break;
        sizes.push(c);
      }
      cur = { label: first, sizes, months, rows: [] };
      continue;
    }
    if (!cur) continue;
    if (first.startsWith("รวมจำนวนต่อไซส์")) {
      blocks.push({ label: cur.label, months: cur.months, rows: cur.rows });
      cur = null;
      continue;
    }
    if (first === "") continue;
    cur.sizes.forEach((size, i) => {
      const n = toNumber(r[i + 1]);
      if (size && n !== null && n > 0) cur!.rows.push({ color: first, size, qty: n });
    });
  }
  if (cur) blocks.push({ label: cur.label, months: cur.months, rows: cur.rows });
  return blocks.filter((b) => b.rows.length > 0);
}

// ชื่อรุ่นในไฟล์ที่ไม่ตรงกับชื่อในระบบ (เจ้าของงานยืนยัน 15 พ.ย. 2026)
const MODEL_ALIAS: Record<string, string> = {
  bslim: "billieslim",
  "bwide/barbie": "billiewide",
  "wendy/vicky": "wendymid",
};
// สีที่เขียนต่างจากในระบบ
const COLOR_ALIAS: Record<string, string> = { โอวันติน: "โอวัลติน", ช็อคโกแล็ต: "ช็อกโกแลต", ช็อกโกแล็ต: "ช็อกโกแลต" };

// ใช้เมื่อรุ่นนั้นไม่มีสีชื่อตรงกับในไฟล์เลย (เช่น Justin Wide มี "ฟ้าอ่อน" กับ "ฟ้าเข้ม" แต่ไม่มี "ฟ้า")
const COLOR_FALLBACK: Record<string, string> = { ฟ้า: "ฟ้าอ่อน" };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const normColor = (s: string) => {
  const n = s.trim().replace(/\s+/g, "");
  return COLOR_ALIAS[n] ?? n;
};

export interface BaselineRow {
  productId: string;
  productName: string;
  color: string; // ชื่อสีตามระบบ
  size: string;
  qty: number; // ต่อเดือน
}

export interface BaselineMatch {
  rows: BaselineRow[];
  unmatchedModels: string[]; // ชื่อรุ่นในไฟล์ที่หาในระบบไม่เจอ (ข้ามทั้งบล็อก)
  unmatchedCells: { model: string; color: string; size: string; qty: number }[]; // รุ่นเจอ แต่สี/ไซซ์ไม่มีในระบบ
  totalFile: number; // ยอดรวมตามไฟล์ (ก่อนหารเดือน)
  totalMatched: number; // ยอดรวมที่จับคู่ได้ (ก่อนหารเดือน)
}

export function matchBaseline(state: AppState, blocks: BaselineBlock[]): BaselineMatch {
  const products = Object.values(state.products);
  const out: BaselineMatch = { rows: [], unmatchedModels: [], unmatchedCells: [], totalFile: 0, totalMatched: 0 };
  for (const b of blocks) {
    const key = MODEL_ALIAS[norm(b.label)] ?? norm(b.label);
    const product = products.find((p) => norm(p.sellingName) === key);
    const total = b.rows.reduce((s, r) => s + r.qty, 0);
    out.totalFile += total;
    if (!product) {
      out.unmatchedModels.push(b.label);
      continue;
    }
    const variants = Object.values(state.variants).filter((v) => v.productId === product.id);
    for (const r of b.rows) {
      const bySize = (x: { size: string }) => x.size.toUpperCase() === r.size.toUpperCase();
      const fb = COLOR_FALLBACK[normColor(r.color)];
      const v = variants.find((x) => normColor(x.color) === normColor(r.color) && bySize(x)) ?? (fb ? variants.find((x) => normColor(x.color) === fb && bySize(x)) : undefined);
      if (!v) {
        out.unmatchedCells.push({ model: product.sellingName, color: r.color, size: r.size, qty: r.qty });
        continue;
      }
      out.totalMatched += r.qty;
      const monthly = Math.round((r.qty / b.months) * 100) / 100;
      out.rows.push({ productId: product.id, productName: product.sellingName, color: v.color, size: v.size, qty: monthly });
    }
  }
  return out;
}
