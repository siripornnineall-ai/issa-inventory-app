"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { ProductForm } from "@/components/products/ProductForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const product = useStore((s) => s.products[params.id]);

  return (
    <>
      <Header title="แก้ไขสินค้า" description={product ? product.sellingName : ""} />
      <PageContainer className="max-w-4xl">
        <RequireAccess perm="product.write">
          {product ? (
            <ProductForm existing={product} />
          ) : (
            <EmptyState title="ไม่พบสินค้านี้ในระบบ" action={<Link href="/products/all"><Button>กลับไปหน้าสินค้าทั้งหมด</Button></Link>} />
          )}
        </RequireAccess>
      </PageContainer>
    </>
  );
}
