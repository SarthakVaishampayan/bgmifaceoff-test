import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminPendingBookingsRedirectPage() {
  redirect('/admin?tab=pending_bookings')
}
