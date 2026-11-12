"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Tabs } from "@/components/ui/Tabs";
import { useCan } from "@/lib/auth/session";
import { useSosData } from "@/components/sos/useSosData";
import { ProfitTab } from "@/components/sos/ProfitTab";
import { StockTab } from "@/components/sos/StockTab";
import { AdviceTab } from "@/components/sos/AdviceTab";
import { FeedbackTab } from "@/components/sos/FeedbackTab";
import { ImportTab } from "@/components/sos/ImportTab";

// สาขาหน้าร้าน SOS (ฝากขายที่ SOS Sense Of Style): ข้อมูลมาจากไฟล์รายงานที่ดาวน์โหลดจาก SOS แยกจากสต็อกคลังหลักทั้งหมด
// ตัวเลขการเงิน (กำไร ค่าเช่า ยอดขาย) เห็นเฉพาะผู้มีสิทธิ์ดูรายงาน ส่วน Feedback ทีมขายกรอกได้
function SosContent() {
  const finance = useCan("report.view");
  const { data, loading, error, reload } = useSosData(finance);
  const tabs = [
    ...(finance
      ? [
          { id: "profit", label: "ต้นทุนและกำไร" },
          { id: "stock", label: "สต็อกสาขา" },
          { id: "advice", label: "แนะนำ SKU" },
        ]
      : []),
    { id: "feedback", label: `Feedback (${data.feedback.length})` },
    ...(finance ? [{ id: "import", label: "นำเข้าไฟล์" }] : []),
  ];
  const [tab, setTab] = useState("");
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={tabs} active={active} onChange={setTab} />
      {error && (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-container)] px-3 py-2 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </p>
      )}
      {loading && !error && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
      {!loading && active === "profit" && <ProfitTab branches={data.branches} imports={data.imports} summaries={data.summaries} onChanged={reload} />}
      {!loading && active === "stock" && <StockTab branches={data.branches} imports={data.imports} />}
      {!loading && active === "advice" && <AdviceTab branches={data.branches} imports={data.imports} feedback={data.feedback} />}
      {!loading && active === "feedback" && <FeedbackTab branches={data.branches} feedback={data.feedback} onChanged={reload} />}
      {active === "import" && <ImportTab branches={data.branches} imports={data.imports} codeMap={data.codeMap} onChanged={reload} />}
    </div>
  );
}

export default function SosPage() {
  return (
    <>
      <Header title="สาขาหน้าร้าน SOS" description="ต้นทุน กำไร สต็อก และข้อเสนอแนะ SKU ของสาขาที่ SOS Sense Of Style (นำเข้าจากไฟล์รายงานของ SOS)" />
      <PageContainer className="max-w-6xl">
        <RequireAccess perm="view.products">
          <SosContent />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
