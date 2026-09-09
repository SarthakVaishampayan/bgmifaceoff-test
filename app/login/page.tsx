// This server wrapper prevents pre-rendering (Supabase URL required at runtime)
export const dynamic = 'force-dynamic'

import LoginPage from './LoginPage'

export default function Page() {
  return <LoginPage />
}
