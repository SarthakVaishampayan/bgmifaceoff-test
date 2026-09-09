import type { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  title: 'Contact Us — BGFS',
  description: 'Get in touch with the Battlegrounds Faceoff Series team for support, payment issues, or general queries.',
}

export default function ContactPage() {
  return <ContactClient />
}
