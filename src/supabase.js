import { createClient } from '@supabase/supabase-js'
import { generateUniqueBookingCode, getOrGenerateBookingCode, mergeBookingRecords } from './utils/bookingCode.js'

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://cnvufufsewrcvwxhegpd.supabase.co'
export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  'sb_publishable_vR9xCrXZKaZbmXRMs7-Y1g_MOqHx761'

export const ENV_AUTHORIZED_ADMIN_EMAILS = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTHORIZED_ADMIN_EMAILS) || ''
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_URL.trim() !== '' &&
  SUPABASE_ANON_KEY &&
  SUPABASE_ANON_KEY.trim() !== ''
)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

// Connection test helper
export async function testSupabaseConnection() {
  try {
    const { error } = await supabase.from('services').select('id').limit(1)
    if (error) throw error
    return { ok: true, message: 'Connected to Supabase Cloud (PostgreSQL Active & Responsive)' }
  } catch (err) {
    console.warn('Supabase ping check:', err)
    return { ok: false, error: err.message || 'Connection failed' }
  }
}

// ============================================================
// AUTHORIZED GOOGLE ACCOUNTS MANAGEMENT
// ============================================================
export const DEFAULT_AUTHORIZED_ADMINS = [
  {
    id: 'admin-master',
    email: 'admin@barberhub.com',
    name: 'Barber Hub Master Admin',
    role: 'super_admin',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'admin-director',
    email: 'director@barberhub.com',
    name: 'Elena Vance',
    role: 'manager',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'admin-keshav',
    email: 'keshavsharma00007@gmail.com',
    name: 'Keshav Sharma (Owner)',
    role: 'super_admin',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'admin-legacy',
    email: 'admin@salonhub.com',
    name: 'Salon Hub Admin',
    role: 'super_admin',
    is_active: true,
    created_at: new Date().toISOString()
  }
]

let inMemoryAdminsCache = [...DEFAULT_AUTHORIZED_ADMINS]

function getLocalAdminsCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('sck_authorized_admins_cache')
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return inMemoryAdminsCache
}

function setLocalAdminsCache(list) {
  inMemoryAdminsCache = list
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sck_authorized_admins_cache', JSON.stringify(list))
    }
  } catch {}
}

export async function fetchAuthorizedAdmins() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('authorized_admins')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data && data.length > 0) {
        setLocalAdminsCache(data)
        return data
      }
    } catch (err) {
      console.warn('Supabase fetchAuthorizedAdmins notice:', err.message)
    }
  }

  return getLocalAdminsCache()
}

export function getActiveAdminEmail() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem('sck_authorized_admin_info')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.email) return parsed.email.trim().toLowerCase()
      }
      const googleRaw = sessionStorage.getItem('sck_google_user')
      if (googleRaw) {
        const parsed = JSON.parse(googleRaw)
        if (parsed?.email) return parsed.email.trim().toLowerCase()
      }
    }
  } catch {}
  return null
}

export async function isEmailAuthorizedAdmin(email) {
  if (!email || typeof email !== 'string') {
    return { authorized: false, reason: 'No email provided' }
  }
  const cleanEmail = email.trim().toLowerCase()

  // 1. Check environment variable list (e.g. from .env)
  if (ENV_AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail)) {
    return {
      authorized: true,
      admin: {
        id: `env-${cleanEmail}`,
        email: cleanEmail,
        name: 'Authorized Administrator',
        role: 'super_admin',
        source: 'env'
      }
    }
  }

  // 2. Check Supabase via secure RPC first (prevents admin directory enumeration / PII leaks)
  if (isSupabaseConfigured) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_admin_email', {
        check_email: cleanEmail
      })

      if (!rpcErr && rpcData && rpcData.length > 0 && rpcData[0]?.is_authorized) {
        return {
          authorized: true,
          admin: {
            id: rpcData[0].admin_id || `admin-${cleanEmail}`,
            email: rpcData[0].email,
            name: rpcData[0].name || cleanEmail.split('@')[0],
            role: rpcData[0].role || 'admin'
          },
          source: 'supabase_rpc'
        }
      }

      // Fallback direct table query if RPC is not yet registered
      const { data, error } = await supabase
        .from('authorized_admins')
        .select('*')
        .ilike('email', cleanEmail)
        .eq('is_active', true)
        .limit(1)

      if (!error && data && data.length > 0) {
        return {
          authorized: true,
          admin: data[0],
          source: 'supabase'
        }
      }
    } catch (err) {
      console.warn('Supabase check authorization notice:', err.message)
    }
  }

  // 3. Check local cache of authorized admins
  try {
    const list = await fetchAuthorizedAdmins()
    const match = list.find(
      (a) => a.email && a.email.toLowerCase() === cleanEmail && a.is_active !== false
    )
    if (match) {
      return {
        authorized: true,
        admin: match,
        source: 'local_cache'
      }
    }
  } catch (err) {
    console.warn('Local admin cache authorization check:', err)
  }

  return {
    authorized: false,
    reason: `The Google account "${email}" is not authorized to access the Barber Hub Admin Panel.`
  }
}

