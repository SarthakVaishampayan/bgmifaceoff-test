/**
 * Helper utility to determine if a tournament match slot has already passed/ended or closed for booking.
 * Takes slot.date ("YYYY-MM-DD") and slot.time_label (e.g. "1:00 PM – 3:00 PM", "Match 1: 1:12 PM").
 * Booking CLOSES automatically 15 minutes BEFORE Match 1 start time.
 */
export function getFirstMatchStartMinutes(timeLabelStr: string): number {
  if (!timeLabelStr) return 21 * 60 + 12 // Default 9:12 PM

  // 1. Check if explicit Match 1 / M1 start time is specified in time_label
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

  // 2. Otherwise parse slot window start time and add 12 minutes offset for Match 1
  const timeMatch = timeLabelStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i)
  if (!timeMatch) return 21 * 60 + 12

  let hours = parseInt(timeMatch[1], 10)
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
  const meridian = timeMatch[3].toUpperCase()

  if (meridian === 'PM' && hours < 12) {
    hours += 12
  } else if (meridian === 'AM' && hours === 12) {
    hours = 0
  }

  // Default Match 1 starts 12 minutes into the 2-hour slot window (e.g. 1:12 PM for 1-3 PM slot)
  return hours * 60 + minutes + 12
}

export function isSlotPastOrEnded(
  dateStr: string,
  timeLabelStr: string,
  status?: string
): boolean {
  // If explicitly marked completed or closed in DB
  if (status === 'completed' || status === 'closed') return true

  if (!dateStr) return false

  const now = new Date()

  // Format today's date in local YYYY-MM-DD
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`

  // Clean slot date (handle YYYY-MM-DD or YYYY-MM-DDT00:00:00)
  const cleanSlotDate = String(dateStr).split('T')[0].trim()

  if (cleanSlotDate < todayStr) {
    return true // Slot date is in the past
  }

  if (cleanSlotDate > todayStr) {
    return false // Slot date is in the future
  }

  // Same day: Calculate 15 minutes cutoff BEFORE Match 1 start time
  const match1StartMinutes = getFirstMatchStartMinutes(timeLabelStr)
  const hours = Math.floor(match1StartMinutes / 60)
  const minutes = match1StartMinutes % 60

  const match1DateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)

  // Booking closes exactly 15 minutes BEFORE Match 1 start time
  const bookingCutoffTime = new Date(match1DateTime.getTime() - 15 * 60 * 1000)

  return now > bookingCutoffTime
}
