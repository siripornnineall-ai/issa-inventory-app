"use client";

import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { ProductForm } from "@/components/products/ProductForm";

export default function NewProductPage() {
  return (
    <>
      <Header title="เพิ่มสินค้าใหม่" description="กรอกข้อมูลสินค้าที่รับมาและข้อมูลสำหรับขาย พร้อมตัวเลือกสี/ไซซ์" />
      <PageContainer className="max-w-4xl">
        <RequireAccess perm="product.write">
          <ProductForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
