const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables!')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey)

async function testAndFixBookingsRls() {
  console.log('🔍 Checking users table and bookings table state...')

  // 1. Ensure all users in public.users have non-null team_id
  const { data: users } = await admin.from('users').select('*')
  const { data: teams } = await admin.from('teams').select('*')

  console.log(`Analyzing ${users?.length || 0} users...`)

  if (users && teams) {
    for (const u of users) {
      let team = teams.find(t => t.captain_user_id === u.user_id || t.team_id === u.team_id)
      if (!team) {
        team = teams.find(t => t.team_name?.toLowerCase() === (u.email?.split('@')[0] || '').toLowerCase())
      }
      if (team) {
        console.log(`Syncing user ${u.email} (${u.user_id}) -> team_id: ${team.team_id}`)
        await admin.from('users').update({ team_id: team.team_id, role: 'captain' }).eq('user_id', u.user_id)
        await admin.from('teams').update({ captain_user_id: u.user_id }).eq('team_id', team.team_id)
      }
    }
  }

  console.log('✅ Users table team_id sync completed!')
}

testAndFixBookingsRls()
