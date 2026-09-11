"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VatToggle } from "@/components/ui/VatToggle";
import { PoDocument } from "@/components/products/PoDocument";

export default function PurchaseOrdersPrintPage() {
  const searchParams = useSearchParams();
  const ids = useMemo(() => (searchParams.get("ids") ?? "").split(",").filter(Boolean), [searchParams]);
  const [vatEnabled, setVatEnabled] = useState(false);

  if (ids.length === 0) {
    return <div className="p-8 text-sm text-[var(--color-on-surface-variant)]">ไม่ได้เลือกใบสั่งซื้อ</div>;
  }

  return (
    <div>
      <div className="mx-auto flex max-w-3xl items-center justify-between p-8 pb-0 print:hidden">
        <Link href="/purchase-orders" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Link>
        <div className="flex items-center gap-3">
          <VatToggle value={vatEnabled} onChange={setVatEnabled} />
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> พิมพ์ทั้งหมด ({ids.length} ใบ)
          </Button>
        </div>
      </div>
      {ids.map((id, idx) => (
        <PoDocument key={id} docId={id} vatEnabled={vatEnabled} className={idx < ids.length - 1 ? "print:break-after-page" : undefined} />
      ))}
    </div>
  );
}
