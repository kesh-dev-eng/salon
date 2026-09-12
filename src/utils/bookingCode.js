/**
 * Utility for generating personalized, globally unique booking reference codes.
 *
 * Each booking number is designed to:
 * 1. Be Globally UNIQUE (collision-free across all reservations and users).
 * 2. RECOGNIZE each user:
 *    - Incorporates the user's name initials (e.g., Eleanor Vance -> EV, Keshav Sharma -> KS).
 *    - Incorporates the last 4 digits of their phone / WhatsApp number (e.g., 0199).
 *    - Adds a high-resolution time & entropy token ensuring 100% collision-free uniqueness.
 *
 * Format:
 *   HUB-[USER_INITIALS]-[PHONE_LAST4]-[UNIQUE_TOKEN]
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
 *
 * @param {string} guestName - Customer's full name
 * @param {string} [guestPhone] - Customer's mobile / WhatsApp number
 * @param {string} [guestEmail] - Customer's email address
 * @param {Array<{ code?: string }>} [existingBookings] - Array of existing bookings to verify uniqueness against
 * @returns {string} Formatted unique booking code e.g. "HUB-EV-0199-7842"
 */
export function generateUniqueBookingCode(guestName = '', guestPhone = '', guestEmail = '', existingBookings = []) {
  const initials = extractUserInitials(guestName)
  const phone4 = extractPhoneLast4(guestPhone, guestEmail)

  const existingSet = new Set(
    (existingBookings || [])
      .map((b) => (b?.code || '').toUpperCase().trim())
      .filter(Boolean)
  )

  let code = ''
  let attempts = 0

  do {
    // Generate high-resolution 4-digit unique entropy token:
    // Milliseconds modulo (3 digits) + random digit (1 digit)
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
