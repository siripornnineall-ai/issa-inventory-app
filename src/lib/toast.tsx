"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastItem["kind"], message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (kind, message) =>
    set((s) => ({ items: [...s.items, { id: ++counter, kind, message }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export function toastSuccess(message: string) {
  useToastStore.getState().push("success", message);
}
export function toastError(message: string) {
  useToastStore.getState().push("error", message);
}
export function toastInfo(message: string) {
  useToastStore.getState().push("info", message);
}

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), 4500);
    return () => clearTimeout(t);
  }, [item.id, dismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-micro)] bg-white min-w-[280px] max-w-sm animate-in fade-in slide-in-from-bottom-2",
        item.kind === "success" && "border-[var(--color-success)]/30",
        item.kind === "error" && "border-[var(--color-danger)]/30",
        item.kind === "info" && "border-[var(--color-border)]"
      )}
      role="status"
    >
      {item.kind === "success" && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />}
      {item.kind === "error" && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" />}
      <p className="flex-1 text-sm text-[var(--color-on-surface)]">{item.message}</p>
      <button onClick={() => dismiss(item.id)} className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]" aria-label="ปิด">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastRow item={item} />
        </div>
      ))}
    </div>
  );
}
