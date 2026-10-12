"use client";

import { Fragment, useState } from "react";
import { Lock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { useStore, useActions } from "@/lib/store";
import { ADMIN_ONLY_PERMISSIONS, PERMISSION_GROUPS, ROLES, type Permission } from "@/lib/auth/permissions";
import { toastError, toastSuccess } from "@/lib/toast";
import { ROLE_LABEL_TH, type UserRole } from "@/lib/types";

// ตารางกำหนดสิทธิ์ตามตำแหน่ง: แถว = สิทธิ์ คอลัมน์ = ตำแหน่ง ติ๊กเพื่อให้สิทธิ์ ผลมีทันทีและมีผลกับฐานข้อมูลด้วย (ไม่ใช่แค่ซ่อนปุ่ม)
// ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอ (ล็อกไว้ กันตั้งผิดแล้วเข้าระบบไม่ได้)
export function PermissionsMatrix() {
  const rolePermissions = useStore((s) => s.rolePermissions);
  const { setRolePermission, resetRolePermissions } = useActions();
  const [resetRole, setResetRole] = useState<UserRole | null>(null);

  function toggle(role: UserRole, perm: Permission, allowed: boolean) {
    try {
      setRolePermission(role, perm, allowed);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>สิทธิ์ตามตำแหน่ง</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          ติ๊กเพื่อกำหนดว่าแต่ละตำแหน่งทำอะไรและเข้าหน้าไหนได้ ผลมีทันที คนที่ใช้งานอยู่ต้องรีเฟรชหรือเปิดแอปใหม่ถึงจะเห็นการเปลี่ยนแปลง
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="rounded-xl bg-[var(--color-info-container)] px-3 py-2 text-xs text-[var(--color-info)]">
          สิทธิ์ &quot;เข้าถึงหน้า&quot; ซ่อนเมนูและกันเข้าหน้านั้นบนแอป ส่วนสิทธิ์ทำรายการ (เพิ่ม แก้ไข รับเข้า เบิกออก ฯลฯ) ฐานข้อมูลตรวจซ้ำให้ด้วย ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอและแก้ไม่ได้
        </p>
        <Table>
          <Thead>
            <Tr>
              <Th>สิทธิ์</Th>
              {ROLES.map((r) => (
                <Th key={r} className="text-center normal-case">
                  {ROLE_LABEL_TH[r]}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.title}>
                <Tr className="bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-container)]">
                  <Td colSpan={ROLES.length + 1} className="py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
                    {group.title}
                  </Td>
                </Tr>
                {group.items.map((item) => {
                  const adminOnly = ADMIN_ONLY_PERMISSIONS.includes(item.perm);
                  return (
                    <Tr key={item.perm}>
                      <Td className="py-2.5">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.hint && <p className="text-xs text-[var(--color-on-surface-variant)]">{item.hint}</p>}
                      </Td>
                      {ROLES.map((role) => {
                        const locked = role === "admin" || adminOnly;
                        const checked = role === "admin" || (rolePermissions[role] ?? []).includes(item.perm);
                        return (
                          <Td key={role} className="py-2.5 text-center">
                            {locked ? (
                              <span className="inline-flex items-center justify-center gap-1 text-xs text-[var(--color-on-surface-variant)]" title={role === "admin" ? "ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอ" : "ให้ได้เฉพาะผู้ดูแลระบบ"}>
                                {checked ? "✓" : <Lock className="h-3.5 w-3.5" />}
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggle(role, item.perm, e.target.checked)}
                                aria-label={`${ROLE_LABEL_TH[role]}: ${item.label}`}
                                className="h-4 w-4 cursor-pointer"
                              />
                            )}
                          </Td>
                        );
                      })}
                    </Tr>
                  );
                })}
              </Fragment>
            ))}
          </Tbody>
        </Table>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-on-surface-variant)]">คืนค่าเริ่มต้นของตำแหน่ง:</span>
          {ROLES.filter((r) => r !== "admin").map((r) => (
            <Button key={r} type="button" size="sm" variant="secondary" onClick={() => setResetRole(r)}>
              <RotateCcw className="h-3.5 w-3.5" /> {ROLE_LABEL_TH[r]}
            </Button>
          ))}
        </div>
      </CardContent>

      <ConfirmDialog
        open={resetRole !== null}
        onClose={() => setResetRole(null)}
        title={`คืนค่าเริ่มต้นของ "${resetRole ? ROLE_LABEL_TH[resetRole] : ""}"?`}
        description="สิทธิ์ทั้งหมดของตำแหน่งนี้จะกลับไปเป็นค่าตั้งต้นของระบบ"
        onConfirm={() => {
          if (!resetRole) return;
          try {
            resetRolePermissions(resetRole);
            toastSuccess("คืนค่าเริ่มต้นเรียบร้อยแล้ว");
          } catch (e) {
            toastError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
          } finally {
            setResetRole(null);
          }
        }}
      />
    </Card>
  );
}
