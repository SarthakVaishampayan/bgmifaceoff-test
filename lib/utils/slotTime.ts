/**
 * Helper utility to determine if a tournament match slot has already passed/ended or closed for booking.
 * Takes slot.date ("YYYY-MM-DD") and slot.time_label (e.g. "1:00 PM – 3:00 PM", "9:00 PM – 11:00 PM").
 * 
 * CORE BUSINESS LOGIC:
 * The slot automatically closes 10 minutes before the starting time of the slot
 * if the admin has not manually closed it.
 */

/**
 * Extract time parts in Indian Standard Time (Asia/Kolkata, UTC+5:30)
 * Works consistently across browser, local machine, and cloud servers (Vercel/Node).
 */
export function getISTParts(d: Date = new Date()): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  dateStr: string
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = Object.fromEntries(formatter.formatToParts(d).map(p => [p.type, p.value]))
    const rawHour = parseInt(parts.hour, 10)
    const hour = rawHour === 24 ? 0 : rawHour
    return {
      year: parseInt(parts.year, 10),
      month: parseInt(parts.month, 10),
      day: parseInt(parts.day, 10),
      hour,
      minute: parseInt(parts.minute, 10),
      second: parseInt(parts.second, 10),
      dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    }
  } catch (e) {
    const utcEpoch = d.getTime() + (d.getTimezoneOffset() * 60000)
    const ist = new Date(utcEpoch + 5.5 * 60 * 60 * 1000)
    const year = ist.getFullYear()
    const month = String(ist.getMonth() + 1).padStart(2, '0')
    const day = String(ist.getDate()).padStart(2, '0')
    return {
      year,
      month: ist.getMonth() + 1,
      day: ist.getDate(),
      hour: ist.getHours(),
      minute: ist.getMinutes(),
      second: ist.getSeconds(),
      dateStr: `${year}-${month}-${day}`,
    }
  }
}

/**
 * Extracts the starting time of the slot window in minutes from midnight (0 to 1439).
 * E.g.:
 * - "1:00 PM – 3:00 PM" -> 13 * 60 + 0 = 780 (1:00 PM)
 * - "9:00 PM – 11:00 PM" -> 21 * 60 + 0 = 1260 (9:00 PM)
 * - "11:00 AM – 1:00 PM" -> 11 * 60 + 0 = 660 (11:00 AM)
 * - "4:00 PM – 6:00 PM (M1: 4:12 PM...)" -> 16 * 60 + 0 = 960 (4:00 PM)
 */
export function getSlotStartMinutes(timeLabelStr: string): number {
  if (!timeLabelStr) return 21 * 60 // Default 9:00 PM

  // Take the starting portion before the dash/range separator
  const windowStartPart = timeLabelStr.split(/[-–—]/)[0]?.trim() || timeLabelStr
  const match =
    windowStartPart.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i) ||
    timeLabelStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i)

  if (!match) return 21 * 60

  let hours = parseInt(match[1], 10)
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const meridian = match[3].toUpperCase()

  if (meridian === 'PM' && hours < 12) {
    hours += 12
  } else if (meridian === 'AM' && hours === 12) {
    hours = 0
  }

  return hours * 60 + minutes
}

/**
 * Backward compatibility helper for match list time cards.
 */
export function getFirstMatchStartMinutes(timeLabelStr: string): number {
  if (!timeLabelStr) return 21 * 60 + 12

  const match1Regex = /(?:match\s*1|m1)\D*(\d{1,2}):?(\d{2})?\s*(AM|PM)/i
  const match1Hit = timeLabelStr.match(match1Regex)

  if (match1Hit) {
    let hours = parseInt(match1Hit[1], 10)
    const minutes = match1Hit[2] ? parseInt(match1Hit[2], 10) : 0
    const meridian = match1Hit[3].toUpperCase()

    if (meridian === 'PM' && hours < 12) {
      hours += 12
    } else if (meridian === 'AM' && hours === 12) {
      hours = 0
    }
    return hours * 60 + minutes
  }

  // Otherwise, default Match 1 is 12 minutes after slot start time
  return getSlotStartMinutes(timeLabelStr) + 12
}

/**
 * Checks if a slot is closed or past.
 * Logic:
 * 1. If admin marked as 'completed' or 'closed' -> closed.
 * 2. If slot date is earlier than today in IST -> closed.
 * 3. If slot date is later than today in IST -> not closed.
 * 4. If slot date is today:
 *    The slot AUTOMATICALLY CLOSES 10 minutes before the starting time of the slot.
 *    (e.g., for a 1:00 PM slot, cutoff is 12:50 PM; at 12:50 PM or later, it is closed).
 */
export function isSlotPastOrEnded(
  dateStr: string,
  timeLabelStr: string,
  status?: string
): boolean {
  // If explicitly marked completed or closed by admin in DB
  if (status === 'completed' || status === 'closed') return true

  if (!dateStr) return false

  const ist = getISTParts()
  const cleanSlotDate = String(dateStr).split('T')[0].trim()

  if (cleanSlotDate < ist.dateStr) {
    return true // Prior date is already ended
  }

  if (cleanSlotDate > ist.dateStr) {
    return false // Future date
  }

  // Same day: slot starts at slotStartMinutes
  const slotStartMinutes = getSlotStartMinutes(timeLabelStr)
  const currentMinutes = ist.hour * 60 + ist.minute

  // Cutoff is strictly 10 minutes BEFORE the slot starting time
  const cutoffMinutes = slotStartMinutes - 10

  return currentMinutes >= cutoffMinutes
}

export const isSlotRegistrationClosed = isSlotPastOrEnded
