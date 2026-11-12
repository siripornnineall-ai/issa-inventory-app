"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadSosLines, type SosSalesLineRow, type SosStockLineRow } from "@/lib/supabase/sos";

// รายการยอดขาย/สต็อกของงวดที่เลือก (ดึงเฉพาะงวดที่ดูอยู่)
export function useSosLines(importIds: string[]) {
  const key = importIds.join(",");
  const [state, setState] = useState<{ key: string; sales: SosSalesLineRow[]; stock: SosStockLineRow[]; error: string | null }>({ key: "", sales: [], stock: [], error: null });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadSosLines(createClient(), key.split(","))
      .then((r) => !cancelled && setState({ key, sales: r.sales, stock: r.stock, error: null }))
      .catch((e) => !cancelled && setState({ key, sales: [], stock: [], error: e instanceof Error ? e.message : "โหลดไม่สำเร็จ" }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const loading = Boolean(key) && state.key !== key;
  return { sales: state.key === key ? state.sales : [], stock: state.key === key ? state.stock : [], loading, error: state.key === key ? state.error : null };
}
