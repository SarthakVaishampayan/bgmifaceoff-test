import RegisterClient from './RegisterClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account | BGFS',
  description: 'Register your team for Battlegrounds Faceoff Series.',
}

export default function RegisterPage() {
  return <RegisterClient />
}
