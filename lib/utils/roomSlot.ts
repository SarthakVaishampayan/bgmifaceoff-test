import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Finds the first unoccupied room slot number for a match slot, starting from Slot 5.
 * Fills any gaps left by migrations or cancellations, preventing duplicate room slot numbers.
 *
 * @param supabase - Supabase client (service role admin client recommended)
 * @param slotId - The ID of the match slot
 * @param excludeTeamId - Optional team ID to exclude (e.g. if updating an existing team)
 * @returns The next available room slot number (5, 6, 7, ...)
 */
export async function getNextAvailableRoomSlot(
  supabase: SupabaseClient<any, any, any>,
  slotId: string,
  excludeTeamId?: string
): Promise<number> {
  let query = supabase
    .from('bookings')
    .select('room_slot_number')
    .eq('slot_id', slotId)
    .eq('payment_status', 'paid')

  if (excludeTeamId) {
    query = query.neq('team_id', excludeTeamId)
  }

  const { data: bookings, error } = await query

  if (error) {
    console.error('Error fetching occupied room slots:', error)
  }

  const occupied = new Set<number>()
  if (bookings) {
    for (const b of bookings) {
      if (typeof b.room_slot_number === 'number' && b.room_slot_number >= 5) {
        occupied.add(b.room_slot_number)
      }
    }
  }

  let nextSlot = 5
  while (occupied.has(nextSlot)) {
    nextSlot++
  }

  return nextSlot
}
