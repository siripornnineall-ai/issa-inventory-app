"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { toastError, toastSuccess } from "@/lib/toast";
import { CUSTOM_LABEL_MAX } from "@/lib/utils/returnReasons";
import type { ReturnOptionKind } from "@/lib/supabase/returnOptions";
import type { ReturnOptionsApi } from "./useReturnOptions";

function Row({ kind, title, placeholder, api, user }: { kind: ReturnOptionKind; title: string; placeholder: string; api: ReturnOptionsApi; user: { id: string; name: string } | null }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = kind === "reason" ? api.reasons : api.tags;

  async function submit() {
    if (!user || !text.trim()) return;
    setBusy(true);
    try {
      await api.add(kind, text, user);
      setText("");
      toastSuccess("เพิ่มแล้ว ใช้ได้ทุกเครื่องและวันต่อไป");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium">{title}</p>
      <div className="flex gap-2">
        <Input
          value={text}
          maxLength={CUSTOM_LABEL_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          aria-label={title}
          className="h-9"
        />
        <Button type="button" size="sm" onClick={() => void submit()} disabled={busy || !text.trim() || !user}>
          เพิ่ม
        </Button>
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {list.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white py-1 pl-3 pr-1.5 text-sm">
              {o.label}
              <button
                type="button"
                aria-label={`ลบ ${o.label}`}
                className="rounded-full p-1 text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
                onClick={() => {
                  if (!window.confirm(`ลบ "${o.label}" ออกจากรายการให้เลือก? (ใบที่บันทึกไปแล้วยังเก็บข้อความนี้ไว้เหมือนเดิม)`)) return;
                  api.remove(o.id).catch((e) => toastError(e instanceof Error ? e.message : "ลบไม่สำเร็จ"));
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// เพิ่ม/ลบ เหตุผลที่ลูกค้าคืน และคำที่ลูกค้าพูด ของร้านเอง เก็บไว้ใช้ต่อทุกวัน
export function ReturnOptionsManager({ api, user }: { api: ReturnOptionsApi; user: { id: string; name: string } | null }) {
  return (
    <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container)]/40 p-3">
      <summary className="cursor-pointer text-sm font-medium">+ เพิ่มเหตุผลใหม่ของร้าน (เก็บไว้ใช้ต่อทุกวัน)</summary>
      <div className="mt-3 flex flex-col gap-4">
        <Row kind="reason" title="เหตุผลที่ลูกค้าคืน (เลือกได้ 1 ข้อต่อรายการ)" placeholder="เช่น ลูกค้าสั่งซ้ำ" api={api} user={user} />
        <Row kind="tag" title="คำที่ลูกค้าพูด (เลือกได้หลายข้อ)" placeholder="เช่น ตะเข็บหลุด" api={api} user={user} />
      </div>
    </details>
  );
}
