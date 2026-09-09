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
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  const dayNum = String(d.getDate()).padStart(2, '0')
  const monthNum = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${dayNum}/${monthNum}/${year}`
}
