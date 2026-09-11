"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, ChevronRight, ImageOff } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils/money";

export default function ProductCategoriesPage() {
  const state = useStore();
  const products = Object.values(state.products);

  const categories = useMemo(() => {
    const byCategory = new Map<string, { count: number; thumbnailUrl?: string }>();
    for (const p of products) {
      const entry = byCategory.get(p.category) ?? { count: 0, thumbnailUrl: undefined };
      entry.count += 1;
      if (!entry.thumbnailUrl) {
        const sellingImages = p.images.filter((i) => i.kind === "selling");
        const mainImage = sellingImages.find((i) => i.isMain) ?? sellingImages[0];
        if (mainImage) entry.thumbnailUrl = mainImage.url;
      }
      byCategory.set(p.category, entry);
    }
    return Array.from(byCategory.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  return (
    <>
      <Header title="หมวดหมู่สินค้า" description="เลือกหมวดหมู่เพื่อดูสินค้าในหมวดนั้น" />
      <PageContainer>
        <Link href="/products" className="flex w-fit items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรกสินค้า
        </Link>

        <Card>
          {categories.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<ImageOff className="h-10 w-10" />} title="ยังไม่มีหมวดหมู่สินค้า" />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {categories.map((c) => (
                <Link
                  key={c.name}
                  href={`/products/all?category=${encodeURIComponent(c.name)}`}
                  className="flex items-center gap-3 p-4 hover:bg-[var(--color-surface-container)]"
                >
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnailUrl} alt={c.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-container)]">
                      <ImageOff className="h-4 w-4 text-[var(--color-on-surface-variant)]" />
                    </div>
                  )}
                  <span className="flex-1 text-sm font-medium text-[var(--color-on-surface)]">
                    {c.name} <span className="font-normal text-[var(--color-on-surface-variant)]">({formatNumber(c.count)})</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-on-surface-variant)]" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </PageContainer>
    </>
  );
}
