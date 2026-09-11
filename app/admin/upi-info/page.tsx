import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminUpiInfoRedirectPage() {
  redirect('/admin?tab=upi_info')
}
