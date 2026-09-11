'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

export default function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin') || pathname.startsWith('/maintenance')) return null
  return <Footer />
}
