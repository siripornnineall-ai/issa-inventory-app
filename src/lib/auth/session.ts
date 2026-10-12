"use client";

import { useStore } from "@/lib/store";
import type { AppUser } from "@/lib/types";
import { userHasPermission, userCanViewCost, type Permission } from "./permissions";

export function useCurrentUser(): AppUser | null {
  return useStore((s) => (s.currentUserId ? s.users[s.currentUserId] ?? null : null));
}

export function useCan(perm: Permission): boolean {
  const user = useCurrentUser();
  const matrix = useStore((s) => s.rolePermissions);
  return userHasPermission(user, perm, matrix);
}

export function useCanViewCost(): boolean {
  const user = useCurrentUser();
  const matrix = useStore((s) => s.rolePermissions);
  return userCanViewCost(user, matrix);
}
