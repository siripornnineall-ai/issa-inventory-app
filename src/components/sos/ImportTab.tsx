"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";
import { importSosParsed, saveCodeMapping, type ImportResult } from "@/lib/supabase/sos";
import { parseSosFile, type SosParsed } from "@/lib/utils/sosImport";
import { isSosNonProduct, sosCostPerPiece } from "@/lib/utils/sosMapping";
import type { SosBranch, SosImportRow } from "@/lib/utils/sosAnalysis";
import { useStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatThaiDate } from "@/lib/utils/date";
import { formatNumber, formatTHB } from "@/lib/utils/money";

interface Pending {
  fileName: string;
  parsed: SosParsed | null;
  error?: string;
  duplicate: boolean;
  result?: ImportResult;
  importing?: boolean;
}

// นำเข้าไฟล์รายงานของ SOS (.xls) ได้หลายไฟล์พร้อมกัน แต่ละไฟล์คือหนึ่งสาขาหนึ่งงวด ดูตัวอย่างก่อนยืนยัน ไฟล์งวดเดิมนำเข้าซ้ำต้องกดยืนยันแทนที่
export function ImportTab({ branches, imports, codeMap, onChanged }: { branches: SosBranch[]; imports: SosImportRow[]; codeMap: Record<string, string>; onChanged: () => void }) {
  const state = useStore();
  const user = useCurrentUser();
  const [pending, setPending] = useState<Pending[]>([]);

  const isDuplicate = (p: SosParsed) => {
    const b = branches.find((x) => x.name === p.branchName);
    return Boolean(b && imports.some((i) => i.branch_id === b.id && i.period_start === p.periodStart && i.period_end === p.periodEnd));
  };

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Pending[] = [];
    for (const f of Array.from(files)) {
      try {
        const parsed = parseSosFile(await f.arrayBuffer());
        next.push({ fileName: f.name, parsed, duplicate: isDuplicate(parsed) });
      } catch (e) {
        next.push({ fileName: f.name, parsed: null, error: e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ", duplicate: false });
      }
    }
    setPending(next);
  }

  async function run(index: number) {
    const item = pending[index];
    if (!item?.parsed || !user || item.importing) return;
    setPending((p) => p.map((x, i) => (i === index ? { ...x, importing: true, error: undefined } : x)));
    try {
      const result = await importSosParsed(createClient(), item.parsed, { state, fileName: item.fileName, userId: user.id, userName: user.name, codeMap, replace: item.duplicate });
      setPending((p) => p.map((x, i) => (i === index ? { ...x, importing: false, result } : x)));
      toastSuccess(`นำเข้า ${result.branchName} แล้ว`);
      onChanged();
    } catch (e) {
      setPending((p) => p.map((x, i) => (i === index ? { ...x, importing: false, error: e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ" } : x)));
      toastError(e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold">นำเข้าไฟล์จาก SOS</h2>
        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">เลือกไฟล์ .xls ที่ดาวน์โหลดจาก SOS (ชื่อไฟล์ขึ้นต้น Bill-...) ได้หลายไฟล์พร้อมกัน แต่ละไฟล์มีทั้งยอดขายและสินค้าคงเหลือของสาขานั้น ทุกวันที่ 1 ของเดือนให้นำเข้างวดเดือนที่แล้ว</p>
        <input type="file" accept=".xls,.xlsx" multiple onChange={(e) => onFiles(e.target.files)} aria-label="เลือกไฟล์ SOS" className="mt-3 block text-sm" />
      </Card>

      {pending.map((p, i) => (
        <Card key={`${p.fileName}-${i}`} className="p-5">
          <p className="text-sm font-semibold">{p.fileName}</p>
          {p.error && !p.parsed && <p role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{p.error}</p>}
          {p.parsed && (
            <>
              <p className="mt-1 text-sm">
                {p.parsed.branchName} · ขาย {formatThaiDate(p.parsed.periodStart)} - {formatThaiDate(p.parsed.periodEnd)} · สต็อก ณ {p.parsed.stockAsOf ? formatThaiDate(p.parsed.stockAsOf) : "-"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                ส่วนปกติ {formatNumber(p.parsed.sales.filter((l) => l.section === "main").reduce((s, l) => s + l.qty, 0))} ชิ้น · ยอดขายรวม {formatTHB(p.parsed.summary.salesTotal ?? 0)} · GP {formatTHB(p.parsed.summary.gp ?? 0)} · ยอดรับ {formatTHB(p.parsed.summary.receivedExVat ?? p.parsed.summary.received ?? 0)} · ต้นทุน{" "}
                {formatTHB(p.parsed.sales.filter((l) => l.section === "main").reduce((s, l) => s + l.qty * sosCostPerPiece(l.description), 0))} · ส่วนบัตรเครดิต {formatNumber(p.parsed.sales.filter((l) => l.section === "credit").reduce((s, l) => s + l.qty, 0))} ชิ้น · สต็อก{" "}
                {formatNumber(p.parsed.stock.reduce((s, l) => s + l.qty, 0))} ชิ้น
              </p>
              {p.parsed.warnings.map((w) => (
                <p key={w} className="mt-1 text-xs text-[var(--color-warning)]">⚠ {w}</p>
              ))}
              {p.duplicate && !p.result && <p className="mt-1 text-xs font-medium text-[var(--color-danger)]">งวดนี้ของสาขานี้นำเข้าไปแล้ว กดนำเข้าจะ &quot;แทนที่&quot; ข้อมูลเดิมด้วยไฟล์นี้</p>}
              {p.error && <p role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{p.error}</p>}
              {p.result ? (
                <p className="mt-2 text-sm font-medium text-[var(--color-success)]">
                  นำเข้าแล้ว{p.result.replaced ? " (แทนที่ของเดิม)" : ""} · ยอดขาย {formatNumber(p.result.salesLines)} รายการ · สต็อก {formatNumber(p.result.stockLines)} รายการ · จับคู่กับสินค้าเราได้ {formatNumber(p.result.mapped)} · ยังจับคู่ไม่ได้ {formatNumber(p.result.unmapped)}
                </p>
              ) : (
                <div className="mt-3">
                  <Button onClick={() => run(i)} loading={p.importing}>
                    {p.duplicate ? "แทนที่ข้อมูลงวดนี้" : "นำเข้า"}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      ))}

      <UnmappedMapper onChanged={onChanged} />
    </div>
  );
}

interface UnmappedRow {
  code: string;
  description: string;
}

// รหัสสินค้าของ SOS ที่ยังจับคู่กับสินค้าเราไม่ได้ (สีอื่น รุ่นที่ไม่มีในระบบ ฯลฯ) เลือกสินค้าเราให้ครั้งเดียว ระบบจำไว้ใช้ทุกเดือน
function UnmappedMapper({ onChanged }: { onChanged: () => void }) {
  const state = useStore();
  const [rows, setRows] = useState<UnmappedRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [picks, setPicks] = useState<Record<string, { productId: string; variantId: string }>>({});

  async function load() {
    const supabase = createClient();
    const [a, b] = await Promise.all([
      supabase.from("sos_sales_lines").select("sos_code, description").is("variant_id", null).limit(3000),
      supabase.from("sos_stock_lines").select("sos_code, description").is("variant_id", null).limit(3000),
    ]);
    const map = new Map<string, string>();
    for (const r of [...(a.data ?? []), ...(b.data ?? [])] as { sos_code: string; description: string }[]) if (!map.has(r.sos_code) && !isSosNonProduct(r.description)) map.set(r.sos_code, r.description);
    setRows([...map.entries()].map(([code, description]) => ({ code, description })).sort((x, y) => x.description.localeCompare(y.description, "th")));
    setLoaded(true);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดรายการที่ยังจับคู่ไม่ได้ตอนเปิดแท็บ
    void load().catch(() => setLoaded(true));
  }, []);

  const products = useMemo(() => Object.values(state.products).sort((a, b) => a.sellingName.localeCompare(b.sellingName, "th")), [state.products]);

  async function save(code: string) {
    const pick = picks[code];
    if (!pick?.variantId) {
      toastError("เลือกสี/ไซซ์ของสินค้าเราก่อน");
      return;
    }
    try {
      await saveCodeMapping(createClient(), code, pick.variantId);
      toastSuccess("จับคู่แล้ว");
      setRows((r) => r.filter((x) => x.code !== code));
      onChanged();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">รายการที่ยังจับคู่กับสินค้าเราไม่ได้ ({loaded ? rows.length : "..."})</h2>
      <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">จับคู่แล้วระบบจำไว้ ไม่ต้องทำซ้ำเดือนถัดไป รายการที่ไม่มีในระบบเรา (เช่น เข็มขัด เสื้อ) ข้ามได้ ไม่กระทบต้นทุนและกำไร</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">{loaded ? "ไม่มีรายการค้าง" : "กำลังโหลด..."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)] text-sm">
          {rows.slice(0, 60).map((r) => {
            const pick = picks[r.code];
            const variants = pick?.productId ? Object.values(state.variants).filter((v) => v.productId === pick.productId) : [];
            return (
              <li key={r.code} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="truncate font-medium">{r.description}</p>
                  <p className="font-mono text-xs text-[var(--color-on-surface-variant)]">{r.code}</p>
                </div>
                <Select value={pick?.productId ?? ""} onChange={(e) => setPicks((p) => ({ ...p, [r.code]: { productId: e.target.value, variantId: "" } }))} aria-label={`รุ่นของเรา ${r.code}`} className="w-44">
                  <option value="">เลือกรุ่น</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sellingName}
                    </option>
                  ))}
                </Select>
                <Select value={pick?.variantId ?? ""} onChange={(e) => setPicks((p) => ({ ...p, [r.code]: { productId: p[r.code]?.productId ?? "", variantId: e.target.value } }))} aria-label={`สี/ไซซ์ ${r.code}`} className="w-40" disabled={!pick?.productId}>
                  <option value="">สี / ไซซ์</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.color} / {v.size}
                    </option>
                  ))}
                </Select>
                <Button size="sm" onClick={() => save(r.code)}>
                  จับคู่
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 60 && <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">แสดง 60 รายการแรก จับคู่แล้วรายการถัดไปจะขึ้นมา</p>}
    </Card>
  );
}
