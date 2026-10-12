"use client";

import { useStore } from "@/lib/store";
import type { AppUser } from "@/lib/types";
import { hasPermission, canViewCost, type Permission } from "./permissions";

export function useCurrentUser(): AppUser | null {
  return useStore((s) => (s.currentUserId ? s.users[s.currentUserId] ?? null : null));
}

export function useCan(perm: Permission): boolean {
  const user = useCurrentUser();
  const matrix = useStore((s) => s.rolePermissions);
  return hasPermission(user?.role, perm, matrix);
}

export function useCanViewCost(): boolean {
  const user = useCurrentUser();
  const matrix = useStore((s) => s.rolePermissions);
  return canViewCost(user?.role, user?.canViewCost, matrix);
}
