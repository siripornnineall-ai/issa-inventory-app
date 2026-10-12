"use client";

import { Lock } from "lucide-react";
import { ADMIN_ONLY_PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/lib/auth/permissions";
import { ROLE_LABEL_TH, type UserRole } from "@/lib/types";

// ส่วนกำหนดสิทธิ์ของผู้ใช้คนเดียว (ซ่อนไว้ในหน้าแก้ไขผู้ใช้ กดเปิดดูเมื่อต้องการ)
// โหมด "ตามตำแหน่ง" ใช้สิทธิ์มาตรฐานของตำแหน่ง / โหมด "กำหนดเอง" ติ๊กได้ทีละสิทธิ์ (ใช้แทนของตำแหน่งทั้งชุด)
export function UserPermissionsEditor({
  role,
  custom,
  perms,
  roleDefaults,
  onModeChange,
  onToggle,
}: {
  role: UserRole;
  custom: boolean;
  perms: Set<Permission>;
  roleDefaults: Permission[];
  onModeChange: (custom: boolean) => void;
  onToggle: (perm: Permission, allowed: boolean) => void;
}) {
  if (role === "admin") {
    return <p className="text-sm text-[var(--color-on-surface-variant)]">ผู้ดูแลระบบมีสิทธิ์ทุกอย่างเสมอ กำหนดเองไม่ได้</p>;
  }

  const enabledCount = custom ? perms.size : roleDefaults.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="perm-mode" checked={!custom} onChange={() => onModeChange(false)} className="h-4 w-4" />
          ใช้ตามตำแหน่ง ({ROLE_LABEL_TH[role]})
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="perm-mode" checked={custom} onChange={() => onModeChange(true)} className="h-4 w-4" />
          กำหนดสิทธิ์ของคนนี้เอง
        </label>
      </div>
      <p className="text-xs text-[var(--color-on-surface-variant)]">
        {custom ? `กำหนดเอง ${enabledCount} สิทธิ์ — ใช้แทนสิทธิ์ของตำแหน่งทั้งชุด` : `ตามตำแหน่ง ${enabledCount} สิทธิ์`} · กดบันทึกด้านล่างเพื่อใช้งาน
      </p>

      {custom && (
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl border border-[var(--color-border)] p-3">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-[var(--color-on-surface-variant)]">{group.title}</p>
              {group.items.map((item) => {
                const adminOnly = ADMIN_ONLY_PERMISSIONS.includes(item.perm);
                return (
                  <label key={item.perm} className={`flex items-start gap-2 text-sm ${adminOnly ? "opacity-60" : "cursor-pointer"}`}>
                    {adminOnly ? (
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-label="ให้ได้เฉพาะผู้ดูแลระบบ" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={perms.has(item.perm)}
                        onChange={(e) => onToggle(item.perm, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                    )}
                    <span>
                      {item.label}
                      {item.hint && <span className="block text-xs text-[var(--color-on-surface-variant)]">{item.hint}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