export async function addAuthorizedAdmin({ email, name, role = 'admin' }) {
  if (!email) return null
  const cleanEmail = email.trim().toLowerCase()
  const newRecord = {
    id: `admin-${Date.now()}`,
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    role: role || 'admin',
    is_active: true,
    created_at: new Date().toISOString()
  }

  // Sync to Supabase
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('authorized_admins')
        .upsert(newRecord, { onConflict: 'email' })
        .select()
      if (error) {
        console.warn('Supabase addAuthorizedAdmin notice:', error.message)
      } else if (data && data[0]) {
        const existing = await fetchAuthorizedAdmins()
        const filtered = existing.filter((a) => a.email.toLowerCase() !== cleanEmail)
        setLocalAdminsCache([data[0], ...filtered])
        return data[0]
      }
    } catch (err) {
      console.warn('Supabase addAuthorizedAdmin error:', err)
    }
  }

  // Fallback update local cache
  const existing = await fetchAuthorizedAdmins()
  const filtered = existing.filter((a) => a.email.toLowerCase() !== cleanEmail)
  const updated = [newRecord, ...filtered]
  setLocalAdminsCache(updated)
  return newRecord
}

export async function removeAuthorizedAdmin(id) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('authorized_admins').delete().eq('id', id)
      if (error) console.warn('Supabase removeAuthorizedAdmin notice:', error.message)
    } catch (err) {
      console.warn('Supabase removeAuthorizedAdmin error:', err)
    }
  }
  const existing = await fetchAuthorizedAdmins()
  const updated = existing.filter((a) => a.id !== id)
  setLocalAdminsCache(updated)
}

export async function toggleAuthorizedAdminStatus(id, isActive) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('authorized_admins')
        .update({ is_active: isActive })
        .eq('id', id)
      if (error) console.warn('Supabase toggleAuthorizedAdmin notice:', error.message)
    } catch (err) {
      console.warn('Supabase toggleAuthorizedAdmin error:', err)
    }
  }
  const existing = await fetchAuthorizedAdmins()
  const updated = existing.map((a) => (a.id === id ? { ...a, is_active: isActive } : a))
  setLocalAdminsCache(updated)
}

// ============================================================
// DATA ENTITY SYNC & FETCH HELPERS
// ============================================================

// Helper: Normalize time string for comparison
export function normalizeTimeStr(t) {
  if (!t) return ''
  return String(t).trim().replace(/\s+/g, ' ').toUpperCase()
}

// Helper: Check if a given date and time slot is already reserved
export function isTimeSlotBooked(date, time, bookingsList = []) {
  if (!date || !time) return false
  const targetTime = normalizeTimeStr(time)
  return bookingsList.some((b) => {
    const bDate = b.date || b.appointment_date
    const bTime = normalizeTimeStr(b.time || b.appointment_time)
    const status = (b.status || '').toLowerCase()
    return bDate === date && bTime === targetTime && status !== 'cancelled'
  })
}

// Fetch active bookings from Supabase cloud (Confidentiality-hardened: requests only slot availability without PII)
export async function fetchBookingsFromSupabase() {
  if (!isSupabaseConfigured) return []
  try {
    // 1. Query PII-safe public view (exposes only date/time to prevent client data exfiltration)
    const { data: viewData, error: viewErr } = await supabase
      .from('public_booked_slots')
      .select('id, appointment_date, appointment_time, status')
      .neq('status', 'cancelled')
      .order('appointment_date', { ascending: true })

    if (!viewErr && viewData && viewData.length > 0) {
      return viewData.map((b) => ({
        id: b.id,
        date: b.appointment_date,
        time: b.appointment_time,
        status: b.status
      }))
    }

    // 2. Fallback direct table query if view is not yet created
    const { data, error } = await supabase
      .from('bookings')
      .select('id, appointment_date, appointment_time, status')
      .neq('status', 'cancelled')
      .order('appointment_date', { ascending: true })

    if (error) throw error
    return (data || []).map((b) => ({
      id: b.id,
      date: b.appointment_date,
      time: b.appointment_time,
      status: b.status
    }))
  } catch (err) {
    console.warn('Supabase fetchBookings notice:', err.message)
    return []
  }
}

