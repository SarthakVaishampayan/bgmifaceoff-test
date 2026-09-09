import ResetPasswordClient from './ResetPasswordClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset Password | BGFS',
  description: 'Reset your BGFS account password.',
}

export default function ResetPasswordPage() {
  return <ResetPasswordClient />
}
