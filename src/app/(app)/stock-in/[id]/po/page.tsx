"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VatToggle } from "@/components/ui/VatToggle";
import { PoDocument } from "@/components/products/PoDocument";

export default function StockInPoPage() {
  const params = useParams<{ id: string }>();
  const [vatEnabled, setVatEnabled] = useState(false);

  return (
    <div>
      <div className="mx-auto flex max-w-3xl items-center justify-between p-8 pb-0 print:hidden">
        <Link href="/products/all" className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Link>
        <div className="flex items-center gap-3">
          <VatToggle value={vatEnabled} onChange={setVatEnabled} />
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> พิมพ์ / บันทึกเป็น PDF
          </Button>
        </div>
      </div>
      <PoDocument docId={params.id} vatEnabled={vatEnabled} />
    </div>
  );
}
