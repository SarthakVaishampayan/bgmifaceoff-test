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

async function clearAllBookings() {
  console.log('🧹 Starting clean slate wipe of all slot bookings...')

  // 1. Delete all bookings
  const { error: bErr, count: bCount } = await admin
    .from('bookings')
    .delete({ count: 'exact' })
    .neq('booking_id', '00000000-0000-0000-0000-000000000000')

  if (bErr) {
    console.error('Error deleting bookings:', bErr.message)
  } else {
    console.log(`✅ Deleted all rows from bookings table.`)
  }

  // 2. Delete all coupons
  const { error: cErr } = await admin
    .from('coupons')
    .delete({ count: 'exact' })
    .neq('coupon_id', '00000000-0000-0000-0000-000000000000')

  if (cErr) {
    console.error('Error deleting coupons:', cErr.message)
  } else {
    console.log(`✅ Deleted all rows from coupons table.`)
  }

  // 3. Reset all slots to 0 booked teams and status 'open'
  const { error: sErr } = await admin
    .from('slots')
    .update({
      teams_booked_count: 0,
      status: 'open',
    })
    .neq('slot_id', '00000000-0000-0000-0000-000000000000')

  if (sErr) {
    console.error('Error resetting slots:', sErr.message)
  } else {
    console.log(`✅ Reset all tournament slots back to 0/20 capacity (OPEN).`)
  }

  console.log('🎉 Clean slate wipe completed successfully!')
}

clearAllBookings()
