"use client";

import { formatNumber } from "@/lib/utils/money";
import type { MaterialSettings } from "./useMaterialSettings";

const fmt = (n: number) => (n === 0 ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));

// ตารางข้างตาราง "ที่ต้องผลิต" ของแต่ละรุ่น (เหมือนในชีต): ต่อสี = หลาผ้าหลัก + ผ้ากระเป๋าดำ/ขาว ความสูงแถวตรงกับตารางที่ต้องผลิต
export function MaterialSideTable({ colors, settings }: { colors: { color: string; need: number }[]; settings: MaterialSettings }) {
  const { perPiece, pocketMap } = settings;
  const rows = colors.map((c) => {
    const pocket = c.need * perPiece.pocket;
    const pc = pocketMap[c.color] ?? "";
    return { color: c.color, pieces: c.need, main: c.need * perPiece.main, black: pc === "ดำ" ? pocket : 0, white: pc === "ขาว" ? pocket : 0, unknown: pc === "" ? pocket : 0 };
  });
  const sum = (k: "pieces" | "main" | "black" | "white" | "unknown") => rows.reduce((t, r) => t + r[k], 0);
  const showUnknown = sum("unknown") > 0;
  return (
    <div data-material-side className="w-full sm:w-[24rem] sm:shrink-0">
      <p className="mb-1 min-h-10 text-sm font-semibold">
        วัสดุที่ต้องใช้ <span className="font-normal text-[var(--color-on-surface-variant)]">· หลาผ้าหลัก {perPiece.main} + ผ้ากระเป๋า {perPiece.pocket} หลา ต่อตัว</span>
      </p>
      <table data-material className="mx-compact w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="h-10 bg-[var(--bar,var(--color-primary-container))] text-[color:var(--bar-fg,#fff)]">
            <th className="px-2 py-2 text-center font-medium">ผ้าหลัก (หลา)</th>
            <th className="px-2 py-2 text-center font-medium">กระเป๋าดำ</th>
            <th className="px-2 py-2 text-center font-medium">กระเป๋าขาว</th>
            {showUnknown && <th className="px-2 py-2 text-center font-medium">ไม่ระบุ</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.color} className="h-11 border-b border-[var(--color-border)] sm:h-14" title={`${r.color}: ต้องผลิต ${formatNumber(r.pieces)} ชิ้น`}>
              <td className="px-2 py-2 text-center">{fmt(r.main)}</td>
              <td className="px-2 py-2 text-center">{fmt(r.black)}</td>
              <td className="px-2 py-2 text-center">{fmt(r.white)}</td>
              {showUnknown && <td className="px-2 py-2 text-center text-amber-800">{fmt(r.unknown)}</td>}
            </tr>
          ))}
          <tr className="h-14 bg-[var(--color-surface-container)] font-semibold">
            <td className="px-2 py-2 text-center">{fmt(sum("main"))}</td>
            <td className="px-2 py-2 text-center">{fmt(sum("black"))}</td>
            <td className="px-2 py-2 text-center">{fmt(sum("white"))}</td>
            {showUnknown && <td className="px-2 py-2 text-center text-amber-800">{fmt(sum("unknown"))}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
