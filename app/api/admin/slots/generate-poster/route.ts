import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import { getSlotWindowOnly } from '@/lib/utils/slotTime'
import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'

function escapeXml(unsafe: string | null | undefined): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return 'DATE'
  try {
    const clean = String(dateStr).split('T')[0]
    const [y, m, d] = clean.split('-').map(Number)
    if (!y || !m || !d) return clean
    const dt = new Date(y, m - 1, d)
    const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
    const monthName = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    return `${dayName}, ${String(d).padStart(2, '0')} ${monthName} ${y}`
  } catch {
    return dateStr
  }
}

// POST or GET /api/admin/slots/generate-poster
export async function GET(request: Request) {
  return handleGeneratePoster(request)
}

export async function POST(request: Request) {
  return handleGeneratePoster(request)
}

async function handleGeneratePoster(request: Request) {
  try {
    const url = new URL(request.url)
    let body: any = {}
    if (request.method === 'POST') {
      body = await request.json().catch(() => ({}))
    }
    const slot_id = body.slot_id || url.searchParams.get('slot_id')
    const time_override = body.time_override || url.searchParams.get('time_override')
    const date_override = body.date_override || url.searchParams.get('date_override')
    const teams_override = body.teams_override

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id is required' }, { status: 400 })
    }

    const admin = await createAdminClient()

    // If teams_override is used, verify admin privileges
    if (teams_override) {
      const supabase = await createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }

      const isPermAdmin = isSuperAdminEmail(user.email)
      const { data: userProfile } = await admin
        .from('users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!isPermAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
        return NextResponse.json({ error: 'Admin privileges required for custom overrides' }, { status: 403 })
      }
    }

    // 1. Fetch slot info
    const { data: slot, error: slotErr } = await admin
      .from('slots')
      .select('*')
      .eq('slot_id', slot_id)
      .maybeSingle()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // 2. Fetch paid bookings with teams if not overridden
    let teamsMap: Record<number, string> = {}
    if (Array.isArray(teams_override)) {
      for (const t of teams_override) {
        if (t && typeof t.room_slot_number === 'number') {
          teamsMap[t.room_slot_number] = String(t.team_name || '').trim()
        }
      }
    } else {
      const { data: bookings } = await admin
        .from('bookings')
        .select('room_slot_number, teams(team_name)')
        .eq('slot_id', slot_id)
        .eq('payment_status', 'paid')

      if (bookings) {
        for (const b of bookings as any[]) {
          const slotNum = b.room_slot_number || 5
          const name = b.teams?.team_name || ''
          teamsMap[slotNum] = name
        }
      }
    }

    const rawTime = time_override || slot.time_label || 'TIME'
    const timeText = getSlotWindowOnly(rawTime) || rawTime
    const dateText = date_override || formatDateLabel(slot.date)

    // Layout configuration
    const width = 1100
    const height = 1338
    const leftColX = 55
    const rightColX = 561
    const colWidth = 484
    const slotHeight = 62
    const rowGap = 7
    const startY = 445

    let slotsSvg = ''

    // 20 Slots: Left column 05-14, Right column 15-24
    for (let i = 0; i < 10; i++) {
      const y = startY + i * (slotHeight + rowGap)
      const leftSlotNum = 5 + i
      const rightSlotNum = 15 + i

      const leftSlotStr = String(leftSlotNum).padStart(2, '0')
      const rightSlotStr = String(rightSlotNum).padStart(2, '0')

      const leftTeam = teamsMap[leftSlotNum] || ''
      const rightTeam = teamsMap[rightSlotNum] || ''

      // Left Slot
      slotsSvg += `
        <rect x="${leftColX}" y="${y}" width="${colWidth}" height="${slotHeight}" rx="8" fill="#121416" stroke="#4c5054" stroke-width="1"/>
        <rect x="${leftColX + 6}" y="${y + 6}" width="50" height="50" rx="6" fill="#ffd000"/>
        <text x="${leftColX + 31}" y="${y + 39}" font-family="'Inter', Arial, Helvetica, sans-serif" font-size="23" font-weight="900" fill="#000000" text-anchor="middle">${leftSlotStr}</text>
        <rect x="${leftColX + 62}" y="${y + 6}" width="${colWidth - 68}" height="50" rx="6" fill="#1a1d20"/>
        <text x="${leftColX + 78}" y="${y + 38}" font-family="'Inter', Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(leftTeam)}</text>
      `

      // Right Slot
      slotsSvg += `
        <rect x="${rightColX}" y="${y}" width="${colWidth}" height="${slotHeight}" rx="8" fill="#121416" stroke="#4c5054" stroke-width="1"/>
        <rect x="${rightColX + 6}" y="${y + 6}" width="50" height="50" rx="6" fill="#ffd000"/>
        <text x="${rightColX + 31}" y="${y + 39}" font-family="'Inter', Arial, Helvetica, sans-serif" font-size="23" font-weight="900" fill="#000000" text-anchor="middle">${rightSlotStr}</text>
        <rect x="${rightColX + 62}" y="${y + 6}" width="${colWidth - 68}" height="50" rx="6" fill="#1a1d20"/>
        <text x="${rightColX + 78}" y="${y + 38}" font-family="'Inter', Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(rightTeam)}</text>
      `
    }

    // Logo area at bottom: check if faceofflogo exists (+20% size: 180x144, centered at x=460)
    let logoSvg = ''
    try {
      const logoPath = path.join(process.cwd(), 'public/images/faceofflogo.png')
      if (fs.existsSync(logoPath)) {
        const logoBase64 = fs.readFileSync(logoPath).toString('base64')
        logoSvg = `<image href="data:image/png;base64,${logoBase64}" x="460" y="1150" width="180" height="144" preserveAspectRatio="xMidYMid meet" opacity="0.95"/>`
      }
    } catch (e) {
      console.warn('Could not embed logo image in poster SVG:', e)
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGradient" cx="50%" cy="50%" r="55%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="#191c1f"/>
          <stop offset="55%" stop-color="#0c0e10"/>
          <stop offset="100%" stop-color="#050607"/>
        </radialGradient>
        <pattern id="diagLines" width="50" height="50" patternTransform="rotate(35 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="50" stroke="#ffffff" stroke-width="1" opacity="0.08"/>
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bgGradient)"/>
      <rect width="100%" height="100%" fill="url(#diagLines)"/>

      <!-- Yellow side accents (Left) -->
      <polygon points="0,205 28,205 0,227" fill="#ffd000"/>
      <polygon points="0,245 28,245 0,267" fill="#ffd000"/>
      <polygon points="0,285 28,285 0,307" fill="#ffd000"/>

      <!-- Yellow side accents (Right) -->
      <polygon points="1100,205 1072,205 1100,227" fill="#ffd000"/>
      <polygon points="1100,245 1072,245 1100,267" fill="#ffd000"/>
      <polygon points="1100,285 1072,285 1100,307" fill="#ffd000"/>

      <!-- Header: BATTLEGROUNDS FACEOFF SERIES -->
      <text x="550" y="88" font-family="'Inter', Arial, Helvetica, sans-serif" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="1">
        <tspan fill="#ffffff">BATTLEGROUNDS </tspan>
        <tspan fill="#fbbf24">FACEOFF SERIES</tspan>
      </text>

      <!-- Header: P R E S E N T S -->
      <text x="550" y="137" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="8" fill="#ffffff" text-anchor="middle">P R E S E N T S</text>

      <!-- Slot Time -->
      <text x="550" y="240" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(timeText)}</text>

      <!-- Slot Date -->
      <text x="550" y="295" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="500" letter-spacing="5" fill="#ffffff" text-anchor="middle">${escapeXml(dateText)}</text>

      <!-- Slot List Title Badge -->
      <rect x="395" y="350" width="310" height="60" rx="7" fill="#ffffff"/>
      <text x="550" y="389" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="5" fill="#111111" text-anchor="middle">SLOT LIST</text>

      <!-- Grid of Slots (05-24) -->
      ${slotsSvg}

      <!-- Bottom Logo Area -->
      ${logoSvg}
    </svg>`

    const pngBuffer = await sharp(Buffer.from(svg))
      .png({ quality: 100, compressionLevel: 6 })
      .toBuffer()

    const cleanName = `bgfs-slot-${slot.date || 'match'}-${slot_id.slice(0, 8)}.png`

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${cleanName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('Error generating slot poster:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
