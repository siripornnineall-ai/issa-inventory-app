"use client";

import Link from "next/link";
import { LayoutGrid, Layers, Package } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { useStore } from "@/lib/store";

export default function ProductsHubPage() {
  const state = useStore();
  const brands = Object.values(state.brands)
    .filter((b) => b.active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const tiles: { key: string; label: string; href: string; logoUrl?: string; icon?: React.ReactNode }[] = [
    ...brands.map((b) => ({ key: b.id, label: b.name, href: `/products/all?brand=${b.id}`, logoUrl: b.logoUrl })),
    { key: "all", label: "รายการสินค้าทั้งหมด", href: "/products/all", icon: <LayoutGrid className="h-5 w-5" /> },
    { key: "categories", label: "หมวดหมู่", href: "/products/categories", icon: <Layers className="h-5 w-5" /> },
  ];

  return (
    <>
      <Header title="สินค้าทั้งหมด" description="เลือกดูสินค้าตามแบรนด์ หรือดูสินค้าทั้งหมด/หมวดหมู่" />
      <PageContainer>
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {tiles.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center hover:bg-[var(--color-surface-container)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-surface-container)] text-[var(--color-primary-container)]">
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logoUrl} alt={t.label} className="h-full w-full object-cover" />
                  ) : (
                    (t.icon ?? <Package className="h-5 w-5" />)
                  )}
                </div>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-[var(--color-on-surface)]">{t.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </PageContainer>
    </>
  );
}
