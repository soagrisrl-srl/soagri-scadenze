import type { User } from "@/types";

export type Permission = "events.create" | "events.manage" | "users.manage";
export function can(user: Pick<User,"role"|"active"|"canManageEvents"> | null | undefined, permission: Permission): boolean {
  if (!user?.active) return false;
  if (permission === "users.manage") return user.role === "ADMIN";
  return user.role === "ADMIN" || user.canManageEvents;
}