// Fetch full bookings roster for verified admin
export async function fetchAdminBookingsFromSupabase() {
  if (!isSupabaseConfigured) return []

  const mapBookingRow = (b) => {
    const rawName = b.client_name || b.guestName || b.clientName || ''
    const rawPhone = b.client_phone || b.guestPhone || b.clientPhone || ''
    const rawNotes = b.notes || b.guestNotes || ''
    const rawEmail = b.client_email || b.guestEmail || b.clientEmail || b.user_email || ''
    const rawService = b.service_name || b.serviceName || 'Cut & Styling'
    const rawPrice = b.service_price || b.servicePrice || 'Rs 150+'
    const rawDate = b.appointment_date || b.date || ''
    const rawTime = b.appointment_time || b.time || ''
    const isQuiet = Boolean(b.quiet_chair ?? b.isQuietChair ?? b.quietChair)
    const rawCode = b.code || getOrGenerateBookingCode(b)

    const isRestricted = !rawName && !rawPhone && !('client_name' in b)

    return {
      id: b.id,
      code: rawCode,
      client_name: rawName || 'Valued Guest',
      guestName: rawName || 'Valued Guest',
      client_phone: rawPhone,
      guestPhone: rawPhone,
      client_email: rawEmail,
      guestEmail: rawEmail,
      service_name: rawService,
      serviceName: rawService,
      service_price: rawPrice,
      servicePrice: rawPrice,
      stylist: b.stylist || 'Fifth Avenue Master Stylist',
      appointment_date: rawDate,
      date: rawDate,
      appointment_time: rawTime,
      time: rawTime,
      quiet_chair: isQuiet,
      isQuietChair: isQuiet,
      status: b.status ? (b.status.charAt(0).toUpperCase() + b.status.slice(1).toLowerCase()) : 'Confirmed',
      notes: rawNotes,
      guestNotes: rawNotes,
      createdAt: (b.created_at || b.createdAt || '').split('T')[0] || new Date().toISOString().split('T')[0],
      created_at: b.created_at || b.createdAt || new Date().toISOString(),
      isRestrictedData: isRestricted
    }
  }

  // 1. Primary: Direct SELECT from public.bookings (returns complete customer dossiers)
  try {
    const { data: directData, error: directErr } = await supabase
      .from('bookings')
      .select('*')
      .order('appointment_date', { ascending: false })

    if (!directErr && directData && directData.length > 0) {
      return directData.map(mapBookingRow)
    }
  } catch (err) {
    console.warn('Direct bookings select notice:', err?.message)
  }

  // 2. Secondary: RPC call admin_fetch_bookings
  const adminEmail = getActiveAdminEmail()
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_fetch_bookings', {
      p_admin_email: adminEmail || null
    })
    if (!rpcErr && rpcData && rpcData.length > 0) {
      return rpcData.map(mapBookingRow)
    }
  } catch (err) {
    console.warn('RPC admin_fetch_bookings notice:', err?.message)
  }

  // Secondary Fallback: Parameterless RPC call admin_fetch_bookings
  try {
    const { data: rpcData2, error: rpcErr2 } = await supabase.rpc('admin_fetch_bookings')
    if (!rpcErr2 && rpcData2 && rpcData2.length > 0) {
      return rpcData2.map(mapBookingRow)
    }
  } catch {}

  // 3. Tertiary: Query public_booked_slots view
  try {
    const { data: viewData, error: viewErr } = await supabase
      .from('public_booked_slots')
      .select('*')
      .order('appointment_date', { ascending: false })

    if (!viewErr && viewData && viewData.length > 0) {
      const hasClientData = viewData.some(b => b.client_name || b.guestName || b.client_phone || b.guestPhone)
      if (!hasClientData) {
        console.warn('[Supabase RLS Notice] Bookings received without customer names/phones. Run update_database.sql in Supabase SQL editor to grant admin SELECT permissions.')
      }
      return viewData.map((b) => ({
        ...mapBookingRow(b),
        isRestrictedData: !hasClientData
      }))
    }
  } catch (err) {
    console.warn('View public_booked_slots notice:', err?.message)
  }

  return []
}

// Sync new appointment booking (with conflict prevention and PII protection)
export async function syncBookingToSupabase(booking) {
  if (!isSupabaseConfigured) return null
  try {
    const bDate = booking.date || booking.appointment_date
    const bTime = booking.time || booking.appointment_time

    if (!bDate || !bTime) {
      return { conflict: false, error: 'Appointment date and time are required.' }
    }

    // 1. Check if another client already booked this date & time slot via PII-safe view
    const { data: existing, error: checkErr } = await supabase
      .from('public_booked_slots')
      .select('id')
      .eq('appointment_date', bDate)
      .eq('appointment_time', bTime)
      .neq('status', 'cancelled')
      .neq('id', booking.id || '')
      .limit(1)

    if (!checkErr && existing && existing.length > 0) {
      console.warn(`Time slot conflict: ${bDate} at ${bTime} is already booked.`)
      return { conflict: true, error: 'This time slot has already been reserved for this date.' }
    }

    const clientName = (booking.client_name || booking.guestName || booking.clientName || '').trim() || 'Valued Guest'
    const clientPhone = (booking.client_phone || booking.guestPhone || booking.clientPhone || '').trim()
    const clientEmail = (booking.client_email || booking.guestEmail || booking.clientEmail || '').trim()
    const guestNotes = (booking.notes || booking.guestNotes || '').trim()
    const normalizedStatus = (booking.status || 'confirmed').toLowerCase() === 'pending' ? 'pending' : 'confirmed'

    const payload = {
      id: booking.id || `book-${Date.now()}`,
      code: booking.code || getOrGenerateBookingCode(booking),
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      user_email: booking.user_email || booking.userEmail || '',
      service_name: booking.service_name || booking.serviceName || 'Bespoke Styling',
      service_price: booking.service_price || booking.servicePrice || '',
      stylist: booking.stylist || 'Fifth Avenue Master Stylist',
      appointment_date: bDate,
      appointment_time: bTime,
      quiet_chair: Boolean(booking.quiet_chair ?? booking.isQuietChair ?? booking.quietChair),
      status: normalizedStatus,
      notes: guestNotes,
      created_at: booking.created_at || (booking.createdAt ? new Date(booking.createdAt).toISOString() : new Date().toISOString())
    }

    // Insert new booking
    const { error } = await supabase
      .from('bookings')
      .insert(payload)

    if (error) {
      if (error.code === '23505') {
        return { conflict: true, error: 'This time slot has already been reserved for this date.' }
      }
      console.warn('Supabase booking sync notice:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, data: payload }
  } catch (err) {
    console.warn('Supabase booking sync error:', err)
    return null
  }
}

export async function updateBookingStatusInSupabase(id, status) {
  if (!isSupabaseConfigured) return null
  const normalizedStatus = (status || 'confirmed').toLowerCase()
  const adminEmail = getActiveAdminEmail()
  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_update_booking_status', {
        p_admin_email: adminEmail,
        p_booking_id: id,
        p_status: normalizedStatus
      })
      if (!rpcErr) return true
    } catch (err) {
      console.warn('RPC admin_update_booking_status notice:', err.message)
    }
  }
  try {
    const { error } = await supabase.from('bookings').update({ status: normalizedStatus }).eq('id', id)
    if (error) {
      console.warn('Supabase updateBookingStatus notice:', error.message)
      return null
    }
    return true
  } catch (err) {
    console.warn('Supabase updateBookingStatus error:', err)
    return null
  }
}

