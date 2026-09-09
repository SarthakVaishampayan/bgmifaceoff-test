/**
 * BGFS Scoring Logic
 * Standard BGIS-style placement points + elimination points
 */

// Position / Placement points lookup
export function getPlacementPoints(placement: number): number {
  if (placement === 1) return 10
  if (placement === 2) return 6
  if (placement === 3) return 5
  if (placement === 4) return 4
  if (placement === 5) return 3
  if (placement >= 6 && placement <= 10) return 2
  if (placement >= 11 && placement <= 15) return 1
  return 0 // 16th–24th
}

export function getPositionPoints(position: number): number {
  return getPlacementPoints(position)
}

export function getKillPoints(kills: number): number {
  return kills // 1 point per elimination
}

export function getTotalPoints(placement: number, kills: number): number {
  return getPositionPoints(placement) + getKillPoints(kills)
}

/**
 * Best 5 Slots calculation: sum of top 5 slot scores (15 matches total)
 */
export function calcBest5Slots(slotScores: number[]): number {
  if (slotScores.length === 0) return 0
  const sorted = [...slotScores].sort((a, b) => b - a)
  return sorted.slice(0, 5).reduce((sum, s) => sum + s, 0)
}

export function calcBest16(scores: number[]): number {
  return calcBest5Slots(scores)
}

/**
 * Slot prize structure (at 18 teams = ₹900 revenue)
 */
export const SLOT_PRIZES = {
  first: 250,   // ₹250 cash
  second: 150,  // ₹150 cash
  third: 'free_slot', // 1 Free Slot Reward
} as const

export const ENTRY_FEE = 50 // ₹50 per slot
export const MAX_TEAMS_PER_SLOT = 24
export const TARGET_TEAMS_PER_SLOT = 18
export const BEST_N_SLOTS = 5
export const BEST_N_MATCHES = 15
