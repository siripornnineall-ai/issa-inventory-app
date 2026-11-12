"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { SCAN_PAGE_LABEL_TH, type ScanOutcome, type ScanPage } from "@/lib/supabase/scanLog";
import { useStore } from "@/lib/store";
import { formatThaiDateTime } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

// ประวัติการสแกน QR: ใครยิงอะไร เมื่อไร ผลเป็นอย่างไร และยิงแล้วถูกบันทึกลงใบหรือยัง
// "ยังไม่ได้บันทึก" = ยิงผ่านแล้วแต่เกินเวลานี้แล้วยังไม่มีเลขที่ใบ (ไม่ได้กดบันทึก / ลบออกจากรายการ / ปิดหน้าก่อนบันทึก)
export const UNSAVED_AFTER_MINUTES = 30;
const PAGE_SIZE = 50;

interface ScanRow {
  id: string;
  scanned_at: string;
  token_code: string | null;
  variant_id: string | null;
  action: "in" | "out";
  page: ScanPage;
  outcome: ScanOutcome;
  reason: string | null;
  actor_id: string;
  actor_name: string;
  saved_doc_no: string | null;
}

type StatusFilter = "all" | "saved" | "unsaved" | "rejected";

export function scanStatus(r: Pick<ScanRow, "outcome" | "saved_doc_no" | "scanned_at">, now = Date.now()): "saved" | "pending" | "unsaved" | "rejected" {
  if (r.outcome !== "ok") return "rejected";
  if (r.saved_doc_no) return "saved";
  return now - new Date(r.scanned_at).getTime() > UNSAVED_AFTER_MINUTES * 60_000 ? "unsaved" : "pending";
}

export function ScanLogTab({ range }: { range: { from: string; to: string } }) {
  const state = useStore();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [actorId, setActorId] = useState("all");
  const [action, setAction] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, saved: 0, unsaved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const users = useMemo(() => Object.values(state.users).filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name, "th")), [state.users]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- เริ่มโหลดข้อมูลใหม่เมื่อตัวกรองเปลี่ยน
    setLoading(true);
    (async () => {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base = (q: any) => {
          let x = q.gte("scanned_at", range.from).lte("scanned_at", range.to);
          if (actorId !== "all") x = x.eq("actor_id", actorId);
          if (action !== "all") x = x.eq("action", action);
          if (search.trim()) x = x.ilike("token_code", `%${search.trim()}%`);
          return x;
        };
        const unsavedBefore = new Date(Date.now() - UNSAVED_AFTER_MINUTES * 60_000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byStatus = (q: any, s: StatusFilter) => {
          if (s === "saved") return q.eq("outcome", "ok").not("saved_doc_no", "is", null);
          if (s === "unsaved") return q.eq("outcome", "ok").is("saved_doc_no", null).lt("scanned_at", unsavedBefore);
          if (s === "rejected") return q.neq("outcome", "ok");
          return q;
        };
        const count = async (s: StatusFilter) => {
          const res = await byStatus(base(supabase.from("scan_log").select("id", { count: "exact", head: true })), s);
          if (res.error) throw res.error;
          return (res.count as number | null) ?? 0;
        };
        const [all, saved, unsaved, rejected] = await Promise.all([count("all"), count("saved"), count("unsaved"), count("rejected")]);
        const list = await byStatus(base(supabase.from("scan_log").select("*")), status)
          .order("scanned_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (list.error) throw list.error;
        if (cancelled) return;
        setCounts({ all, saved, unsaved, rejected });
        setTotal({ all, saved, unsaved, rejected }[status]);
        setRows((list.data ?? []) as ScanRow[]);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, status, actorId, action, search, page]);

  function describe(variantId: string | null): string {
    const v = variantId ? state.variants[variantId] : undefined;
    const p = v ? state.products[v.productId] : undefined;
    return v ? `${p?.sellingName ?? ""} ${v.color} / ${v.size}`.trim() : "ไม่ทราบสินค้า";
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="ค้นหารหัสป้าย (8 ตัว)"
            aria-label="ค้นหารหัสป้าย"
            className="w-56 pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(0); }} aria-label="สถานะ" className="w-52">
          <option value="all">ทุกสถานะ</option>
          <option value="saved">บันทึกลงใบแล้ว</option>
          <option value="unsaved">ยังไม่ได้บันทึก</option>
          <option value="rejected">ถูกปฏิเสธ/สแกนซ้ำ</option>
        </Select>
        <Select value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(0); }} aria-label="ผู้สแกน" className="w-44">
          <option value="all">ทุกคน</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select value={action} onChange={(e) => { setAction(e.target.value as "all" | "in" | "out"); setPage(0); }} aria-label="เข้า/ออก" className="w-40">
          <option value="all">เข้าและออก</option>
          <option value="in">สแกนเข้า</option>
          <option value="out">สแกนออก</option>
        </Select>
      </div>

      <p role="status" className="px-1 text-sm text-[var(--color-on-surface-variant)]">
        <span className="font-semibold text-[var(--color-on-surface)]">ช่วงที่เลือก:</span> สแกน {formatNumber(counts.all)} ครั้ง · บันทึกลงใบแล้ว {formatNumber(counts.saved)} · <span className={counts.unsaved > 0 ? "font-semibold text-[var(--color-danger)]" : ""}>ยังไม่ได้บันทึก {formatNumber(counts.unsaved)}</span> · ถูกปฏิเสธ/ซ้ำ{" "}
        {formatNumber(counts.rejected)} · &quot;ยังไม่ได้บันทึก&quot; = ยิงผ่านแล้วแต่เกิน {UNSAVED_AFTER_MINUTES} นาทีแล้วยังไม่มีเลขที่ใบ (ไม่ได้กดบันทึก หรือลบออกจากรายการ) · เริ่มเก็บตั้งแต่วันที่เปิดใช้งาน ย้อนดูก่อนหน้านั้นไม่ได้
      </p>

      {failed ? (
        <Card className="p-8">
          <EmptyState title="โหลดประวัติการสแกนไม่สำเร็จ" description="ลองรีเฟรชหน้า ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ" />
        </Card>
      ) : !loading && rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="ไม่มีรายการสแกนในช่วงนี้" description="ลองขยายช่วงวันที่ หรือล้างตัวกรอง" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {rows.map((r) => {
              const st = scanStatus(r);
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{describe(r.variant_id)}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                      {formatThaiDateTime(r.scanned_at)} · {r.actor_name} · {SCAN_PAGE_LABEL_TH[r.page]} ({r.action === "in" ? "สแกนเข้า" : "สแกนออก"}) · ป้าย {r.token_code ?? "-"}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {st === "saved" && <Badge tone="success">บันทึกแล้ว</Badge>}
                    {st === "pending" && <Badge tone="info">กำลังทำรายการ</Badge>}
                    {st === "unsaved" && <Badge tone="yellow">ยังไม่ได้บันทึก</Badge>}
                    {st === "rejected" && <Badge tone="danger">{r.outcome === "duplicate" ? "สแกนซ้ำ" : "ถูกปฏิเสธ"}</Badge>}
                    {r.saved_doc_no && <p className="mt-1 font-mono text-xs text-[var(--color-on-surface-variant)]">{r.saved_doc_no}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] p-3 text-sm">
            <span className="text-[var(--color-on-surface-variant)]">
              หน้า {page + 1} / {totalPages} · {formatNumber(total)} รายการ
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>
                ก่อนหน้า
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading}>
                ถัดไป
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