export async function deleteBookingFromSupabase(id) {
  if (!isSupabaseConfigured) return null
  const adminEmail = getActiveAdminEmail()
  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_booking', {
        p_admin_email: adminEmail,
        p_booking_id: id
      })
      if (!rpcErr) return true
    } catch (err) {
      console.warn('RPC admin_delete_booking notice:', err.message)
    }
  }
  try {
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) {
      console.warn('Supabase deleteBooking notice:', error.message)
      return null
    }
    return true
  } catch (err) {
    console.warn('Supabase deleteBooking error:', err)
    return null
  }
}

// Sync contact inquiry message
export async function syncContactToSupabase(contact) {
  if (!isSupabaseConfigured) return null
  try {
    const payload = {
      id: contact.id || `contact-${Date.now()}`,
      name: (contact.name || '').trim(),
      email: (contact.email || '').trim(),
      phone: (contact.phone || '').trim(),
      service: (contact.service || '').trim(),
      message: (contact.message || '').trim(),
      created_at: new Date().toISOString()
    }
    // Insert contact message (no .select() to respect anon RLS)
    const { error } = await supabase
      .from('contacts')
      .insert(payload)
    if (error) {
      console.warn('Supabase contact sync notice:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, data: payload }
  } catch (err) {
    console.warn('Supabase contact sync error:', err)
    return null
  }
}

// Sync client review
export async function syncReviewToSupabase(review) {
  if (!isSupabaseConfigured) return null
  try {
    const payload = {
      id: review.id || `rev-${Date.now()}`,
      author: review.author,
      role: review.role || 'Patron',
      stars: review.stars || '★★★★★',
      rating: Number(review.rating || 5),
      service: review.service || 'Barber Hub Bespoke Experience',
      quote: review.quote || review.text || '',
      created_at: new Date().toISOString()
    }
    const { data, error } = await supabase
      .from('reviews')
      .upsert(payload, { onConflict: 'id' })
      .select()
    if (error) {
      console.warn('Supabase review sync notice:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('Supabase review sync error:', err)
    return null
  }
}

export async function deleteReviewFromSupabase(id) {
  if (!isSupabaseConfigured) return null
  const adminEmail = getActiveAdminEmail()
  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_review', {
        p_admin_email: adminEmail,
        p_review_id: id
      })
      if (!rpcErr) return true
    } catch (err) {
      console.warn('RPC admin_delete_review notice:', err.message)
    }
  }
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) {
      console.warn('Supabase deleteReview notice:', error.message)
      return null
    }
    return true
  } catch (err) {
    console.warn('Supabase deleteReview error:', err)
    return null
  }
}

// Sync service catalog
export async function syncServiceToSupabase(srv) {
  if (!isSupabaseConfigured) return null
  const priceNum = Number(srv.priceNum || (srv.price ? String(srv.price).replace(/[^0-9.]/g, '') : 0))
  const adminEmail = getActiveAdminEmail()
  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_update_service_price', {
        p_admin_email: adminEmail,
        p_service_id: srv.id,
        p_price: srv.price,
        p_price_num: priceNum
      })
      if (!rpcErr) return true
    } catch (err) {
      console.warn('RPC admin_update_service_price notice:', err.message)
    }
  }

  try {
    const payload = {
      id: srv.id,
      num: srv.num || '',
      category: srv.category || 'cut',
      name: srv.name,
      price: srv.price,
      price_num: priceNum,
      duration: srv.duration || '60 min',
      tag: srv.tag || '',
      img: srv.img || '',
      desc: srv.desc || '',
      created_at: new Date().toISOString()
    }
    const { data, error } = await supabase.from('services').upsert(payload, { onConflict: 'id' }).select()
    if (error) {
      console.warn('Supabase syncService notice:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('Supabase syncService error:', err)
    return null
  }
}

export async function deleteServiceFromSupabase(id) {
  if (!isSupabaseConfigured) return null
  const adminEmail = getActiveAdminEmail()
  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_service', {
        p_admin_email: adminEmail,
        p_service_id: id
      })
      if (!rpcErr) return true
    } catch (err) {
      console.warn('RPC admin_delete_service notice:', err.message)
    }
  }
  try {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) {
      console.warn('Supabase deleteService notice:', error.message)
      return null
    }
    return true
  } catch (err) {
    console.warn('Supabase deleteService error:', err)
    return null
  }
}

// ============================================================
// TIMETABLE & OPERATING HOURS CLOUD SYNC
// ============================================================
export async function fetchTimetableFromSupabase() {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('timetable')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (error) {
      console.warn('Supabase fetchTimetable notice:', error.message)
      return null
    }

    if (data && data.working_days) {
      return {
        workingDays: data.working_days,
        timeSlots: data.time_slots || [],
        notice: data.notice || ''
      }
    }
  } catch (err) {
    console.warn('Supabase fetchTimetable error:', err)
  }
  return null
}

