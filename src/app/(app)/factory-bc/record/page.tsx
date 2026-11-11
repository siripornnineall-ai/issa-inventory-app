"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { DraftBanner } from "@/components/stock/DraftBanner";
import { SaveSuccessCard, type SavedInfo } from "@/components/stock/SaveSuccessCard";
import { useStore, useActions } from "@/lib/store";
import { useCan, useCurrentUser } from "@/lib/auth/session";
import { toastError } from "@/lib/toast";
import { todayInputValue, dateInputToISO } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";
import { compareSizes } from "@/lib/utils/sizes";
import { sortColors } from "@/lib/utils/colorOrder";
import { useSaveGuard } from "@/lib/utils/saveGuard";
import { useDraft } from "@/lib/utils/useDraft";
import { useUnsavedChangesGuard } from "@/lib/utils/useUnsavedChangesGuard";
import { wipBalances } from "@/lib/utils/factoryWip";
import { FACTORY_WIP_KINDS, FACTORY_WIP_KIND_LABEL_TH, isFactoryWipKind, type FactoryWipKind } from "@/lib/types";

const KIND_HINT: Record<FactoryWipKind, string> = {
  opening: "กรอกจำนวนตัวที่ตัดไว้แต่ยังไม่เย็บที่มีอยู่ตอนนี้ (นับจริงที่โรงงาน) ใช้ครั้งแรกครั้งเดียว",
  cut_in: "ตัดผ้าเพิ่มกี่ชิ้น กรอกจำนวนที่ตัดเพิ่มในรอบนี้",
  adjust: "นับแล้วไม่ตรง กรอกส่วนต่าง (ติดลบได้ เช่น -5 = ของจริงน้อยกว่าในระบบ 5 ชิ้น) ต้องใส่เหตุผล",
  scrap: "ตัวที่เสียหายหรือทิ้ง กรอกจำนวนที่เสียหาย (กรอกเป็นบวก ระบบหักให้) ต้องใส่เหตุผล",
};

interface Draft {
  kind: FactoryWipKind;
  note: string;
  qty: Record<string, string>;
}

