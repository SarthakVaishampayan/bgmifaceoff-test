/**
 * Battlegrounds Faceoff Series — Immutable Admin Guard
 * 
 * Provides an unchangeable, hardcoded source of truth for Super Admin privileges.
 * This guarantees that even if the database is reset, modified by a script, or
 * has an accidental mutation, the Super Admin will NEVER be demoted or locked out.
 */

export const SUPER_ADMIN_EMAILS: readonly string[] = Object.freeze([
  'admin@gmail.com',
  (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
  (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim(),
].filter(Boolean))

/**
 * Returns true if the provided email belongs to a permanent super admin.
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const clean = email.toLowerCase().trim()
  return SUPER_ADMIN_EMAILS.includes(clean)
}

/**
 * Returns the effective user role.
 * Permanent super admin emails will ALWAYS return 'admin'.
 */
export function getEffectiveRole(
  email?: string | null,
  dbRole?: string | null
): 'admin' | 'admin_scores' | 'captain' | 'player' {
  if (isSuperAdminEmail(email)) return 'admin'
  if (dbRole === 'admin' || dbRole === 'admin_scores' || dbRole === 'captain') {
    return dbRole
  }
  return 'player'
}
