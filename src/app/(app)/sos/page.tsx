"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Tabs } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Field";
import { useCan } from "@/lib/auth/session";
import { useSosData } from "@/components/sos/useSosData";
import { SummaryTab } from "@/components/sos/SummaryTab";
import { SalesTab } from "@/components/sos/SalesTab";
import { StockTab } from "@/components/sos/StockTab";
import { RankingTab } from "@/components/sos/RankingTab";
import { FeedbackTab } from "@/components/sos/FeedbackTab";
import { ImportTab } from "@/components/sos/ImportTab";
import { periodsOf, selectImports, type PeriodMode } from "@/lib/utils/sosView";
import { formatThaiDate } from "@/lib/utils/date";

// สาขาหน้าร้าน SOS (ฝากขายที่ SOS Sense Of Style): ข้อมูลมาจากไฟล์รายงานที่ดาวน์โหลดจาก SOS แยกจากสต็อกคลังหลักทั้งหมด
// ตัวเลือกด้านบน (สาขา + ช่วงเวลา) ใช้ร่วมทุกแท็บ แต่ละแท็บตอบคำถามเดียว: สรุป / ขายอะไร / มีอะไร / อะไรควรเติม-ถอน / ทีมขายว่าอย่างไร
// ตัวเลขการเงินเห็นเฉพาะผู้มีสิทธิ์ดูรายงาน ส่วน Feedback ทีมขายกรอกได้
function monthLabel(periodStart: string): string {
  return formatThaiDate(periodStart).replace(/^\d+\s*/, "");
}

function SosContent() {
  const finance = useCan("report.view");
  const { data, loading, error, reload } = useSosData(finance);
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState<PeriodMode>("latest");
  const [tab, setTab] = useState("");

  const tabs = [
    ...(finance
      ? [
          { id: "summary", label: "สรุป" },
          { id: "sales", label: "ยอดขาย" },
          { id: "stock", label: "สต็อก" },
          { id: "ranking", label: "จัดอันดับ/แนะนำ" },
        ]
      : []),
    { id: "feedback", label: `Feedback (${data.feedback.length})` },
    ...(finance ? [{ id: "import", label: "นำเข้าไฟล์" }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  const periods = useMemo(() => periodsOf(data.imports), [data.imports]);
  const selectedImports = useMemo(() => selectImports(data.imports, branchId, mode), [data.imports, branchId, mode]);
  const showFilters = finance && active !== "import" && active !== "feedback";

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={tabs} active={active} onChange={setTab} />
      {(showFilters || active === "feedback") && (
        <div className="flex flex-wrap items-center gap-3">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="สาขา" className="w-56">
            <option value="">ทุกสาขา</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {showFilters && (
            <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="ช่วงเวลา" className="w-64">
              <option value="latest">เดือนล่าสุด{periods[0] ? ` (${monthLabel(periods[0])})` : ""}</option>
              <option value="last2">2 เดือนล่าสุด</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  เฉพาะ {monthLabel(p)}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-container)] px-3 py-2 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </p>
      )}
      {loading && !error && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
      {!loading && active === "summary" && <SummaryTab branches={data.branches} selectedImports={selectedImports} summaries={data.summaries} onChanged={reload} />}
      {!loading && active === "sales" && <SalesTab branches={data.branches} selectedImports={selectedImports} />}
      {!loading && active === "stock" && <StockTab branches={data.branches} selectedImports={selectedImports} />}
      {!loading && active === "ranking" && <RankingTab branches={data.branches} allImports={data.imports} mode={mode} branchId={branchId} feedback={data.feedback} />}
      {!loading && active === "feedback" && <FeedbackTab key={branchId} branches={data.branches} feedback={data.feedback} onChanged={reload} selectedBranchId={branchId} />}
      {active === "import" && <ImportTab branches={data.branches} imports={data.imports} codeMap={data.codeMap} onChanged={reload} />}
    </div>
  );
}

export default function SosPage() {
  return (
    <>
      <Header title="สาขาหน้าร้าน SOS" description="ต้นทุน กำไร ยอดขาย สต็อก และข้อเสนอแนะ SKU ของสาขาที่ SOS Sense Of Style (นำเข้าจากไฟล์รายงานของ SOS)" />
      <PageContainer className="max-w-6xl">
        <RequireAccess perm="view.products">
          <SosContent />
        </RequireAccess>
      </PageContainer>
    </>
  );
}
