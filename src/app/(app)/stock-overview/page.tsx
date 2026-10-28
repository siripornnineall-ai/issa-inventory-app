"use client";

import { useState, useSyncExternalStore } from "react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrentStockTab } from "@/components/stock/CurrentStockTab";
import { RecountTab } from "@/components/stock/RecountTab";
import { SalesTab } from "@/components/stock/SalesTab";

const TABS = [
  { id: "current", label: "สต็อกปัจจุบัน", description: "จำนวนคงเหลือของแต่ละรุ่น แยกตามสีและไซซ์" },
  { id: "sales", label: "ยอดขาย", description: "ยอดขายสุทธิรายเดือนแยกตามรุ่น สี และไซซ์ (จำนวนชิ้น)" },
  { id: "recount", label: "สต็อกนับใหม่", description: "ผลนับสต็อกรายเดือน เทียบกับยอดในระบบก่อนนับและสต็อกปัจจุบัน" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const isTabId = (v: string | null): v is TabId => TABS.some((t) => t.id === v);

// แท็บที่เปิดอยู่เก็บใน URL (?tab=sales) เพื่อส่งลิงก์ตรงแท็บได้ ฝั่งเซิร์ฟเวอร์เรนเดอร์แท็บแรกเสมอ แล้วฝั่งเครื่องอ่านจาก URL หลังโหลด
const TAB_EVENT = "stock-overview-tab";

function subscribeTab(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(TAB_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(TAB_EVENT, onChange);
  };
}

function readTab(): TabId {
  const t = new URLSearchParams(window.location.search).get("tab");
  return isTabId(t) ? t : "current";
}

export default function StockOverviewPage() {
  const tab = useSyncExternalStore(subscribeTab, readTab, () => "current" as TabId);
  const [brandId, setBrandId] = useState("");

  function selectTab(id: TabId) {
    const url = new URL(window.location.href);
    if (id === "current") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(TAB_EVENT));
  }

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <>
      <Header title="สต็อกภาพรวม" description={active.description} />
      <PageContainer>
        <div role="tablist" aria-label="มุมมองสต็อกภาพรวม" className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`so-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="so-panel"
              onClick={() => selectTab(t.id)}
              className={
                "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
                (tab === t.id ? "bg-[var(--color-primary-container)] text-white" : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="so-panel" role="tabpanel" aria-labelledby={`so-tab-${tab}`} className="flex flex-col gap-6">
          {tab === "current" && <CurrentStockTab brandId={brandId} setBrandId={setBrandId} />}
          {tab === "sales" && <SalesTab brandId={brandId} setBrandId={setBrandId} />}
          {tab === "recount" && <RecountTab brandId={brandId} setBrandId={setBrandId} />}
        </div>
      </PageContainer>
    </>
  );
}
