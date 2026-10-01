/**
 * Client-side HTML5 Canvas Slot Poster Generator
 * Renders the exact 1100x1338 high-resolution slot poster directly in the browser.
 * Bypasses headless serverless font limitations (sharp/librsvg missing OS fonts),
 * guaranteeing crisp, accurate typography and 0s download latency.
 */

export interface SlotPosterTeam {
  room_slot_number: number
  team_name: string
}

export interface SlotPosterData {
  timeText: string
  dateText: string
  teams: SlotPosterTeam[]
  logoUrl?: string
}

export function formatPosterDateLabel(dateStr: string): string {
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text

  let truncated = text
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function generateSlotPosterCanvas(
  data: SlotPosterData
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('generateSlotPosterCanvas must be executed in a browser environment')
  }

  // Ensure fonts are fully loaded
  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  const width = 1100
  const height = 1338

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  // 1. Radial Background
  const bgGrad = ctx.createRadialGradient(
    width / 2,
    height * 0.45,
    50,
    width / 2,
    height * 0.45,
    800
  )
  bgGrad.addColorStop(0, '#191c1f')
  bgGrad.addColorStop(0.55, '#0c0e10')
  bgGrad.addColorStop(1, '#050607')

  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // 2. Diagonal Grid Lines pattern
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  const lineSpacing = 35
  for (let x = -height; x < width + height; x += lineSpacing) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + height * 0.8, height)
    ctx.stroke()
  }
  ctx.restore()

  // 3. Side Yellow Chevron Accents
  ctx.fillStyle = '#ffd000'
  const leftChevrons = [205, 245, 285]
  for (const y of leftChevrons) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(28, y)
    ctx.lineTo(0, y + 22)
    ctx.closePath()
    ctx.fill()
  }

  for (const y of leftChevrons) {
    ctx.beginPath()
    ctx.moveTo(width, y)
    ctx.lineTo(width - 28, y)
    ctx.lineTo(width, y + 22)
    ctx.closePath()
    ctx.fill()
  }

  // 4. Header: BATTLEGROUNDS FACEOFF SERIES
  ctx.textBaseline = 'middle'
  ctx.font = "900 28px 'Inter', Arial, sans-serif"
  const bgText = 'BATTLEGROUNDS '
  const foText = 'FACEOFF SERIES'
  const bgWidth = ctx.measureText(bgText).width
  const foWidth = ctx.measureText(foText).width
  const totalHeaderWidth = bgWidth + foWidth
  const headerStartX = (width - totalHeaderWidth) / 2

  ctx.fillStyle = '#ffffff'
  ctx.fillText(bgText, headerStartX, 88)
  ctx.fillStyle = '#fbbf24'
  ctx.fillText(foText, headerStartX + bgWidth, 88)

  // 5. Header: P R E S E N T S
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.font = "700 12px 'Inter', Arial, sans-serif"
  ctx.textAlign = 'center'
  // Draw spaced letters
  const presentsText = 'P  R  E  S  E  N  T  S'
  ctx.fillText(presentsText, width / 2, 137)
  ctx.restore()

  // 6. Dynamic Slot Time
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.font = "800 62px 'Inter', Arial, sans-serif"
  ctx.textAlign = 'center'
  ctx.fillText(data.timeText || 'TIME', width / 2, 240)
  ctx.restore()

  // 7. Dynamic Date
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.font = "600 20px 'Inter', Arial, sans-serif"
  ctx.textAlign = 'center'
  ctx.fillText(data.dateText || 'DATE', width / 2, 295)
  ctx.restore()

  // 8. SLOT LIST Badge
  const badgeW = 310
  const badgeH = 60
  const badgeX = (width - badgeW) / 2
  const badgeY = 350
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 7)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.save()
  ctx.fillStyle = '#111111'
  ctx.font = "800 21px 'Inter', Arial, sans-serif"
  ctx.textAlign = 'center'
  ctx.fillText('S L O T   L I S T', width / 2, badgeY + badgeH / 2)
  ctx.restore()

  // 9. 20 Slots Grid (Left: 05-14, Right: 15-24)
  const leftColX = 55
  const rightColX = 561
  const colWidth = 484
  const slotHeight = 62
  const rowGap = 7
  const startY = 445

  const teamsMap: Record<number, string> = {}
  for (const t of data.teams || []) {
    if (t?.room_slot_number) {
      teamsMap[t.room_slot_number] = t.team_name || ''
    }
  }

  for (let i = 0; i < 10; i++) {
    const y = startY + i * (slotHeight + rowGap)
    const leftSlotNum = 5 + i
    const rightSlotNum = 15 + i

    const cols = [
      { x: leftColX, num: leftSlotNum, team: teamsMap[leftSlotNum] || '' },
      { x: rightColX, num: rightSlotNum, team: teamsMap[rightSlotNum] || '' },
    ]

    for (const col of cols) {
      // Outer card
      roundRect(ctx, col.x, y, colWidth, slotHeight, 8)
      ctx.fillStyle = '#121416'
      ctx.fill()
      ctx.strokeStyle = '#4c5054'
      ctx.lineWidth = 1
      ctx.stroke()

      // Slot number box (Yellow)
      const numBoxX = col.x + 6
      const numBoxY = y + 6
      const numBoxSize = 50
      roundRect(ctx, numBoxX, numBoxY, numBoxSize, numBoxSize, 6)
      ctx.fillStyle = '#ffd000'
      ctx.fill()

      // Slot number text
      ctx.save()
      ctx.fillStyle = '#000000'
      ctx.font = "900 23px 'Inter', Arial, sans-serif"
      ctx.textAlign = 'center'
      ctx.fillText(
        String(col.num).padStart(2, '0'),
        numBoxX + numBoxSize / 2,
        numBoxY + numBoxSize / 2 + 1
      )
      ctx.restore()

      // Team name box
      const teamBoxX = col.x + 62
      const teamBoxY = y + 6
      const teamBoxW = colWidth - 68
      const teamBoxH = 50
      roundRect(ctx, teamBoxX, teamBoxY, teamBoxW, teamBoxH, 6)
      ctx.fillStyle = '#1a1d20'
      ctx.fill()

      // Team name text
      if (col.team) {
        ctx.save()
        ctx.font = "700 20px 'Inter', Arial, sans-serif"
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        const paddingLeft = 16
        const paddingRight = 12
        const maxTextW = teamBoxW - paddingLeft - paddingRight
        const safeText = truncateText(ctx, col.team, maxTextW)
        ctx.fillText(
          safeText,
          teamBoxX + paddingLeft,
          teamBoxY + teamBoxH / 2 + 1
        )
        ctx.restore()
      }
    }
  }

  // 10. Bottom Logo
  const logoSrc = data.logoUrl || '/images/faceofflogo.png'
  const logoImg = await loadImage(logoSrc)
  if (logoImg) {
    ctx.save()
    ctx.globalAlpha = 0.95
    // Target height 108px, centered horizontally
    const targetH = 108
    const aspect = logoImg.width / logoImg.height
    const targetW = targetH * aspect
    const logoX = (width - targetW) / 2
    const logoY = 1170
    ctx.drawImage(logoImg, logoX, logoY, targetW, targetH)
    ctx.restore()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      },
      'image/png',
      1.0
    )
  })
}

/**
 * Triggers a direct download of the generated slot poster PNG in the browser
 */
export async function downloadSlotPoster(
  data: SlotPosterData,
  filename: string
): Promise<void> {
  const blob = await generateSlotPosterCanvas(data)
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.style.display = 'none'
  a.addEventListener('click', (e) => e.stopPropagation())
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