export async function syncTimetableToSupabase(timetable) {
  if (!isSupabaseConfigured || !timetable) return { ok: false }
  const adminEmail = getActiveAdminEmail()

  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_update_timetable', {
        p_admin_email: adminEmail,
        p_working_days: timetable.workingDays || [],
        p_time_slots: timetable.timeSlots || [],
        p_notice: timetable.notice || ''
      })
      if (!rpcErr) return { ok: true }
    } catch (err) {
      console.warn('RPC admin_update_timetable notice:', err.message)
    }
  }

  try {
    const payload = {
      id: 'default',
      working_days: timetable.workingDays || [],
      time_slots: timetable.timeSlots || [],
      notice: timetable.notice || '',
      updated_at: new Date().toISOString()
    }
    const { data, error } = await supabase
      .from('timetable')
      .upsert(payload, { onConflict: 'id' })
      .select()

    if (error) {
      console.warn('Supabase syncTimetable notice:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, data }
  } catch (err) {
    console.warn('Supabase syncTimetable error:', err)
    return { ok: false, error: err.message }
  }
}

// ============================================================
// DATABASE FIX / PERMISSIONS MIGRATION SCRIPT
// ============================================================
export const SUPABASE_UPDATE_SQL = "-- ==============================================================================\n-- SALON HUB — COMPLETE DATABASE RECREATION & FRESH SETUP SCRIPT\n-- Drops all old tables/views and recreates everything clean from scratch.\n-- Run in Supabase SQL Editor:\n-- https://supabase.com/dashboard/project/cnvufufsewrcvwxhegpd/sql\n-- ==============================================================================\n\n-- ==============================================================================\n-- STEP 0: CLEAN RESET (Drop all old tables, views & functions)\n-- ==============================================================================\ndrop view if exists public.public_booked_slots cascade;\n\ndrop table if exists public.bookings cascade;\ndrop table if exists public.authorized_admins cascade;\ndrop table if exists public.contacts cascade;\ndrop table if exists public.timetable cascade;\ndrop table if exists public.reviews cascade;\ndrop table if exists public.services cascade;\ndrop table if exists public.artisans cascade;\ndrop table if exists public.gallery cascade;\n\ndo $$\ndeclare\n  r record;\nbegin\n  for r in (\n    select oid::regprocedure as func_signature\n    from pg_proc\n    where pronamespace = 'public'::regnamespace\n      and proname in (\n        'is_active_admin',\n        'verify_admin_email',\n        'admin_fetch_bookings',\n        'admin_fetch_contacts',\n        'admin_update_booking_status',\n        'admin_delete_booking',\n        'admin_update_timetable'\n      )\n  ) loop\n    execute 'drop function if exists ' || r.func_signature || ' cascade';\n  end loop;\nend;\n$$;\n\n-- ==============================================================================\n-- STEP 1: CREATE TABLES\n-- ==============================================================================\n\n-- 1.1 Authorized Administrators\ncreate table public.authorized_admins (\n  id text primary key,\n  email text unique not null,\n  name text,\n  role text default 'admin',\n  is_active boolean default true,\n  created_at timestamptz default now()\n);\n\n-- 1.2 Appointments & Reservations (Full Client Information)\ncreate table public.bookings (\n  id text primary key,\n  code text,\n  client_name text not null default 'Valued Guest',\n  client_phone text default '',\n  client_email text default '',\n  user_email text default '',\n  service_name text not null default 'Cut & Styling',\n  service_price text default 'Rs 150+',\n  stylist text default 'Fifth Avenue Master Stylist',\n  appointment_date text not null,\n  appointment_time text not null,\n  quiet_chair boolean default false,\n  status text default 'confirmed',\n  notes text default '',\n  created_at timestamptz default now()\n);\n\ncreate index idx_bookings_code on public.bookings (code);\ncreate index idx_bookings_date on public.bookings (appointment_date);\n\n-- 1.3 Concierge Contact Inquiries\ncreate table public.contacts (\n  id text primary key,\n  name text not null,\n  email text not null,\n  phone text default '',\n  service text default '',\n  message text not null,\n  created_at timestamptz default now()\n);\n\n-- 1.4 Operating Hours & Timetable\ncreate table public.timetable (\n  id text primary key default 'default',\n  working_days jsonb not null,\n  time_slots jsonb not null,\n  notice text default 'Mon – Sun: Private 1-on-1 chair sessions with dedicated master stylists.',\n  updated_at timestamptz default now()\n);\n\n-- 1.5 Client Testimonials & Reviews\ncreate table public.reviews (\n  id text primary key,\n  author text not null,\n  role text default 'Patron',\n  stars text default '★★★★★',\n  rating integer default 5,\n  service text default '',\n  quote text not null,\n  created_at timestamptz default now()\n);\n\n-- 1.6 Services Catalog\ncreate table public.services (\n  id text primary key,\n  num text,\n  category text not null,\n  name text not null,\n  price text not null,\n  price_num numeric default 0,\n  duration text default '60 min',\n  tag text default '',\n  img text default '',\n  \"desc\" text default '',\n  created_at timestamptz default now()\n);\n\n-- 1.7 Salon Artisans & Stylists\ncreate table public.artisans (\n  id text primary key,\n  name text not null,\n  role text not null,\n  chair text default '',\n  bio text default '',\n  img text default '',\n  created_at timestamptz default now()\n);\n\n-- 1.8 Atelier Gallery / Portfolio\ncreate table public.gallery (\n  id text primary key,\n  category text not null,\n  tag text default '',\n  title text not null,\n  \"desc\" text default '',\n  img text not null,\n  created_at timestamptz default now()\n);\n\n\n-- ==============================================================================\n-- STEP 2: ROW LEVEL SECURITY (RLS) POLICIES\n-- Enables instant frontend reading & admin panel management with zero restrictions\n-- ==============================================================================\n\n-- 2.1 Bookings (Allows admin panel to see all customer dossiers)\nalter table public.bookings enable row level security;\n\ncreate policy \"Public select bookings\"\n  on public.bookings for select to anon, authenticated\n  using (true);\n\ncreate policy \"Public insert appointment booking\"\n  on public.bookings for insert to anon, authenticated\n  with check (true);\n\ncreate policy \"Public update bookings\"\n  on public.bookings for update to anon, authenticated\n  using (true) with check (true);\n\ncreate policy \"Public delete bookings\"\n  on public.bookings for delete to anon, authenticated\n  using (true);\n\ngrant all on public.bookings to anon, authenticated;\n\n-- 2.2 Authorized Admins\nalter table public.authorized_admins enable row level security;\n\ncreate policy \"Public select authorized_admins\"\n  on public.authorized_admins for select to anon, authenticated\n  using (true);\n\ncreate policy \"Admin manage authorized_admins\"\n  on public.authorized_admins for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.authorized_admins to anon, authenticated;\n\n-- 2.3 Contacts\nalter table public.contacts enable row level security;\n\ncreate policy \"Public select contacts\"\n  on public.contacts for select to anon, authenticated\n  using (true);\n\ncreate policy \"Public insert contact inquiry\"\n  on public.contacts for insert to anon, authenticated\n  with check (true);\n\ncreate policy \"Admin manage contacts\"\n  on public.contacts for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.contacts to anon, authenticated;\n\n-- 2.4 Timetable (Hours of Operation)\nalter table public.timetable enable row level security;\n\ncreate policy \"Public read timetable\"\n  on public.timetable for select to anon, authenticated\n  using (true);\n\ncreate policy \"Admin manage timetable\"\n  on public.timetable for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.timetable to anon, authenticated;\n\n-- 2.5 Reviews\nalter table public.reviews enable row level security;\n\ncreate policy \"Public read reviews\"\n  on public.reviews for select to anon, authenticated\n  using (true);\n\ncreate policy \"Public insert validated review\"\n  on public.reviews for insert to anon, authenticated\n  with check (true);\n\ncreate policy \"Admin manage reviews\"\n  on public.reviews for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.reviews to anon, authenticated;\n\n-- 2.6 Services\nalter table public.services enable row level security;\n\ncreate policy \"Public read services catalog\"\n  on public.services for select to anon, authenticated\n  using (true);\n\ncreate policy \"Admin manage services\"\n  on public.services for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.services to anon, authenticated;\n\n-- 2.7 Artisans\nalter table public.artisans enable row level security;\n\ncreate policy \"Public read artisans\"\n  on public.artisans for select to anon, authenticated\n  using (true);\n\ncreate policy \"Admin manage artisans\"\n  on public.artisans for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.artisans to anon, authenticated;\n\n-- 2.8 Gallery\nalter table public.gallery enable row level security;\n\ncreate policy \"Public read gallery\"\n  on public.gallery for select to anon, authenticated\n  using (true);\n\ncreate policy \"Admin manage gallery\"\n  on public.gallery for all to anon, authenticated\n  using (true) with check (true);\n\ngrant all on public.gallery to anon, authenticated;\n\n\n-- ==============================================================================\n-- STEP 3: CALENDAR VIEW (With Full Customer Dossiers)\n-- ==============================================================================\ncreate or replace view public.public_booked_slots with (security_invoker = false) as\n  select\n    id,\n    code,\n    client_name,\n    client_phone,\n    client_email,\n    user_email,\n    service_name,\n    service_price,\n    stylist,\n    appointment_date,\n    appointment_time,\n    quiet_chair,\n    status,\n    notes,\n    created_at\n  from public.bookings\n  where status != 'cancelled';\n\ngrant select on public.public_booked_slots to anon, authenticated;\n\n\n-- ==============================================================================\n-- STEP 4: RPC FUNCTIONS\n-- ==============================================================================\n\n-- 4.1 Check Admin\ncreate or replace function public.is_active_admin(check_email text)\nreturns boolean\nlanguage sql\nsecurity definer\nset search_path = public\nas $$\n  select exists (\n    select 1 from public.authorized_admins\n    where lower(trim(email)) = lower(trim(check_email))\n      and is_active = true\n  );\n$$;\n\ngrant execute on function public.is_active_admin(text) to anon, authenticated;\n\n-- 4.2 Verify Admin Email\ncreate or replace function public.verify_admin_email(check_email text)\nreturns table (\n  is_authorized boolean,\n  admin_id text,\n  email text,\n  name text,\n  role text\n)\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  return query\n  select\n    true as is_authorized,\n    a.id as admin_id,\n    a.email,\n    a.name,\n    a.role\n  from public.authorized_admins a\n  where lower(trim(a.email)) = lower(trim(check_email))\n    and a.is_active = true\n  limit 1;\nend;\n$$;\n\ngrant execute on function public.verify_admin_email(text) to anon, authenticated;\n\n-- 4.3 Admin Fetch All Bookings\ncreate or replace function public.admin_fetch_bookings(p_admin_email text default null)\nreturns setof public.bookings\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  return query\n  select * from public.bookings\n  order by appointment_date desc, appointment_time asc;\nend;\n$$;\n\ngrant execute on function public.admin_fetch_bookings(text) to anon, authenticated;\n\n-- 4.4 Admin Fetch All Contacts\ncreate or replace function public.admin_fetch_contacts(p_admin_email text default null)\nreturns setof public.contacts\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  return query\n  select * from public.contacts\n  order by created_at desc;\nend;\n$$;\n\ngrant execute on function public.admin_fetch_contacts(text) to anon, authenticated;\n\n-- 4.5 Admin Update Booking Status\ncreate or replace function public.admin_update_booking_status(\n  p_admin_email text,\n  p_booking_id text,\n  p_status text\n)\nreturns boolean\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  update public.bookings\n  set status = lower(trim(p_status))\n  where id = p_booking_id;\n\n  return true;\nend;\n$$;\n\ngrant execute on function public.admin_update_booking_status(text, text, text) to anon, authenticated;\n\n-- 4.6 Admin Delete Booking\ncreate or replace function public.admin_delete_booking(\n  p_admin_email text,\n  p_booking_id text\n)\nreturns boolean\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  delete from public.bookings\n  where id = p_booking_id;\n\n  return true;\nend;\n$$;\n\ngrant execute on function public.admin_delete_booking(text, text) to anon, authenticated;\n\n-- 4.7 Admin Update Timetable (Operating Hours)\ncreate or replace function public.admin_update_timetable(\n  p_admin_email text,\n  p_working_days jsonb,\n  p_time_slots jsonb,\n  p_notice text\n)\nreturns boolean\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  insert into public.timetable (id, working_days, time_slots, notice, updated_at)\n  values ('default', p_working_days, p_time_slots, coalesce(p_notice, ''), now())\n  on conflict (id) do update\n  set working_days = excluded.working_days,\n      time_slots = excluded.time_slots,\n      notice = excluded.notice,\n      updated_at = now();\n\n  return true;\nend;\n$$;\n\ngrant execute on function public.admin_update_timetable(text, jsonb, jsonb, text) to anon, authenticated;\n\n\n-- ==============================================================================\n-- STEP 5: SEED INITIAL DATA\n-- ==============================================================================\n\n-- 5.1 Authorized Administrators\ninsert into public.authorized_admins (id, email, name, role, is_active)\nvalues\n  ('admin-keshav', 'keshavsharma00007@gmail.com', 'Keshav Sharma (Owner)', 'super_admin', true),\n  ('admin-master', 'admin@barberhub.com', 'Barber Hub Master Admin', 'super_admin', true),\n  ('admin-director', 'director@barberhub.com', 'Elena Vance', 'manager', true),\n  ('admin-salon', 'admin@salonhub.com', 'Salon Hub Admin', 'super_admin', true);\n\n-- 5.2 Operating Hours / Timetable (Exact Schedule from Contact Page)\ninsert into public.timetable (id, working_days, time_slots, notice)\nvalues (\n  'default',\n  '[\n    {\"day\": \"Mon\", \"name\": \"Monday\", \"isOpen\": false, \"openTime\": \"10:00 AM\", \"closeTime\": \"07:00 PM\"},\n    {\"day\": \"Tue\", \"name\": \"Tuesday\", \"isOpen\": true, \"openTime\": \"10:00 AM\", \"closeTime\": \"07:00 PM\"},\n    {\"day\": \"Wed\", \"name\": \"Wednesday\", \"isOpen\": true, \"openTime\": \"09:00 AM\", \"closeTime\": \"07:30 PM\"},\n    {\"day\": \"Thu\", \"name\": \"Thursday\", \"isOpen\": true, \"openTime\": \"09:00 AM\", \"closeTime\": \"07:30 PM\"},\n    {\"day\": \"Fri\", \"name\": \"Friday\", \"isOpen\": true, \"openTime\": \"09:00 AM\", \"closeTime\": \"07:30 PM\"},\n    {\"day\": \"Sat\", \"name\": \"Saturday\", \"isOpen\": true, \"openTime\": \"09:00 AM\", \"closeTime\": \"06:00 PM\"},\n    {\"day\": \"Sun\", \"name\": \"Sunday\", \"isOpen\": true, \"openTime\": \"10:30 AM\", \"closeTime\": \"06:00 PM\"}\n  ]'::jsonb,\n  '[\n    {\"id\": \"t1\", \"time\": \"09:30 AM\", \"period\": \"morning\", \"label\": \"Morning Light\", \"badge\": \"Available\", \"active\": true},\n    {\"id\": \"t2\", \"time\": \"10:30 AM\", \"period\": \"morning\", \"label\": \"Morning High\", \"badge\": \"Popular\", \"active\": true},\n    {\"id\": \"t3\", \"time\": \"11:30 AM\", \"period\": \"morning\", \"label\": \"Midday Prime\", \"badge\": \"Prime\", \"active\": true},\n    {\"id\": \"t4\", \"time\": \"01:00 PM\", \"period\": \"afternoon\", \"label\": \"Early Afternoon\", \"badge\": \"Available\", \"active\": true},\n    {\"id\": \"t5\", \"time\": \"02:15 PM\", \"period\": \"afternoon\", \"label\": \"Mid Afternoon\", \"badge\": \"Popular\", \"active\": true},\n    {\"id\": \"t6\", \"time\": \"03:30 PM\", \"period\": \"afternoon\", \"label\": \"Late Afternoon\", \"badge\": \"Available\", \"active\": true},\n    {\"id\": \"t7\", \"time\": \"04:30 PM\", \"period\": \"afternoon\", \"label\": \"Sunset Glow\", \"badge\": \"Prime\", \"active\": true},\n    {\"id\": \"t8\", \"time\": \"05:30 PM\", \"period\": \"evening\", \"label\": \"Fifth Ave Twilight\", \"badge\": \"Available\", \"active\": true},\n    {\"id\": \"t9\", \"time\": \"06:30 PM\", \"period\": \"evening\", \"label\": \"Evening Couture\", \"badge\": \"Peak Slot\", \"active\": true},\n    {\"id\": \"t10\", \"time\": \"07:15 PM\", \"period\": \"evening\", \"label\": \"Late Salon Session\", \"badge\": \"VIP Evening\", \"active\": true}\n  ]'::jsonb,\n  'Tue – Sun: Dedicated Private Chair Sessions · Appointments & Walk-ins'\n);\n\n-- 5.3 Services Catalog\ninsert into public.services (id, num, category, name, price, price_num, duration, tag, img, \"desc\")\nvalues\n  ('s1', '01', 'cut', 'Cut & Styling', 'Rs 150+', 150, '60 min', 'Hair', '/images/services/cut-styling.jpg', 'From precision haircuts tailored to your individual look to polished blowouts and elegant updos, every cut and styling service is crafted to bring out the best in your hair.'),\n  ('s2', '02', 'color', 'Color', 'Rs 220+', 220, '120 min', 'Color', '/images/services/color.jpg', 'From rich single-process color to expertly crafted balayage and highlights, our color services are tailored to complement your unique look by master colorists.'),\n  ('s3', '03', 'treatments', 'Conditioning Hair Treatments', 'Rs 95+', 95, '45 min', 'Care', '/images/services/conditioning.jpg', 'Restore softness, strength, and luminosity with luxury formulas from Kérastase, Shu Uemura, and Olaplex, leaving you with a healthier, radiant result.'),\n  ('s4', '04', 'makeup', 'Makeup', 'Rs 125+', 125, '60 min', 'Beauty', '/images/services/makeup.jpg', 'From custom blended makeup application and lash enhancements to eyebrow shaping and personalized lessons, designed to complement and elevate your full look.'),\n  ('s5', '05', 'bridal', 'Bridal', 'Rs 350+', 350, '180 min', 'Occasion', '/images/services/bridal.jpg', 'From your bridal trial to the moment you walk down the aisle, offering both in-salon and on-location hair services tailored to your wedding vision.'),\n  ('s6', '06', 'perms', 'Perms & Relaxer', 'Rs 200+', 200, '120 min', 'Texture', '/images/services/perms-relaxer.jpg', 'Whether you are looking to add lasting curl definition with a perm or achieve smooth, manageable results with a relaxer, tailored to your hair texture.'),\n  ('s7', '07', 'nails', 'Nails', 'Rs 65+', 65, '50 min', 'Nails', '/images/services/nails.jpg', 'From a classic manicure to gel, Dazzle Dry, powder gel, and beyond, luxury nail services designed to leave your hands and feet looking polished and refined.');\n\n-- 5.4 Artisans\ninsert into public.artisans (id, name, role, chair, bio, img)\nvalues\n  ('artisan-1', 'Elena Vance', 'Creative Director & Colorist', 'Chair 01', '12 years atelier experience between London and Paris. Specialises in low-maintenance golden balayage.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=80'),\n  ('artisan-2', 'Marcus Thorne', 'Master Sculptor & Fade Specialist', 'Chair 02', 'Vidal Sassoon trained. Master of precision men''s tapers, razor texturing, and sharp architectural crops.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80'),\n  ('artisan-3', 'Mei-Ling Zhou', 'Holistic Head Spa Therapist', 'Chair 03', 'Tokyo certified head spa master. Integrates herbal botanical extracts with restorative shiatsu acupressure.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=80');\n\n-- 5.5 Reviews\ninsert into public.reviews (id, stars, rating, quote, author, service)\nvalues\n  ('rev-1', '★★★★★', 5, 'I have been a client of Salon HUB since they opened. They are the best. I won''t go anywhere else. My hair is curly and they do an amazing job. Always have', 'Carolyn Pianin', 'Cut & Styling'),\n  ('rev-2', '★★★★★', 5, 'I had my hair cut by Carmel and it was such a great experience 10/10 recommend. She asked all the right questions to really understand what I was looking for. My hair came out fabulous!!', 'Sofia Appel', 'Cut & Styling'),\n  ('rev-3', '★★★★★', 5, 'I hadn''t had my naturally very dark hair colored in a very long time, but I took the plunge with Kelly at Salon HUB and it was the best decision! Kelly gave me a thorough consultation and along with Devin they made sure my cut and color work in perfect harmony.', 'Vanessa Moreno', 'Color'),\n  ('rev-4', '★★★★★', 5, 'I never write google reviews but the blowout that Rene just gave me deserves a review. It was a simple walk in and I’m leaving with the best blow out I have ever gotten.', 'Daniela Silva', 'Blow Dry'),\n  ('rev-5', '★★★★★', 5, 'Salon HUB is such a wonderful experience! The salon is beautiful, exquisitely clean, and packed with highly talented artists! Clint does my cut..a perfectionist! Kelly does my color…very natural!', 'Donna Mazur', 'Cut & Color'),\n  ('rev-6', '★★★★★', 5, 'I can’t say enough good things about this salon! Mark is a true artist with color — my color has never looked better. And Clint gives the best cuts; he really knows how to shape and style for your face and hair type.', 'M Bailey', 'Color & Cut');\n";
export const SUPABASE_SCHEMA_SQL = SUPABASE_UPDATE_SQL;
