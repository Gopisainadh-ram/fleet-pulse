import { Role } from './roles';

/**
 * The permission table. Every protected route in the API and every button in the
 * UI asks this table, so changing access for a role means changing ONE line here.
 *
 * Anything that isn't listed is denied.
 */
export const PERMISSIONS = {
  'dashboard:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'],

  'vehicle:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'],
  'vehicle:write': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'vehicle:assign': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'vehicle:delete': ['SUPER_ADMIN', 'ADMIN'],

  'driver:read': ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'],
  'driver:write': ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  'driver:delete': ['SUPER_ADMIN', 'ADMIN'],

  'user:read': ['SUPER_ADMIN', 'ADMIN'],
  'user:write': ['SUPER_ADMIN', 'ADMIN'],

  // A driver looking at their own profile and their own vehicle
  'self:read': ['DRIVER'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
