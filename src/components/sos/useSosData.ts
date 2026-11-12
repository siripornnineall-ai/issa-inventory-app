"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadSosOverview, type SosOverview } from "@/lib/supabase/sos";

const EMPTY: SosOverview = { branches: [], imports: [], summaries: [], feedback: [], codeMap: {} };

// โหลดข้อมูลภาพรวมของหน้า SOS (ดึงตอนเปิดหน้า ไม่เก็บใน state หลักของแอป) finance = ผู้มีสิทธิ์ดูรายงาน (ดูตัวเลขการเงินได้)
export function useSosData(finance: boolean) {
  const [data, setData] = useState<SosOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await loadSosOverview(createClient(), { finance });
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [finance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดข้อมูลตอนเปิดหน้า
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
