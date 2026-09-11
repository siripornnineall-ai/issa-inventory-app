"use client";

import { useStore } from "@/lib/store";
import type { AppUser } from "@/lib/types";
import { hasPermission, canViewCost, type Permission } from "./permissions";

export function useCurrentUser(): AppUser | null {
  return useStore((s) => (s.currentUserId ? s.users[s.currentUserId] ?? null : null));
}

export function useCan(perm: Permission): boolean {
  const user = useCurrentUser();
  return hasPermission(user?.role, perm);
}

export function useCanViewCost(): boolean {
  const user = useCurrentUser();
  return canViewCost(user?.role, user?.canViewCost);
}
