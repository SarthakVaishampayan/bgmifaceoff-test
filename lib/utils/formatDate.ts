const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Format: "Sat, 29 Aug"
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  const dayName = DAYS[d.getDay()]
  const dayNum = d.getDate()
  const monthName = MONTHS[d.getMonth()]
  return `${dayName}, ${dayNum} ${monthName}`
}

/**
 * Format: "29 Aug"
 */
export function formatMonthDay(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  const dayNum = d.getDate()
  const monthName = MONTHS[d.getMonth()]
  return `${dayNum} ${monthName}`
}

/**
 * Format: "Sat, 29 Aug 2026"
 */
export function formatFullDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  const dayName = DAYS[d.getDay()]
  const dayNum = d.getDate()
  const monthName = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  return `${dayName}, ${dayNum} ${monthName} ${year}`
}

/**
 * Format: "Monday, 29 Aug 2026"
 */
export function formatFullLongDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  const dayName = LONG_DAYS[d.getDay()]
  const dayNum = d.getDate()
  const monthName = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  return `${dayName}, ${dayNum} ${monthName} ${year}`
}

/**
 * Format: "29/08/2026"
 */
export function formatNumericDate(dateStr: string): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const parts = Object.fromEntries(formatter.formatToParts(d).map(p => [p.type, p.value]))
    return `${parts.day}/${parts.month}/${parts.year}`
  } catch (e) {
    const dayNum = String(d.getDate()).padStart(2, '0')
    const monthNum = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${dayNum}/${monthNum}/${year}`
  }
}

/**
 * Format: "8:05:12 PM" or "8:05 PM" in Indian Standard Time (Asia/Kolkata)
 */
export function formatTime(dateStr: string, includeSeconds: boolean = true): string {
  if (!dateStr) return ''
  // If dateStr has no time component (e.g. "2026-09-24"), there is no time to format
  if (!dateStr.includes('T') && !dateStr.includes(':') && !dateStr.includes(' ')) {
    return ''
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: true,
    })
    return formatter.format(d)
  } catch (e) {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: true,
    })
  }
}

/**
 * Format: "29/08/2026, 8:05:12 PM" in Indian Standard Time (Asia/Kolkata)
 */
export function formatNumericDateTime(dateStr: string, includeSeconds: boolean = true): string {
  if (!dateStr) return ''
  const datePart = formatNumericDate(dateStr)
  const timePart = formatTime(dateStr, includeSeconds)
  if (!timePart) return datePart
  return `${datePart}, ${timePart}`
}
