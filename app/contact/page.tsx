export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  title: 'Contact Us — BGFS',
  description: 'Get in touch with the Battlegrounds Faceoff Series team for support, payment issues, or general queries.',
}

export default async function ContactPage() {
  const supabase = await createClient()
  const { data: configRow } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'whatsapp_invite_link')
    .maybeSingle()

  const whatsappLink = configRow?.value || 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'

  return <ContactClient whatsappLink={whatsappLink} />
}
