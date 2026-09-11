"use client";

import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { EquipmentForm } from "@/components/equipment/EquipmentForm";

export default function NewEquipmentPage() {
  return (
    <>
      <Header title="เพิ่มอุปกรณ์ใหม่" description="กรอกข้อมูลอุปกรณ์ บรรจุภัณฑ์ หรือของใช้สิ้นเปลืองใหม่" />
      <PageContainer className="max-w-3xl">
        <RequireAccess perm="equipment.write">
          <EquipmentForm />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
