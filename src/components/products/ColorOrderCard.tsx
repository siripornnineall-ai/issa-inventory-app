"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "@/components/products/ColorSwatch";
import { useActions } from "@/lib/store";
import { toastError, toastSuccess } from "@/lib/toast";
import { orderedColorsOf } from "@/lib/utils/colorOrder";
import type { Product } from "@/lib/types";

// ลำดับสีของรุ่นนี้ที่ใช้แสดงในทุกหน้า (สต็อก ยอดขาย นับสต็อก โรงงาน BC ฯลฯ) เป็นการแสดงผลอย่างเดียว ไม่กระทบจำนวนสต็อก
// ไม่ได้ตั้งไว้ = ใช้ลำดับมาตรฐาน (colorOrder.ts) ตั้งแล้วเก็บเป็นลำดับของรุ่นนี้
export function ColorOrderCard({ product, colors }: { product: Product; colors: string[] }) {
  const { updateProduct } = useActions();
  const initial = orderedColorsOf(colors, product);
  const [order, setOrder] = useState<string[]>(initial);
  const changed = order.join("\u0000") !== initial.join("\u0000");

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function save() {
    try {
      updateProduct(product.id, { colorOrder: order });
      toastSuccess("บันทึกลำดับสีแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  function resetToDefault() {
    try {
      updateProduct(product.id, { colorOrder: undefined });
      toastSuccess("กลับไปใช้ลำดับมาตรฐานแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>ลำดับสี</CardTitle>
        <div className="flex gap-2">
          {product.colorOrder && product.colorOrder.length > 0 && (
            <Button size="sm" variant="secondary" onClick={resetToDefault}>
              ใช้ลำดับมาตรฐาน
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={!changed}>
            บันทึกลำดับ
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 text-xs text-[var(--color-on-surface-variant)]">
          สีของรุ่นนี้จะเรียงตามลำดับนี้ในทุกหน้า (สต็อก ยอดขาย นับสต็อก โรงงาน BC) {product.colorOrder && product.colorOrder.length > 0 ? "ตอนนี้ใช้ลำดับที่ตั้งเองของรุ่นนี้" : "ตอนนี้ใช้ลำดับมาตรฐาน"} เป็นการแสดงผลอย่างเดียว ไม่กระทบจำนวนสต็อก
        </p>
        <ol className="flex flex-col gap-1.5">
          {order.map((color, i) => (
            <li key={color} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-3 py-1.5">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-5 text-right text-xs tabular-nums text-[var(--color-on-surface-variant)]">{i + 1}</span>
                <ColorSwatch name={color} size={20} />
                {color}
              </span>
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`เลื่อน ${color} ขึ้น`} className="rounded-md p-1 hover:bg-[var(--color-surface-container)] disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`เลื่อน ${color} ลง`} className="rounded-md p-1 hover:bg-[var(--color-surface-container)] disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
