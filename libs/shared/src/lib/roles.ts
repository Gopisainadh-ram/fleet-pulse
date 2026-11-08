export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DRIVER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

// Higher number = more powerful. DRIVER and VIEWER are side roles, not a ladder,
// so they get the same low rank. They never manage anybody anyway.
const RANK: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MANAGER: 2,
  DRIVER: 1,
  VIEWER: 1,
};

/**
 * Can `actor` create or edit an account that has (or will have) the role `target`?
 * Super admins can touch everyone. Everybody else can only manage roles strictly
 * below their own, so an admin can never create another admin or promote themselves.
 */
export function canManageRole(actor: Role, target: Role): boolean {
  if (actor === 'SUPER_ADMIN') return true;
  return RANK[actor] > RANK[target];
}
