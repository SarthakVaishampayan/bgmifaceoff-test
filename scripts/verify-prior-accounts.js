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

async function syncPriorAccounts() {
  console.log('🔍 Checking and syncing all prior user accounts & teams...')

  // 1. Fetch all users from public.users
  const { data: users, error: uErr } = await admin.from('users').select('*')
  if (uErr) console.error('Error fetching users:', uErr.message)
  console.log(`Found ${users?.length || 0} user records in public.users.`)

  // 2. Fetch all teams from public.teams
  const { data: teams, error: tErr } = await admin.from('teams').select('*')
  if (tErr) console.error('Error fetching teams:', tErr.message)
  console.log(`Found ${teams?.length || 0} team records in public.teams.`)

  // 3. Sync prior users missing team_id or captain_user_id
  if (users) {
    for (const u of users) {
      // Find if user has any team in teams table
      let team = teams?.find(t => t.captain_user_id === u.user_id || t.team_id === u.team_id)

      if (!team && u.email) {
        const defaultName = u.email.split('@')[0]
        team = teams?.find(t => t.team_name?.toLowerCase() === defaultName.toLowerCase())
      }

      if (team) {
        // Ensure captain_user_id is set on team
        if (!team.captain_user_id) {
          console.log(`Updating team ${team.team_name} captain_user_id -> ${u.user_id}`)
          await admin.from('teams').update({ captain_user_id: u.user_id }).eq('team_id', team.team_id)
        }
        // Ensure team_id is set on user profile
        if (!u.team_id) {
          console.log(`Updating user ${u.email} team_id -> ${team.team_id}`)
          await admin.from('users').update({ team_id: team.team_id, role: 'captain' }).eq('user_id', u.user_id)
        }
      } else {
        // Provision team for user if none exists
        const defaultTeamName = u.display_name || u.email?.split('@')[0] || `Team ${u.user_id.slice(0, 5)}`
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        console.log(`Creating default team "${defaultTeamName}" for user ${u.email}...`)
        const { data: newTeam } = await admin
          .from('teams')
          .insert({ team_name: defaultTeamName, captain_user_id: u.user_id, invite_code: inviteCode })
          .select('team_id')
          .single()

        if (newTeam) {
          await admin.from('users').update({ team_id: newTeam.team_id, role: 'captain' }).eq('user_id', u.user_id)
        }
      }
    }
  }

  console.log('✅ Prior accounts sync completed!')
}

syncPriorAccounts()
