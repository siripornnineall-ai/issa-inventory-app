"use client";

import { useMemo, useState } from "react";
import { Scissors } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useStore, useActions } from "@/lib/store";
import { toastError, toastSuccess } from "@/lib/toast";

// ตั้งค่า "เย็บตามออเดอร์": สินค้ารุ่นนี้ไม่ถือสต็อกเอง ขายแล้วตัดตัวเปล่าจากรุ่นต้นทาง (สี/ไซซ์เดียวกัน) มาเย็บ
export function SourceLinkCard({ productId }: { productId: string }) {
  const state = useStore();
  const { linkProductSource, unlinkProductSource } = useActions();
  const [pick, setPick] = useState("");

  const info = useMemo(() => {
    const own = Object.values(state.variants).filter((v) => v.productId === productId);
    const linked = own.filter((v) => v.sourceVariantId && state.variants[v.sourceVariantId]);
    const sourceProductId = linked.length > 0 ? state.variants[linked[0].sourceVariantId!].productId : undefined;
    const ownIds = new Set(own.map((v) => v.id));
    // รุ่นอื่นที่ตัดตัวเปล่าจากรุ่นนี้
    const dependents = new Set<string>();
    for (const v of Object.values(state.variants)) {
      if (v.sourceVariantId && ownIds.has(v.sourceVariantId)) dependents.add(v.productId);
    }
    return { total: own.length, linked: linked.length, sourceProductId, dependents: Array.from(dependents) };
  }, [state.variants, productId]);

  const candidates = useMemo(
    () =>
      Object.values(state.products)
        .filter((p) => p.id !== productId && p.status !== "discontinued")
        .sort((a, b) => a.sellingName.localeCompare(b.sellingName)),
    [state.products, productId]
  );

  function link() {
    if (!pick) {
      toastError("กรุณาเลือกรุ่นที่จะตัดตัวเปล่ามาเย็บ");
      return;
    }
    try {
      const res = linkProductSource(productId, pick);
      const name = state.products[pick]?.sellingName ?? "";
      toastSuccess(
        res.unmatched.length > 0
          ? `เชื่อมกับ ${name} แล้ว ${res.linked} ตัวเลือก (ไม่พบสี/ไซซ์ที่ตรงกัน ${res.unmatched.length} ตัวเลือก: ${res.unmatched.slice(0, 5).join(", ")}${res.unmatched.length > 5 ? " ..." : ""})`
          : `เชื่อมกับ ${name} แล้ว ${res.linked} ตัวเลือก`
      );
      setPick("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  function unlink() {
    try {
      const n = unlinkProductSource(productId);
      toastSuccess(`เลิกเชื่อมแล้ว ${n} ตัวเลือก รุ่นนี้กลับไปใช้สต็อกของตัวเอง`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  const sourceName = info.sourceProductId ? state.products[info.sourceProductId]?.sellingName : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-4 w-4" /> เย็บตามออเดอร์ (ตัดตัวเปล่าจากรุ่นอื่น)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0 text-sm">
        {info.dependents.length > 0 && (
          <p className="rounded-lg bg-[var(--color-surface-container)] px-3 py-2 text-xs">
            ตัวเปล่ารุ่นนี้ถูกใช้เย็บเป็น: <b>{info.dependents.map((id) => state.products[id]?.sellingName).filter(Boolean).join(", ")}</b> เมื่อมีออเดอร์ขายรุ่นนั้นและไม่มีของที่เย็บแล้ว ระบบจะตัดสต็อกรุ่นนี้ให้อัตโนมัติ (ประวัติบันทึกเป็น &quot;แปลงรุ่น&quot;)
          </p>
        )}
        {info.sourceProductId ? (
          <>
            <p>
              รุ่นนี้ตัดตัวเปล่าจาก <b>{sourceName}</b> · เชื่อมแล้ว {info.linked} จาก {info.total} ตัวเลือก
            </p>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              ตอนขาย (เบิกออกแบบขาย) ถ้ารุ่นนี้ไม่มีของที่เย็บแล้ว ระบบตัดตัวเปล่าสี/ไซซ์เดียวกันจาก {sourceName} มาให้เอง แล้วจึงขาย ใบเบิกเลขเดียวกันบันทึกทั้งแปลงรุ่นและการขาย ตัวเลขสต็อกรวมไม่ซ้ำกัน และการแปลงไม่นับเป็นสต็อกเข้า/ออกบนแดชบอร์ด
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={unlink}>
                เลิกเชื่อม
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              ใช้กับสินค้าที่เย็บ/เพิ่มดีเทลบนตัวเปล่าของรุ่นอื่นหลังมีออเดอร์ เลือกรุ่นตัวเปล่า ระบบจับคู่ตามสีและไซซ์ที่ตรงกัน
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="รุ่นตัวเปล่า" className="w-64">
                <option value="">เลือกรุ่นตัวเปล่า...</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sellingName}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" size="sm" onClick={link}>
                เชื่อม
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
