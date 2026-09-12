/**
 * Utility for generating and managing personalized, globally unique booking reference codes
 * and synchronized schedule formatting across client and admin interfaces.
 *
 * Format:
 *   HUB-[USER_INITIALS]-[PHONE_LAST4]-[DETERMINISTIC_OR_UNIQUE_TOKEN]
 *
 * Examples:
 *   - Eleanor Vance (+1 212 555-0199) -> HUB-EV-0199-7842
 *   - Keshav Sharma (9876543210)       -> HUB-KS-3210-9184
 *   - Walk-in / In-salon guest         -> HUB-GS-WALK-5821
 */

/**
 * Extracts 2 clean uppercase initials from a user's full name.
 * @param {string} name
 * @returns {string} e.g. "EV", "KS", "JO", "GS"
 */
export function extractUserInitials(name = '') {
  if (!name || typeof name !== 'string') return 'GS'
  const clean = name.trim().replace(/[^a-zA-Z\s]/g, '')
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  } else if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase()
  } else if (parts.length === 1 && parts[0].length === 1) {
    return (parts[0][0] + 'X').toUpperCase()
  }
  return 'GS' // Guest
}

/**
 * Extracts the last 4 digits of a phone number (or fallback identifier).
 * @param {string} phone
 * @param {string} [email]
 * @returns {string} e.g. "0199", "3210", "WALK"
 */
export function extractPhoneLast4(phone = '', email = '') {
  if (phone && typeof phone === 'string') {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length >= 4) {
      return digits.slice(-4)
    } else if (digits.length > 0) {
      return digits.padStart(4, '0')
    }
  }
  if (email && typeof email === 'string') {
    const cleanEmail = email.replace(/[^a-zA-Z0-9]/g, '')
    if (cleanEmail.length >= 4) {
      return cleanEmail.slice(0, 4).toUpperCase()
    }
  }
  return 'WALK'
}

/**
 * Generates a unique, user-recognizable booking reference code.
 * When bookingId is provided with digits, uses its last 4 digits as a deterministic token
 * ensuring the generated code never drifts between client confirmation and admin sync.
 *
 * @param {string} guestName - Customer's full name
 * @param {string} [guestPhone] - Customer's mobile / WhatsApp number
 * @param {string} [guestEmail] - Customer's email address
 * @param {Array<{ code?: string }>} [existingBookings] - Array of existing bookings to verify uniqueness against
 * @param {string} [bookingId] - Optional booking record ID to derive deterministic token
 * @returns {string} Formatted unique booking code e.g. "HUB-EV-0199-7842"
 */
export function generateUniqueBookingCode(guestName = '', guestPhone = '', guestEmail = '', existingBookings = [], bookingId = '') {
  const initials = extractUserInitials(guestName)
  const phone4 = extractPhoneLast4(guestPhone, guestEmail)

  const existingSet = new Set(
    (existingBookings || [])
      .map((b) => (b?.code || '').toUpperCase().trim())
      .filter(Boolean)
  )

  // 1. If bookingId has digits, use its last 4 digits as deterministic token
  if (bookingId) {
    const digits = String(bookingId).replace(/[^0-9]/g, '')
    if (digits.length >= 4) {
      const token = digits.slice(-4)
      const code = `HUB-${initials}-${phone4}-${token}`
      if (!existingSet.has(code)) {
        return code
      }
    }
  }

  // 2. High-resolution fallback entropy token
  let code = ''
  let attempts = 0
  do {
    const msPart = (Date.now() % 1000).toString().padStart(3, '0')
    const randPart = Math.floor(Math.random() * 10).toString()
    const token = `${msPart}${randPart}`
    code = `HUB-${initials}-${phone4}-${token}`
    attempts++
  } while (existingSet.has(code) && attempts < 50)

  return code
}

/**
 * Parses a recognizable booking reference code into its components.
 * @param {string} code
 * @returns {{ initials: string, userPhoneRef: string, uniqueToken: string } | null}
 */
export function parseBookingCode(code = '') {
  if (!code || typeof code !== 'string') return null
  const m = code.trim().match(/^HUB-([A-Z]{2,3})-([A-Z0-9]{4})-(\d{4})$/i)
  if (!m) return null
  return {
    initials: m[1].toUpperCase(),
    userPhoneRef: m[2].toUpperCase(),
    uniqueToken: m[3]
  }
}

/**
 * Ensures a stable, deterministic reference code for any booking record.
 * If code is already present, returns it untouched.
 * If missing, generates a deterministic code based on initials, phone, and booking ID digits
 * so that it NEVER randomly changes across re-renders, reloads, or syncs.
 * @param {object} booking
 * @returns {string} e.g. "HUB-EV-0199-7842"
 */
