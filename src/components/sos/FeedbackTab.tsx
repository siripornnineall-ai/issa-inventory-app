"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";
import { addFeedback, deleteFeedback, type SosFeedbackRow } from "@/lib/supabase/sos";
import type { SosBranch } from "@/lib/utils/sosAnalysis";
import { useCan, useCurrentUser } from "@/lib/auth/session";
import { toastError, toastSuccess } from "@/lib/toast";
import { formatThaiDateTime } from "@/lib/utils/date";

const KIND_LABEL: Record<SosFeedbackRow["kind"], string> = { good: "ขายดี / ลูกค้าชอบ", bad: "ปัญหา / ขายไม่ออก", request: "ลูกค้าถามหา", other: "อื่นๆ" };
const KIND_TONE: Record<SosFeedbackRow["kind"], "success" | "danger" | "info" | "neutral"> = { good: "success", bad: "danger", request: "info", other: "neutral" };

// Feedback จากทีมขายหน้าร้าน: จดความเห็นรายสาขา/รายรุ่น ใช้ประกอบการแนะนำ SKU (ยอดขายจริงเป็นหลัก)
export function FeedbackTab({ branches, feedback, onChanged }: { branches: SosBranch[]; feedback: SosFeedbackRow[]; onChanged: () => void }) {
  const user = useCurrentUser();
  const canFinance = useCan("report.view");
  const [branchId, setBranchId] = useState("");
  const [productName, setProductName] = useState("");
  const [sosCode, setSosCode] = useState("");
  const [kind, setKind] = useState<SosFeedbackRow["kind"]>("good");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterBranch, setFilterBranch] = useState("");

  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? "สาขาอื่น" : "ทุกสาขา");

  async function submit() {
    if (!user) return;
    if (!note.trim()) {
      toastError("กรุณาพิมพ์ความเห็น");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await addFeedback(createClient(), { branchId: branchId || null, productName, sosCode, kind, note, authorId: user.id, authorName: user.name });
      toastSuccess("บันทึก feedback แล้ว");
      setNote("");
      setProductName("");
      setSosCode("");
      onChanged();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteFeedback(createClient(), id);
      onChanged();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  const shown = feedback.filter((f) => !filterBranch || f.branch_id === filterBranch);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold">เพิ่ม feedback จากหน้าร้าน</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="สาขา">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="สาขา">
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="ชนิด">
            <Select value={kind} onChange={(e) => setKind(e.target.value as SosFeedbackRow["kind"])} aria-label="ชนิด">
              {(Object.keys(KIND_LABEL) as SosFeedbackRow["kind"][]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="ชื่อรุ่น (ถ้ามี)" hint="เช่น Billie Slim ใช้จับกับสินค้าตอนแนะนำ SKU">
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Billie Slim" aria-label="ชื่อรุ่น" />
          </FormField>
          <FormField label="รหัสสินค้า SOS (ถ้ามี)">
            <Input value={sosCode} onChange={(e) => setSosCode(e.target.value)} placeholder="B1590-A1595" aria-label="รหัสสินค้า SOS" />
          </FormField>
          <FormField label="ความเห็น" className="sm:col-span-2 lg:col-span-4">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลูกค้าถามหาไซซ์ XL สีดำบ่อย / ทรงนี้ลูกค้าบ่นว่าคับ" rows={3} aria-label="ความเห็น" />
          </FormField>
        </div>
        <div className="mt-3">
          <Button onClick={submit} loading={saving}>
            บันทึก feedback
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">feedback ทั้งหมด ({shown.length})</h2>
          <Select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} aria-label="กรองสาขา" className="w-52">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        {shown.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">ยังไม่มี feedback</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)] text-sm">
            {shown.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[f.kind]}>{KIND_LABEL[f.kind]}</Badge>
                    <span className="font-medium">{branchName(f.branch_id)}</span>
                    {f.product_name && <span className="text-[var(--color-on-surface-variant)]">· {f.product_name}</span>}
                    {f.sos_code && <span className="font-mono text-xs text-[var(--color-on-surface-variant)]">{f.sos_code}</span>}
                  </p>
                  <p className="mt-1">{f.note}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                    {f.author_name} · {formatThaiDateTime(f.created_at)}
                  </p>
                </div>
                {(f.author_id === user?.id || canFinance) && (
                  <Button size="sm" variant="secondary" onClick={() => remove(f.id)} aria-label="ลบ feedback">
                    ลบ
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
