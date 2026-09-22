"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { RequireAccess } from "@/components/layout/RequireAccess";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { UserDialog } from "@/components/users/UserDialog";
import { useStore, useActions } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { adminDeleteUser } from "@/lib/supabase/adminUsers";
import { toastError, toastSuccess } from "@/lib/toast";
import { ROLE_LABEL_TH, type AppUser } from "@/lib/types";
import { formatThaiDate } from "@/lib/utils/date";

export default function UsersPage() {
  const state = useStore();
  const { upsertUser, removeUser, assertUserRemovable } = useActions();
  const currentUser = useCurrentUser();
  const users = Object.values(state.users).sort((a, b) => a.name.localeCompare(b.name, "th"));
  // เพิ่มผู้ใช้/ลบผู้ใช้ ทำได้เฉพาะผู้ดูแลระบบ (ผู้จัดการมีสิทธิ์ user.manage เข้าหน้านี้ได้ แต่สร้าง/ลบบัญชีไม่ได้) และลบบัญชีตัวเองไม่ได้
  const isAdmin = hasPermission(currentUser?.role, "user.admin");
  const canDelete = isAdmin;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | undefined>(undefined);
  const [deleting, setDeleting] = useState<AppUser | undefined>(undefined);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      assertUserRemovable(deleting.id); // กฎฝั่งแอป (ลบตัวเอง/มีประวัติทำรายการ) — ได้ข้อความชัดเจนก่อนยิงไปเซิร์ฟเวอร์
      await adminDeleteUser(deleting.id); // ลบทั้งข้อมูลผู้ใช้และบัญชีเข้าสู่ระบบ ฝั่งเซิร์ฟเวอร์ตรวจสิทธิ์ admin ซ้ำ
      removeUser(deleting.id);
      toastSuccess(`ลบผู้ใช้งาน "${deleting.name}" เรียบร้อยแล้ว`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setDeleteBusy(false);
      setDeleting(undefined);
    }
  }

  function toggleActive(u: AppUser) {
    if (u.id === currentUser?.id) {
      toastError("ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้");
      return;
    }
    try {
      upsertUser({ id: u.id, active: !u.active });
      toastSuccess(u.active ? "ปิดการใช้งานผู้ใช้งานเรียบร้อยแล้ว" : "เปิดการใช้งานผู้ใช้งานเรียบร้อยแล้ว");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <>
      <Header
        title="ผู้ใช้งานและสิทธิ์"
        description="จัดการรายชื่อผู้ใช้งานและบทบาทสิทธิ์การเข้าถึงระบบ"
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> เพิ่มผู้ใช้งานใหม่
            </Button>
          ) : undefined
        }
      />
      <PageContainer>
        <RequireAccess perm="user.manage">
        <Card>
          {users.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<UsersIcon className="h-10 w-10" />} title="ยังไม่มีผู้ใช้งานในระบบ" />
            </div>
          ) : (
            <>
              {/* การ์ดสำหรับจอมือถือ */}
              <div className="divide-y divide-[var(--color-border)] sm:hidden">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {u.name}
                        {u.id === currentUser?.id && <span className="ml-1.5 text-xs text-[var(--color-on-surface-variant)]">(คุณ)</span>}
                      </p>
                      <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{u.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone="primary">{ROLE_LABEL_TH[u.role]}</Badge>
                        <button onClick={() => toggleActive(u)}>
                          <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "ใช้งานอยู่" : "ปิด"}</Badge>
                        </button>
                        {u.mustChangePassword && <Badge tone="warning">รอตั้งรหัสผ่านใหม่</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => {
                          setEditing(u);
                          setDialogOpen(true);
                        }}
                        aria-label={`แก้ไข ${u.name}`}
                        className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canDelete && u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleting(u)}
                          aria-label={`ลบ ${u.name}`}
                          className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ตารางสำหรับจอกว้าง */}
              <div className="hidden sm:block">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>ชื่อ-นามสกุล</Th>
                      <Th>อีเมล</Th>
                      <Th>บทบาท</Th>
                      <Th>เพิ่มเมื่อ</Th>
                      <Th>สถานะ</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.map((u) => (
                      <Tr key={u.id}>
                        <Td className="font-medium">
                          {u.name}
                          {u.id === currentUser?.id && <span className="ml-2 text-xs text-[var(--color-on-surface-variant)]">(คุณ)</span>}
                        </Td>
                        <Td className="text-xs text-[var(--color-on-surface-variant)]">{u.email}</Td>
                        <Td>
                          <Badge tone="primary">{ROLE_LABEL_TH[u.role]}</Badge>
                        </Td>
                        <Td className="text-xs text-[var(--color-on-surface-variant)]">{formatThaiDate(u.createdAt)}</Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button onClick={() => toggleActive(u)}>
                              <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</Badge>
                            </button>
                            {u.mustChangePassword && <Badge tone="warning">รอตั้งรหัสผ่านใหม่</Badge>}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => {
                                setEditing(u);
                                setDialogOpen(true);
                              }}
                              aria-label={`แก้ไข ${u.name}`}
                              title="แก้ไข"
                              className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary-container)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {canDelete && u.id !== currentUser?.id && (
                              <button
                                onClick={() => setDeleting(u)}
                                aria-label={`ลบ ${u.name}`}
                                title="ลบผู้ใช้งาน"
                                className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-danger)]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
        </Card>
        </RequireAccess>
      </PageContainer>

      <UserDialog open={dialogOpen} onClose={() => setDialogOpen(false)} existing={editing} />

      <ConfirmDialog
        open={deleting !== undefined}
        onClose={() => setDeleting(undefined)}
        danger
        title={`ลบผู้ใช้งาน "${deleting?.name ?? ""}"?`}
        description="บัญชีเข้าสู่ระบบของผู้ใช้งานนี้จะถูกลบถาวรและกู้คืนไม่ได้ หากผู้ใช้งานเคยทำรายการในระบบแล้วจะลบไม่ได้ ให้ปิดการใช้งานแทน"
        confirmLabel="ลบผู้ใช้งาน"
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </>
  );
}
