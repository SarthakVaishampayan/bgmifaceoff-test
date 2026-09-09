#!/usr/bin/env node

/**
 * BGFS Admin Setup Script
 * 
 * Usage:
 *   node scripts/setup-admin.js <email>
 * 
 * This script promotes an existing user to admin role.
 * The user must already be registered via /register.
 * 
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Parse .env.local manually (no dotenv dependency needed)
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local')
    const content = fs.readFileSync(envPath, 'utf-8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) return
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    })
  } catch (e) {
    // .env.local not found — will fail later with helpful message
  }
}

loadEnv()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('\n❌ Usage: node scripts/setup-admin.js <email>\n')
    console.error('   Example: node scripts/setup-admin.js admin@bgfsesports.com\n')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('\n❌ Missing Supabase credentials in .env.local')
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n')
    process.exit(1)
  }

  if (supabaseUrl.includes('your_supabase') || serviceKey.includes('placeholder')) {
    console.error('\n❌ Supabase credentials appear to be placeholders.')
    console.error('   Update .env.local with real values.\n')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  console.log(`\n🔍 Looking up user: ${email}`)

  // Find user in the users table
  const { data: userProfile, error: lookupErr } = await supabase
    .from('users')
    .select('user_id, email, role, display_name')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (lookupErr) {
    console.error('\n❌ Database error:', lookupErr.message)
    process.exit(1)
  }

  if (!userProfile) {
    console.error(`\n❌ No user found with email: ${email}`)
    console.error('   Make sure the user has registered via /register first.\n')
    process.exit(1)
  }

  console.log(`   Found user: ${userProfile.display_name || userProfile.email}`)
  console.log(`   Current role: ${userProfile.role}`)
  console.log(`   User ID: ${userProfile.user_id}`)

  if (userProfile.role === 'admin' || userProfile.role === 'admin_scores') {
    console.log(`\n✅ User is already an admin! No changes needed.\n`)
    process.exit(0)
  }

  // Promote to admin
  const { error: updateErr } = await supabase
    .from('users')
    .update({ role: 'admin' })
    .eq('user_id', userProfile.user_id)

  if (updateErr) {
    console.error('\n❌ Failed to update role:', updateErr.message)
    process.exit(1)
  }

  console.log(`\n✅ Successfully promoted ${email} to admin!`)
  console.log(`\n   You can now log in at: /admin/login\n`)
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message)
  process.exit(1)
})
