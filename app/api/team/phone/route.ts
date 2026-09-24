import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/team/phone - Fetch saved phone number for the authenticated user/team
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // 1. Get user profile from users table
    const { data: userProfile } = await admin
      .from('users')
      .select('team_id, phone')
      .eq('user_id', user.id)
      .maybeSingle()

    let phone = userProfile?.phone || user.user_metadata?.phone || ''
    let teamId = userProfile?.team_id

    if (!teamId) {
      const { data: teamByCaptain } = await admin
        .from('teams')
        .select('team_id')
        .eq('captain_user_id', user.id)
        .maybeSingle()
      teamId = teamByCaptain?.team_id
    }

    // 2. Check config table fallback
    if (!phone && teamId) {
      const { data: configEntry } = await admin
        .from('config')
        .select('value')
        .eq('key', `phone_team_${teamId}`)
        .maybeSingle()

      if (configEntry?.value) {
        try {
          const parsed = JSON.parse(configEntry.value)
          if (parsed.phone) phone = parsed.phone
        } catch (e) {
          phone = configEntry.value
        }
      }
    }

    if (!phone) {
      const { data: userConfig } = await admin
        .from('config')
        .select('value')
        .eq('key', `phone_user_${user.id}`)
        .maybeSingle()

      if (userConfig?.value) {
        try {
          const parsed = JSON.parse(userConfig.value)
          if (parsed.phone) phone = parsed.phone
        } catch (e) {
          phone = userConfig.value
        }
      }
    }

    return NextResponse.json({
      phone: phone || '',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST /api/team/phone - Save or update phone number
export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10)

    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 })
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
    const phoneData = {
      phone: cleanPhone,
      updated_at: now,
      updated_by: user.id,
    }

    // 1. Update phone column on users table
    try {
      await admin
        .from('users')
        .update({ phone: cleanPhone })
        .eq('user_id', user.id)
    } catch (dbErr) {
      console.warn('Could not update users.phone directly:', dbErr)
    }

    // 2. Save to config table under team key
    if (teamId) {
      await admin.from('config').upsert({
        key: `phone_team_${teamId}`,
        value: JSON.stringify(phoneData),
        updated_at: now,
      })
    }

    // 3. Save to config under user key for fallback
    await admin.from('config').upsert({
      key: `phone_user_${user.id}`,
      value: JSON.stringify(phoneData),
      updated_at: now,
    })

    // 4. Update auth user metadata
    try {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          phone: cleanPhone,
        },
      })
    } catch (metaErr) {
      console.error('Failed to update auth metadata for phone:', metaErr)
    }

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save phone number' }, { status: 500 })
  }
}
