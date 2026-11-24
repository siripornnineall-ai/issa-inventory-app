"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addReturnOption, loadReturnOptions, removeReturnOption, type ReturnCustomOption, type ReturnOptionKind } from "@/lib/supabase/returnOptions";

// เหตุผลที่ลูกค้าคืน/คำที่ลูกค้าพูด ที่เพิ่มเองไว้ (เก็บกลางในฐานข้อมูล ทุกเครื่องเห็นตรงกัน) โหลดไม่ได้ก็ใช้ตัวเลือกของระบบไปตามเดิม
export function useReturnOptions() {
  const [options, setOptions] = useState<ReturnCustomOption[]>([]);

  useEffect(() => {
    let alive = true;
    loadReturnOptions(createClient())
      .then((o) => alive && setOptions(o))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback(async (kind: ReturnOptionKind, label: string, user: { id: string; name: string }) => {
    const created = await addReturnOption(createClient(), kind, label, user);
    setOptions((prev) => [...prev, created]);
    return created;
  }, []);

  const remove = useCallback(async (id: string) => {
    await removeReturnOption(createClient(), id);
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }, []);

  return {
    reasons: options.filter((o) => o.kind === "reason"),
    tags: options.filter((o) => o.kind === "tag"),
    add,
    remove,
  };
}

export type ReturnOptionsApi = ReturnType<typeof useReturnOptions>;
