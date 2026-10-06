"use client";

import { equipmentLabel } from "@/lib/utils/equipmentLabel";
import { useMemo, useState } from "react";
import { ClipboardList, Plus, Check, X, Ban } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, KpiCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, Textarea, FormField } from "@/components/ui/Field";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequisitionStatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { RequisitionDialog } from "@/components/equipment/RequisitionDialog";
import { useStore, useActions } from "@/lib/store";
import { useCan, useCurrentUser } from "@/lib/auth/session";
import { formatThaiDateTime } from "@/lib/utils/date";
import { toastError, toastSuccess } from "@/lib/toast";
import { REQUISITION_STATUS_LABEL_TH, type EquipmentRequisition, type RequisitionStatus } from "@/lib/types";

export default function RequisitionsPage() {
  const state = useStore();
  const user = useCurrentUser();
  const canApprove = useCan("requisition.approve");
  const canCreate = useCan("requisition.create");
  const { approveRequisition, rejectRequisition, cancelRequisition } = useActions();

  const allRequisitions = Object.values(state.equipmentRequisitions);
  const requisitions = useMemo(() => {
    const visible = canApprove ? allRequisitions : allRequisitions.filter((r) => r.requesterId === user?.id);
    return visible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allRequisitions, canApprove, user?.id]);

  const [status, setStatus] = useState<RequisitionStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [rejecting, setRejecting] = useState<EquipmentRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = status === "all" ? requisitions : requisitions.filter((r) => r.status === status);
  const pendingCount = requisitions.filter((r) => r.status === "pending").length;
  const approvedCount = requisitions.filter((r) => r.status === "approved" || r.status === "fulfilled").length;
  const rejectedCount = requisitions.filter((r) => r.status === "rejected").length;

  function handleApprove(id: string) {
    if (!user) return;
    setSaving(true);
    try {
      approveRequisition(id, user.id, user.name);
      toastSuccess("อนุมัติคำขอเบิกเรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
      setApprovingId(null);
    }
  }

  function handleReject() {
    if (!user || !rejecting) return;
    if (!rejectReason.trim()) {
      toastError("กรุณาระบุเหตุผลที่ปฏิเสธ");
      return;
    }
    setSaving(true);
    try {
      rejectRequisition(rejecting.id, user.id, user.name, rejectReason.trim());
      toastSuccess("ปฏิเสธคำขอเบิกเรียบร้อยแล้ว");
      setRejecting(null);
      setRejectReason("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(id: string) {
    setSaving(true);
    try {
      cancelRequisition(id);
      toastSuccess("ยกเลิกคำขอเบิกเรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
      setCancelingId(null);
    }
  }

  return (
    <>
      <Header
        title="คำขอเบิกอุปกรณ์"
        description={canApprove ? "ตรวจสอบและอนุมัติคำขอเบิกอุปกรณ์ทั้งหมด" : "คำขอเบิกอุปกรณ์ของฉัน"}
        actions={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> สร้างคำขอเบิก
            </Button>
          )
        }
      />
      <PageContainer>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
          <KpiCard label="รออนุมัติ" value={<span className="text-[var(--color-warning)]">{pendingCount}</span>} unit="รายการ" />
          <KpiCard label="อนุมัติแล้ว / เบิกแล้ว" value={<span className="text-[var(--color-success)]">{approvedCount}</span>} unit="รายการ" />
          <KpiCard label="ปฏิเสธ" value={<span className="text-[var(--color-danger)]">{rejectedCount}</span>} unit="รายการ" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value as RequisitionStatus | "all")} className="w-56">
            <option value="all">สถานะทั้งหมด</option>
            {Object.entries(REQUISITION_STATUS_LABEL_TH).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <Card>
          {filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="ไม่พบคำขอเบิกอุปกรณ์" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {filtered.map((r) => {
                  const equipment = state.equipment[r.equipmentId];
                  return (
                    <div key={r.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-[var(--color-on-surface-variant)]">{r.reqNo}</p>
                          <p className="truncate text-sm font-medium">{equipment ? equipmentLabel(equipment) : "-"}</p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">
                            {r.qtyRequested} {equipment?.unit} · {r.requesterName}
                            {r.department ? ` (${r.department})` : ""}
                          </p>
                          <p className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(r.createdAt)}</p>
                        </div>
                        <RequisitionStatusBadge status={r.status} />
                      </div>
                      {r.reason && <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">เหตุผลขอเบิก: {r.reason}</p>}
                      {r.approverName && (
                        <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                          โดย {r.approverName}
                          {r.decidedAt && ` · ${formatThaiDateTime(r.decidedAt)}`}
                        </p>
                      )}
                      {r.rejectReason && <p className="text-xs text-[var(--color-danger)]">เหตุผลปฏิเสธ: {r.rejectReason}</p>}
                      {((canApprove && r.status === "pending") || (!canApprove && r.status === "pending" && r.requesterId === user?.id)) && (
                        <div className="mt-2 flex justify-end gap-3">
                          {canApprove && r.status === "pending" && (
                            <>
                              <button onClick={() => setApprovingId(r.id)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                                <Check className="h-3.5 w-3.5" /> อนุมัติ
                              </button>
                              <button onClick={() => setRejecting(r)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
                                <X className="h-3.5 w-3.5" /> ปฏิเสธ
                              </button>
                            </>
                          )}
                          {!canApprove && r.status === "pending" && r.requesterId === user?.id && (
                            <button onClick={() => setCancelingId(r.id)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-on-surface-variant)]">
                              <Ban className="h-3.5 w-3.5" /> ยกเลิกคำขอ
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
              <Table>
              <Thead>
                <Tr>
                  <Th>เลขที่คำขอ</Th>
                  <Th>ผู้ขอเบิก</Th>
                  <Th>อุปกรณ์</Th>
                  <Th>จำนวน</Th>
                  <Th>วันที่ขอ</Th>
                  <Th>สถานะ</Th>
                  <Th>ผู้อนุมัติ/เหตุผล</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((r) => {
                  const equipment = state.equipment[r.equipmentId];
                  return (
                    <Tr key={r.id}>
                      <Td className="font-mono text-xs">{r.reqNo}</Td>
                      <Td>
                        {r.requesterName}
                        {r.department && <span className="block text-xs text-[var(--color-on-surface-variant)]">{r.department}</span>}
                      </Td>
                      <Td>
                        {equipment ? equipmentLabel(equipment) : "-"}
                        {r.reason && <span className="block text-xs text-[var(--color-on-surface-variant)]">{r.reason}</span>}
                      </Td>
                      <Td>
                        {r.qtyRequested} {equipment?.unit}
                      </Td>
                      <Td className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDateTime(r.createdAt)}</Td>
                      <Td>
                        <RequisitionStatusBadge status={r.status} />
                      </Td>
                      <Td className="text-xs text-[var(--color-on-surface-variant)]">
                        {r.approverName && (
                          <>
                            {r.approverName}
                            {r.decidedAt && <span className="block">{formatThaiDateTime(r.decidedAt)}</span>}
                          </>
                        )}
                        {r.rejectReason && <span className="block text-[var(--color-danger)]">เหตุผล: {r.rejectReason}</span>}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          {canApprove && r.status === "pending" && (
                            <>
                              <button
                                onClick={() => setApprovingId(r.id)}
                                className="text-[var(--color-success)] hover:opacity-70"
                                title="อนุมัติ"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setRejecting(r)}
                                className="text-[var(--color-danger)] hover:opacity-70"
                                title="ปฏิเสธ"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {!canApprove && r.status === "pending" && r.requesterId === user?.id && (
                            <button
                              onClick={() => setCancelingId(r.id)}
                              className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
                              title="ยกเลิกคำขอ"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
              </div>
            </>
          )}
        </Card>
      </PageContainer>

      <RequisitionDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={Boolean(approvingId)}
        onClose={() => setApprovingId(null)}
        title="อนุมัติคำขอเบิกนี้?"
        description="ระบบจะตัดสต็อกอุปกรณ์ทันทีเมื่ออนุมัติ"
        confirmLabel="อนุมัติ"
        loading={saving}
        onConfirm={() => approvingId && handleApprove(approvingId)}
      />

      <ConfirmDialog
        open={Boolean(cancelingId)}
        onClose={() => setCancelingId(null)}
        danger
        title="ยกเลิกคำขอเบิกนี้?"
        confirmLabel="ยกเลิกคำขอ"
        loading={saving}
        onConfirm={() => cancelingId && handleCancel(cancelingId)}
      />

      <Dialog
        open={Boolean(rejecting)}
        onClose={() => {
          setRejecting(null);
          setRejectReason("");
        }}
        title="ปฏิเสธคำขอเบิกอุปกรณ์"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={handleReject} loading={saving}>
              ยืนยันปฏิเสธ
            </Button>
          </>
        }
      >
        <FormField label="เหตุผลที่ปฏิเสธ" required>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="ระบุเหตุผลที่ปฏิเสธคำขอนี้..." />
        </FormField>
      </Dialog>
    </>
  );
}
