#!/usr/bin/env node

/**
 * BGFS Database Migration Runner
 * 
 * Runs all SQL migration files in order against the Supabase database.
 * 
 * Usage:
 *   node scripts/run-migrations.js
 * 
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Also requires the DB password (found in Supabase Dashboard → Settings → Database)
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Parse .env.local
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    })
  } catch (e) {}
}

loadEnv()

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

// Correct order for migrations with same prefix
const MIGRATION_ORDER = [
  '001_initial_schema.sql',
  '002_slot_booking_v2.sql',
  '003_best_5_slots_leaderboard.sql',
  '003_seed_9_to_11_pm_slots.sql',
  '003_team_name_change.sql',
  '004_admin_test_mode.sql',
  '004_room_slot_number.sql',
  '005_fix_bookings_rls.sql',
]

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('\n❌ Missing Supabase credentials in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  console.log('\n🚀 BGFS Database Migration Runner')
  console.log(`   Project: ${supabaseUrl}\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const filename of MIGRATION_ORDER) {
    const filepath = path.join(MIGRATIONS_DIR, filename)
    
    if (!fs.existsSync(filepath)) {
      console.log(`⚠️  SKIP: ${filename} (file not found)`)
      skipCount++
      continue
    }

    const sql = fs.readFileSync(filepath, 'utf-8')
    
    // Skip empty files
    if (!sql.trim()) {
      console.log(`⚠️  SKIP: ${filename} (empty)`)
      skipCount++
      continue
    }

    process.stdout.write(`⏳ Running ${filename}... `)

    try {
      // Execute SQL via Supabase RPC or direct query
      // We split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      let fileErrors = 0
      for (const statement of statements) {
        if (!statement.trim()) continue
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        
        if (error) {
          // Try direct query as fallback
          const { error: err2 } = await supabase
            .from('_manual_query')
            .select()
            .throwOnError()
            .then(() => ({ error: null }))
            .catch(e => ({ error: e }))
          
          // If RPC doesn't exist, we can't run SQL this way
          if (error.message?.includes('function') && error.message?.includes('exec_sql')) {
            console.log('❌')
            console.error(`   ⚠️  exec_sql RPC function not found.`)
            console.error(`   Please run this migration manually in Supabase SQL Editor:`)
            console.error(`   File: supabase/migrations/${filename}\n`)
            errorCount++
            break
          }
          
          fileErrors++
        }
      }

      if (fileErrors === 0) {
        console.log('✅')
        successCount++
      }
    } catch (err) {
      console.log('❌')
      console.error(`   Error: ${err.message}`)
      errorCount++
    }
  }

  console.log(`\n📊 Results: ${successCount} succeeded, ${skipCount} skipped, ${errorCount} failed\n`)

  if (errorCount > 0) {
    console.log('📋 To run migrations manually:')
    console.log('   1. Go to Supabase Dashboard → SQL Editor')
    console.log('   2. Run each file from supabase/migrations/ in order\n')
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
