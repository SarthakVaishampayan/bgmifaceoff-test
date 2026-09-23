import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import { NextResponse } from 'next/server'

// GET /api/admin/finances
// Fetches all financial day records from config
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Super Admin privileges required' }, { status: 403 })
    }

    const { data: config } = await admin
      .from('config')
      .select('value')
      .eq('key', 'admin_finances_data')
      .maybeSingle()

    let records: any[] = []
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value)
        if (Array.isArray(parsed)) records = parsed
      } catch {}
    }

    return NextResponse.json({ records })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/finances
// Creates or updates a day's financial record
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Super Admin privileges required' }, { status: 403 })
    }

    const record = await request.json()
    if (!record || !record.date) {
      return NextResponse.json({ error: 'Date is required.' }, { status: 400 })
    }

    // Fetch existing records
    const { data: config } = await admin
      .from('config')
      .select('value')
      .eq('key', 'admin_finances_data')
      .maybeSingle()

    let records: any[] = []
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value)
        if (Array.isArray(parsed)) records = parsed
      } catch {}
    }

    const recordId = record.id || `fin_${record.date}_${Date.now()}`
    const enrichedRecord = {
      ...record,
      id: recordId,
      updated_at: new Date().toISOString(),
      created_at: record.created_at || new Date().toISOString(),
    }

    // Replace if same id or same date, else append
    const existingIndex = records.findIndex(r => r.id === recordId || r.date === record.date)
    if (existingIndex >= 0) {
      records[existingIndex] = enrichedRecord
    } else {
      records.unshift(enrichedRecord)
    }

    // Sort descending by date
    records.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))

    const { error: upsertErr } = await admin.from('config').upsert({
      key: 'admin_finances_data',
      value: JSON.stringify(records),
    }, { onConflict: 'key' })

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, record: enrichedRecord, records })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/finances
// Deletes a day record by id or date
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Super Admin privileges required' }, { status: 403 })
    }

    const { id, date } = await request.json()
    if (!id && !date) {
      return NextResponse.json({ error: 'id or date is required to delete.' }, { status: 400 })
    }

    const { data: config } = await admin
      .from('config')
      .select('value')
      .eq('key', 'admin_finances_data')
      .maybeSingle()

    let records: any[] = []
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value)
        if (Array.isArray(parsed)) records = parsed
      } catch {}
    }

    const filtered = records.filter(r => (id ? r.id !== id : r.date !== date))

    const { error: upsertErr } = await admin.from('config').upsert({
      key: 'admin_finances_data',
      value: JSON.stringify(filtered),
    }, { onConflict: 'key' })

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, records: filtered })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
