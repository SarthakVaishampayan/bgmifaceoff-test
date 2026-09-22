import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/team/upi - Fetch saved UPI details for the authenticated user's team
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Get user profile
    const { data: userProfile } = await admin
      .from('users')
      .select('team_id, upi_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let teamId = userProfile?.team_id
    if (!teamId) {
      const { data: teamByCaptain } = await admin
        .from('teams')
        .select('team_id')
        .eq('captain_user_id', user.id)
        .maybeSingle()
      teamId = teamByCaptain?.team_id
    }

    let upiId = userProfile?.upi_id || user.user_metadata?.upi_id || ''
    let upiHolderName = user.user_metadata?.upi_holder_name || ''

    // Check config storage for team
    if (teamId) {
      const { data: configEntry } = await admin
        .from('config')
        .select('value')
        .eq('key', `upi_team_${teamId}`)
        .maybeSingle()

      if (configEntry?.value) {
        try {
          const parsed = JSON.parse(configEntry.value)
          if (parsed.upi_id) upiId = parsed.upi_id
          if (parsed.upi_holder_name) upiHolderName = parsed.upi_holder_name
        } catch (e) {}
      }
    }

    return NextResponse.json({
      upi_id: upiId,
      upi_holder_name: upiHolderName,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST /api/team/upi - Save or update UPI details
export async function POST(request: Request) {
  try {
    const { upi_id, upi_holder_name } = await request.json()

    if (!upi_id || !upi_id.trim()) {
      return NextResponse.json({ error: 'UPI ID is required' }, { status: 400 })
    }

    if (!upi_holder_name || !upi_holder_name.trim()) {
      return NextResponse.json({ error: 'UPI ID Holder Name is required' }, { status: 400 })
    }

    const trimmedUpi = upi_id.trim().toLowerCase()
    const trimmedHolder = upi_holder_name.trim()

    // Validate UPI ID format: must contain '@'
    if (!trimmedUpi.includes('@') || trimmedUpi.length < 5 || trimmedUpi.length > 50) {
      return NextResponse.json({ error: 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm)' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Find team ID
    const { data: userProfile } = await admin
      .from('users')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let teamId = userProfile?.team_id
    if (!teamId) {
      const { data: teamByCaptain } = await admin
        .from('teams')
        .select('team_id')
        .eq('captain_user_id', user.id)
        .maybeSingle()
      teamId = teamByCaptain?.team_id
    }

    const now = new Date().toISOString()
    const upiData = {
      upi_id: trimmedUpi,
      upi_holder_name: trimmedHolder,
      updated_at: now,
      updated_by: user.id,
    }

    // 1. Save to config table under team key
    if (teamId) {
      await admin.from('config').upsert({
        key: `upi_team_${teamId}`,
        value: JSON.stringify(upiData),
        updated_at: now,
      })
    }

    // 2. Also save to config under user key for fallback
    await admin.from('config').upsert({
      key: `upi_user_${user.id}`,
      value: JSON.stringify(upiData),
      updated_at: now,
    })

    // 3. Update upi_id column on users table
    await admin
      .from('users')
      .update({ upi_id: trimmedUpi })
      .eq('user_id', user.id)

    // 4. Update user metadata
    try {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          upi_id: trimmedUpi,
          upi_holder_name: trimmedHolder,
        },
      })
    } catch (metaErr) {
      console.error('Failed to update auth metadata for UPI:', metaErr)
    }

    // 5. Instantly update all pending payout slips for this team
    if (teamId) {
      try {
        await admin
          .from('payouts')
          .update({ upi_id: trimmedUpi })
          .eq('team_id', teamId)
          .eq('status', 'pending')
      } catch (payoutErr) {
        console.error('Failed to update pending payouts with new UPI:', payoutErr)
      }
    }

    return NextResponse.json({
      success: true,
      upi_id: trimmedUpi,
      upi_holder_name: trimmedHolder,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save UPI details' }, { status: 500 })
  }
}
