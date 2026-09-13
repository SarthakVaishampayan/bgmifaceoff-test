import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

// POST /api/admin/slots/publish-scores
// Pushes/publishes match scores for a slot to the live points table / leaderboard
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const slotId = body?.slot_id
    if (!slotId) {
      return NextResponse.json({ error: 'slot_id is required' }, { status: 400 })
    }

    // 1. Fetch current scores_published_slots from config
    const { data: cfg } = await admin
      .from('config')
      .select('value')
      .eq('key', 'scores_published_slots')
      .maybeSingle()

    let publishedIds: string[] = []
    if (cfg?.value) {
      try {
        const parsed = JSON.parse(cfg.value)
        if (Array.isArray(parsed)) publishedIds = parsed
      } catch {}
    }

    // 2. Add slotId to published set
    const updatedIds = Array.from(new Set([...publishedIds, String(slotId)]))

    // 3. Upsert to config table
    const { error: upsertErr } = await admin
      .from('config')
      .upsert({
        key: 'scores_published_slots',
        value: JSON.stringify(updatedIds),
        updated_at: new Date().toISOString(),
      })

    if (upsertErr) {
      throw upsertErr
    }

    // 4. Revalidate pages displaying leaderboard and user dashboard
    try {
      revalidatePath('/leaderboard')
      revalidatePath('/dashboard')
      revalidatePath('/admin')
    } catch (e) {}

    return NextResponse.json({
      success: true,
      slot_id: slotId,
      published_slots: updatedIds,
      message: 'Slot scores successfully published to the points table / leaderboard',
    })
  } catch (err: any) {
    console.error('Error publishing slot scores:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