function RecordForm({ onAgain }: { onAgain: () => void }) {
  const state = useStore();
  const { recordFactoryWip } = useActions();
  const user = useCurrentUser();
  const router = useRouter();
  const canAdjust = useCan("stock.adjust");
  const guard = useSaveGuard();

  const kinds = FACTORY_WIP_KINDS.filter((k) => canAdjust || (k !== "adjust" && k !== "scrap"));
  const [kind, setKind] = useState<FactoryWipKind>("cut_in");
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [productId, setProductId] = useState("");
  // จำนวนที่กรอกเก็บตาม variantId ข้ามรุ่นได้ (กรอกหลายรุ่นแล้วบันทึกครั้งเดียว)
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedInfo | null>(null);

  const balances = useMemo(() => wipBalances(state), [state]);
  const products = useMemo(
    () => Object.values(state.products).filter((p) => p.status !== "discontinued").sort((a, b) => a.sellingName.localeCompare(b.sellingName, "th")),
    [state.products]
  );
  const variants = useMemo(() => Object.values(state.variants).filter((v) => v.productId === productId && v.active), [state.variants, productId]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size))].sort(compareSizes), [variants]);
  const colors = useMemo(() => sortColors([...new Set(variants.map((v) => v.color))], state.products[productId]), [variants, state.products, productId]);

  const entered = useMemo(
    () =>
      Object.entries(qty)
        .map(([variantId, raw]) => ({ variantId, value: Number(raw) }))
        .filter((e) => raw(e.value) && e.value !== 0),
    [qty]
  );
  const total = entered.reduce((s, e) => s + e.value, 0);
  const modelCount = new Set(entered.map((e) => state.variants[e.variantId]?.productId)).size;
  const dirty = !saved && (entered.length > 0 || note.trim().length > 0);
  useUnsavedChangesGuard(dirty);

  // เก็บร่างไว้ในเครื่อง: รีเฟรช/ล็อกอินหมดอายุแล้วตัวเลขที่กรอกไม่หาย (ถามก่อนว่าจะทำต่อไหม)
  const draftValue = useMemo<Draft>(() => ({ kind, note, qty }), [kind, note, qty]);
  const draft = useDraft<Draft>({
    key: user ? `issa-draft:factory-bc:${user.id}` : null,
    value: draftValue,
    hasContent: dirty,
    onRestore: (v) => {
      if (isFactoryWipKind(v.kind) && kinds.includes(v.kind)) setKind(v.kind);
      setNote(v.note ?? "");
      setQty(Object.fromEntries(Object.entries(v.qty ?? {}).filter(([id]) => state.variants[id])));
    },
  });

  function setCell(variantId: string, value: string) {
    setQty((prev) => {
      const next = { ...prev };
      if (value === "") delete next[variantId];
      else next[variantId] = value;
      return next;
    });
  }

  function handleSubmit() {
    if (!user) return;
    if (entered.length === 0) {
      toastError("กรุณากรอกจำนวนอย่างน้อย 1 ช่อง");
      return;
    }
    if (entered.some((e) => !Number.isInteger(e.value))) {
      toastError("จำนวนต้องเป็นจำนวนเต็ม");
      return;
    }
    if (kind !== "adjust" && entered.some((e) => e.value < 0)) {
      toastError("จำนวนต้องมากกว่า 0 (ถ้าจะลดยอดให้ใช้ปรับยอดหรือเสียหาย)");
      return;
    }
    if ((kind === "adjust" || kind === "scrap") && !note.trim()) {
      toastError("กรุณาระบุเหตุผล");
      return;
    }
    guard.run(save);
  }

  function save(): "keep" | "release" {
    if (!user) return "release";
    try {
      const res = recordFactoryWip({
        kind,
        date: dateInputToISO(date),
        note: note.trim() || undefined,
        actorId: user.id,
        actorName: user.name,
        lines: entered.map((e) => ({ variantId: e.variantId, qty: e.value })),
      });
      draft.clear();
      setSaved({ docNo: `BC-${res.batchId.slice(0, 6).toUpperCase()}`, totalQty: Math.abs(res.pieces), lineCount: res.entries });
      return "keep";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      return "release";
    }
  }

  if (saved) {
    return <SaveSuccessCard title="บันทึกตัวที่ยังไม่เย็บแล้ว" info={saved} againLabel="บันทึกต่อ" onAgain={onAgain} backHref="/factory-bc" backLabel="ไปหน้าโรงงาน BC" />;
  }

  const summaryOfDraft = draft.draft ? `${Object.keys(draft.draft.value.qty ?? {}).length} ช่อง` : "";

  return (
    <div className="flex flex-col gap-6 pb-20">
      {draft.draft && <DraftBanner savedAt={draft.draft.savedAt} summary={summaryOfDraft} onRestore={draft.restore} onDiscard={draft.discard} />}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการบันทึก</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <FormField label="ประเภท" required hint={KIND_HINT[kind]} className="col-span-2 lg:col-span-2">
            <Select value={kind} onChange={(e) => isFactoryWipKind(e.target.value) && setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {FACTORY_WIP_KIND_LABEL_TH[k]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="วันที่" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label={kind === "adjust" || kind === "scrap" ? "เหตุผล" : "หมายเหตุ"} required={kind === "adjust" || kind === "scrap"} className="col-span-2 lg:col-span-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ล็อตผ้า / เหตุผลที่ปรับยอด" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>จำนวนแยกสี/ไซซ์</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="รุ่น">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="เลือกรุ่น">
              <option value="">เลือกรุ่น</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sellingName}
                  {p.brandId && state.brands[p.brandId] ? ` · ${state.brands[p.brandId].name}` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          {!productId ? (
            <p className="text-sm text-[var(--color-on-surface-variant)]">เลือกรุ่นเพื่อกรอกจำนวนแยกสี/ไซซ์ กรอกได้หลายรุ่น เปลี่ยนรุ่นแล้วตัวเลขที่กรอกไว้ยังอยู่ แล้วกดบันทึกครั้งเดียว</p>
          ) : variants.length === 0 ? (
            <p className="text-sm text-[var(--color-on-surface-variant)]">รุ่นนี้ยังไม่มีสี/ไซซ์ในระบบ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--color-primary-container)] text-white">
                    <th className="sticky left-0 z-10 bg-[var(--color-primary-container)] px-3 py-2 text-left font-medium">สี</th>
                    {sizes.map((s) => (
                      <th key={s} className="px-2 py-2 text-center font-medium">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colors.map((color) => (
                    <tr key={color} className="border-b border-[var(--color-border)]">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{color}</td>
                      {sizes.map((size) => {
                        const v = variants.find((x) => x.color === color && x.size === size);
                        if (!v) return <td key={size} className="px-2 py-2 text-center text-[var(--color-on-surface-variant)]/40">–</td>;
                        const bal = balances.get(v.id) ?? 0;
                        return (
                          <td key={size} className="px-1 py-1.5 text-center align-top">
                            <Input
                              type="number"
                              inputMode="numeric"
                              step={1}
                              min={kind === "adjust" ? undefined : 0}
                              value={qty[v.id] ?? ""}
                              onChange={(e) => setCell(v.id, e.target.value)}
                              aria-label={`${color} ${size}`}
                              className="h-9 w-16 px-1 text-center"
                            />
                            <span className={`mt-0.5 block text-[10px] ${bal < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-on-surface-variant)]"}`}>ตอนนี้ {formatNumber(bal)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {entered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4 text-sm">
              <span>
                กรอกแล้ว <span className="font-semibold">{formatNumber(entered.length)}</span> ช่อง จาก <span className="font-semibold">{formatNumber(modelCount)}</span> รุ่น
              </span>
              <span>
                รวม <span className="font-semibold">{kind === "scrap" ? "-" : ""}{formatNumber(Math.abs(total))}</span> ชิ้น
              </span>
              <Button variant="ghost" onClick={() => setQty({})}>
                ล้างที่กรอกทั้งหมด
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            draft.clear();
            router.replace("/factory-bc");
          }}
        >
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} loading={guard.locked}>
          บันทึก
        </Button>
      </div>
    </div>
  );
}

// ค่าที่พิมพ์ไม่ใช่ตัวเลข (เช่น "-" ที่ยังพิมพ์ไม่เสร็จ) ถือว่ายังไม่กรอก
function raw(n: number): boolean {
  return Number.isFinite(n);
}

export default function FactoryRecordPage() {
  const [round, setRound] = useState(0);
  return (
    <>
      <Header title="บันทึกตัวที่ยังไม่เย็บ" description="โรงงาน BC: ยอดตั้งต้น ตัดเข้า ปรับยอด หรือเสียหาย แยกสีและไซซ์" />
      <PageContainer className="max-w-5xl">
        <RequireAccess perm="stock.in">
          <RecordForm key={round} onAgain={() => setRound((n) => n + 1)} />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