export function getOrGenerateBookingCode(booking) {
  if (!booking) return 'HUB-GS-WALK-1001'
  if (booking.code && typeof booking.code === 'string' && booking.code.trim().length >= 6) {
    return booking.code.trim().toUpperCase()
  }
  const name = booking.guestName || booking.client_name || booking.clientName || ''
  const phone = booking.guestPhone || booking.client_phone || booking.clientPhone || ''
  const email = booking.guestEmail || booking.client_email || booking.clientEmail || ''
  const id = booking.id || ''

  const initials = extractUserInitials(name)
  const phone4 = extractPhoneLast4(phone, email)

  // Extract digits from booking ID (e.g. bk-1789230088740 -> 8740)
  const digits = String(id).replace(/[^0-9]/g, '')
  const token = digits.length >= 4 ? digits.slice(-4) : (digits.padStart(4, '0') || '1001')

  return `HUB-${initials}-${phone4}-${token}`
}

/**
 * Calculates end time based on start time and duration string (e.g. '09:30 AM', '60 min' -> '10:30 AM').
 * @param {string} startTimeStr - e.g. '09:30 AM'
 * @param {string} [durationStr='60 min']
 * @returns {string} e.g. '10:30 AM'
 */
export function calculateEndTime(startTimeStr, durationStr = '60 min') {
  if (!startTimeStr || typeof startTimeStr !== 'string') return ''
  try {
    const match = startTimeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return ''
    let hour = parseInt(match[1], 10)
    let minute = parseInt(match[2], 10)
    const ampm = match[3].toUpperCase()

    if (ampm === 'PM' && hour !== 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0

    const durMatch = String(durationStr).match(/(\d+)/)
    const durationMinutes = durMatch ? parseInt(durMatch[1], 10) : 60

    const totalMinutes = hour * 60 + minute + durationMinutes
    let endHour = Math.floor(totalMinutes / 60) % 24
    let endMin = totalMinutes % 60

    const endAmpm = endHour >= 12 ? 'PM' : 'AM'
    let displayHour = endHour % 12
    if (displayHour === 0) displayHour = 12

    return `${String(displayHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')} ${endAmpm}`
  } catch {
    return ''
  }
}

/**
 * Formats a date string 'YYYY-MM-DD' into friendly 'Sun, Sep 13, 2026'.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatFriendlyDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return ''
  try {
    const raw = dateStr.split('T')[0]
    const parts = raw.split('-')
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      }
    }
  } catch {}
  return dateStr
}

/**
 * Formats full schedule identical to client confirmation card:
 * e.g. "Sun, Sep 13, 2026 at 09:30 AM (until 10:30 AM)"
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - '09:30 AM'
 * @param {string} [durationStr='60 min']
 * @returns {string}
 */
export function formatFriendlySchedule(dateStr, timeStr, durationStr = '60 min') {
  const fDate = formatFriendlyDate(dateStr)
  if (!timeStr) return fDate || 'Date TBD'
  const endTime = calculateEndTime(timeStr, durationStr)
  const finishPart = endTime ? ` (until ${endTime})` : ''
  if (!fDate) return `${timeStr}${finishPart}`
  return `${fDate} at ${timeStr}${finishPart}`
}

/**
 * Intelligently merges a cloud booking record with a local booking record without
 * overwriting customer details (name, phone, notes, treatment, price, reference code, scheduling time).
 *
 * @param {object} cloudB - Booking record from Supabase
 * @param {object} localB - Booking record from localStorage
 * @returns {object} Completely synchronized, merged booking record
 */
export function mergeBookingRecords(cloudB, localB) {
  if (!cloudB && !localB) return null
  if (!cloudB) return localB
  if (!localB) {
    const code = cloudB.code || getOrGenerateBookingCode(cloudB)
    return {
      ...cloudB,
      code,
      guestName: cloudB.guestName || cloudB.client_name || 'Valued Guest',
      client_name: cloudB.client_name || cloudB.guestName || 'Valued Guest',
      guestPhone: cloudB.guestPhone || cloudB.client_phone || '',
      client_phone: cloudB.client_phone || cloudB.guestPhone || '',
      guestEmail: cloudB.guestEmail || cloudB.client_email || '',
      client_email: cloudB.client_email || cloudB.guestEmail || '',
      notes: cloudB.notes || cloudB.guestNotes || '',
      guestNotes: cloudB.guestNotes || cloudB.notes || '',
      serviceName: cloudB.serviceName || cloudB.service_name || 'Cut & Styling',
      service_name: cloudB.service_name || cloudB.serviceName || 'Cut & Styling',
      servicePrice: cloudB.servicePrice || cloudB.service_price || 'Rs 150+',
      service_price: cloudB.service_price || cloudB.servicePrice || 'Rs 150+',
      stylist: cloudB.stylist || 'Fifth Avenue Master Stylist',
      date: cloudB.date || cloudB.appointment_date || '',
      appointment_date: cloudB.appointment_date || cloudB.date || '',
      time: cloudB.time || cloudB.appointment_time || '',
      appointment_time: cloudB.appointment_time || cloudB.time || '',
      isQuietChair: Boolean(cloudB.quiet_chair ?? cloudB.isQuietChair),
      quiet_chair: Boolean(cloudB.quiet_chair ?? cloudB.isQuietChair),
      status: cloudB.status || 'Confirmed'
    }
  }

  // 1. Reference Code: Local code takes priority because it was displayed to user on confirmation screen
  const resolvedCode = (localB.code && localB.code.trim().length >= 6)
    ? localB.code.trim().toUpperCase()
    : (cloudB.code && cloudB.code.trim().length >= 6)
      ? cloudB.code.trim().toUpperCase()
      : getOrGenerateBookingCode(localB || cloudB)

  // 2. Client Name: Prefer real customer name over fallback 'Valued Guest'
  const isDefaultOrEmpty = (n) => !n || n.trim().toLowerCase() === 'valued guest' || n.trim().toLowerCase() === 'guest'
  const rawLocalName = (localB.guestName || localB.client_name || '').trim()
  const rawCloudName = (cloudB.guestName || cloudB.client_name || '').trim()
  const resolvedName = !isDefaultOrEmpty(rawLocalName)
    ? rawLocalName
    : !isDefaultOrEmpty(rawCloudName)
      ? rawCloudName
      : (rawLocalName || rawCloudName || 'Valued Guest')

  // 3. Contact Info
  const resolvedPhone = (localB.guestPhone || localB.client_phone || cloudB.guestPhone || cloudB.client_phone || '').trim()
  const resolvedEmail = (localB.guestEmail || localB.client_email || cloudB.guestEmail || cloudB.client_email || '').trim()

  // 4. Special Requests / Notes
  const resolvedNotes = (localB.notes || localB.guestNotes || cloudB.notes || cloudB.guestNotes || '').trim()

  // 5. Schedule: Date & Time (Preserve client's selected slot)
  const resolvedDate = localB.date || localB.appointment_date || cloudB.date || cloudB.appointment_date || ''
  const resolvedTime = localB.time || localB.appointment_time || cloudB.time || cloudB.appointment_time || ''

  // 6. Treatment & Investment
  const resolvedService = localB.serviceName || localB.service_name || cloudB.serviceName || cloudB.service_name || 'Cut & Styling'
  const resolvedPrice = localB.servicePrice || localB.service_price || cloudB.servicePrice || cloudB.service_price || 'Rs 150+'
  const resolvedStylist = localB.stylist || cloudB.stylist || 'Fifth Avenue Master Stylist'
  const resolvedQuiet = Boolean(localB.quiet_chair ?? localB.isQuietChair ?? cloudB.quiet_chair ?? cloudB.isQuietChair)

  // 7. Status & Timestamps
  const resolvedStatus = cloudB.status || localB.status || 'Confirmed'
  const createdAt = localB.createdAt || localB.created_at || cloudB.createdAt || cloudB.created_at || new Date().toISOString()
  const id = localB.id || cloudB.id || `bk-${Date.now()}`

  return {
    id,
    code: resolvedCode,
    guestName: resolvedName,
    client_name: resolvedName,
    guestPhone: resolvedPhone,
    client_phone: resolvedPhone,
    guestEmail: resolvedEmail,
    client_email: resolvedEmail,
    notes: resolvedNotes,
    guestNotes: resolvedNotes,
    serviceName: resolvedService,
    service_name: resolvedService,
    servicePrice: resolvedPrice,
    service_price: resolvedPrice,
    stylist: resolvedStylist,
    date: resolvedDate,
    appointment_date: resolvedDate,
    time: resolvedTime,
    appointment_time: resolvedTime,
    isQuietChair: resolvedQuiet,
    quiet_chair: resolvedQuiet,
    status: resolvedStatus,
    createdAt: typeof createdAt === 'string' && createdAt.includes('T') ? createdAt.split('T')[0] : createdAt,
    created_at: typeof createdAt === 'string' && !createdAt.includes('T') ? new Date(createdAt).toISOString() : createdAt
  }
}
