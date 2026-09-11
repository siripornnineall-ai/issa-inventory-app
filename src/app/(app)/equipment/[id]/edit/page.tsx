"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { EquipmentForm } from "@/components/equipment/EquipmentForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStore } from "@/lib/store";

export default function EditEquipmentPage() {
  const params = useParams<{ id: string }>();
  const equipment = useStore((s) => s.equipment[params.id]);

  return (
    <>
      <Header title="แก้ไขอุปกรณ์" description={equipment ? equipment.name : ""} />
      <PageContainer className="max-w-3xl">
        <RequireAccess perm="equipment.write">
          {equipment ? (
            <EquipmentForm existing={equipment} />
          ) : (
            <EmptyState title="ไม่พบอุปกรณ์นี้ในระบบ" action={<Link href="/equipment"><Button>กลับไปหน้าอุปกรณ์ทั้งหมด</Button></Link>} />
          )}
        </RequireAccess>
      </PageContainer>
    </>
  );
}
