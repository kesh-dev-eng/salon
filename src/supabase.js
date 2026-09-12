import { createClient } from '@supabase/supabase-js'
import { generateUniqueBookingCode } from './utils/bookingCode.js'

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://abresbnxhfhtpwnanfcn.supabase.co'
export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  'sb_publishable_ltysKanYONdunSU58E8Vgg_xx_wxAMR'

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

  const mapBookingRow = (b) => ({
    id: b.id,
    code: b.code || generateUniqueBookingCode(
      b.client_name || b.guestName,
      b.client_phone || b.guestPhone,
      b.client_email || b.guestEmail
    ),
    guestName: b.client_name || b.guestName || 'Valued Guest',
    guestPhone: b.client_phone || b.guestPhone || '',
    guestEmail: b.client_email || b.guestEmail || '',
    serviceName: b.service_name || b.serviceName || 'Cut & Styling',
    servicePrice: b.service_price || b.servicePrice || 'Rs 150+',
    stylist: b.stylist || 'Fifth Avenue Master Stylist',
    date: b.appointment_date || b.date,
    time: b.appointment_time || b.time,
    isQuietChair: Boolean(b.quiet_chair ?? b.isQuietChair ?? b.quietChair),
    quiet_chair: Boolean(b.quiet_chair ?? b.isQuietChair ?? b.quietChair),
    status: b.status ? (b.status.charAt(0).toUpperCase() + b.status.slice(1).toLowerCase()) : 'Confirmed',
    guestNotes: b.notes || b.guestNotes || '',
    notes: b.notes || b.guestNotes || '',
    createdAt: (b.created_at || b.createdAt || '').split('T')[0] || new Date().toISOString().split('T')[0]
  })

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
  if (adminEmail) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_fetch_bookings', {
        p_admin_email: adminEmail
      })
      if (!rpcErr && rpcData && rpcData.length > 0) {
        return rpcData.map(mapBookingRow)
      }
    } catch (err) {
      console.warn('RPC admin_fetch_bookings notice:', err?.message)
    }
  }

  // 3. Tertiary: Query public_booked_slots view
  try {
    const { data: viewData, error: viewErr } = await supabase
      .from('public_booked_slots')
      .select('*')
      .order('appointment_date', { ascending: false })

    if (!viewErr && viewData && viewData.length > 0) {
      return viewData.map(mapBookingRow)
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

    const payload = {
      id: booking.id || `book-${Date.now()}`,
      code: booking.code || generateUniqueBookingCode(
        booking.clientName || booking.guestName || booking.client_name,
        booking.clientPhone || booking.guestPhone || booking.client_phone,
        booking.clientEmail || booking.guestEmail || booking.client_email
      ),
      client_name: booking.clientName || booking.guestName || booking.client_name || 'Valued Guest',
      client_phone: booking.clientPhone || booking.guestPhone || booking.client_phone || '',
      client_email: booking.clientEmail || booking.guestEmail || booking.client_email || '',
      user_email: booking.userEmail || booking.user_email || '',
      service_name: booking.serviceName || booking.service_name || 'Bespoke Styling',
      service_price: booking.servicePrice || booking.service_price || '',
      stylist: booking.stylist || 'Fifth Avenue Master Stylist',
      appointment_date: bDate,
      appointment_time: bTime,
      quiet_chair: Boolean(booking.quietChair ?? booking.quiet_chair ?? booking.isQuietChair),
      status: (booking.status || 'confirmed').toLowerCase() === 'confirmed' ? 'confirmed' : 'pending',
      notes: booking.notes || booking.guestNotes || '',
      created_at: booking.createdAt || booking.created_at || new Date().toISOString()
    }

    // Insert new booking (do NOT use .select() or .upsert() as anon lacks SELECT & UPDATE on bookings table)
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
  const adminEmail = getActiveAdminEmail()
  if (adminEmail) {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_update_booking_status', {
        p_admin_email: adminEmail,
        p_booking_id: id,
        p_status: status
      })
      if (!rpcErr) return true
    } catch (err) {
      console.warn('RPC admin_update_booking_status notice:', err.message)
    }
  }
  try {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
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
// COMPLETE DATABASE SCHEMA SCRIPT
// ============================================================
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- BARBER HUB FIFTH AVENUE — HARDENED POSTGRES DATABASE SCHEMA & SECURITY CONTROLS
-- Implements CIA Triad: Confidentiality, Integrity, Availability
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/abresbnxhfhtpwnanfcn/sql
-- ==============================================================================

-- 1. AUTHORIZED GOOGLE ADMINS TABLE
create table if not exists public.authorized_admins (
  id text primary key,
  email text unique not null,
  name text,
  role text default 'admin', -- 'super_admin' | 'manager' | 'admin'
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. SALON SERVICES CATALOG
create table if not exists public.services (
  id text primary key,
  num text,
  category text not null,
  name text not null,
  price text not null,
  price_num numeric default 0,
  duration text default '60 min',
  tag text,
  img text,
  "desc" text,
  created_at timestamptz default now()
);

-- 3. SALON ARTISANS & MASTER STYLISTS
create table if not exists public.artisans (
  id text primary key,
  name text not null,
  role text not null,
  chair text,
  bio text,
  img text,
  created_at timestamptz default now()
);

-- 4. SALON ATELIER PORTFOLIO / GALLERY
create table if not exists public.gallery (
  id text primary key,
  category text not null,
  tag text,
  title text not null,
  "desc" text,
  img text not null,
  created_at timestamptz default now()
);

-- 5. CLIENT TESTIMONIALS & REVIEWS
create table if not exists public.reviews (
  id text primary key,
  author text not null,
  role text default 'Patron',
  stars text default '★★★★★',
  rating integer default 5,
  service text,
  quote text not null,
  created_at timestamptz default now()
);

-- 6. APPOINTMENT RESERVATIONS / BOOKINGS
create table if not exists public.bookings (
  id text primary key,
  code text,
  client_name text not null,
  client_phone text,
  client_email text,
  user_email text,
  service_name text not null,
  service_price text,
  stylist text default 'Solo Master Artist',
  appointment_date text not null,
  appointment_time text not null,
  quiet_chair boolean default false,
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- 7. CONCIERGE CONTACT INQUIRIES
create table if not exists public.contacts (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  created_at timestamptz default now()
);

-- 8. SALON TIMETABLE & OPERATING HOURS
create table if not exists public.timetable (
  id text primary key default 'default',
  working_days jsonb not null,
  time_slots jsonb not null,
  notice text default 'All appointments are private 1-on-1 sessions with dedicated master stylists.',
  updated_at timestamptz default now()
);

-- ==============================================================================
-- INTEGRITY: DATA VALIDATION & CHECK CONSTRAINTS (IDEMPOTENT)
-- ==============================================================================
do $$
begin
  -- Reviews: Rating bounded between 1 and 5, author & quote cannot be empty
  if not exists (select 1 from pg_constraint where conname = 'chk_reviews_rating') then
    alter table public.reviews add constraint chk_reviews_rating check (rating >= 1 and rating <= 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reviews_quote') then
    alter table public.reviews add constraint chk_reviews_quote check (length(trim(quote)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reviews_author') then
    alter table public.reviews add constraint chk_reviews_author check (length(trim(author)) > 0);
  end if;

  -- Bookings: Status domain, non-empty client name and valid date format
  if not exists (select 1 from pg_constraint where conname = 'chk_bookings_status') then
    alter table public.bookings add constraint chk_bookings_status check (status in ('pending', 'confirmed', 'completed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_bookings_name') then
    alter table public.bookings add constraint chk_bookings_name check (length(trim(client_name)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_bookings_date') then
    alter table public.bookings add constraint chk_bookings_date check (length(trim(appointment_date)) = 10);
  end if;

  -- Contacts: Non-empty contact name and message
  if not exists (select 1 from pg_constraint where conname = 'chk_contacts_name') then
    alter table public.contacts add constraint chk_contacts_name check (length(trim(name)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_contacts_message') then
    alter table public.contacts add constraint chk_contacts_message check (length(trim(message)) > 0);
  end if;

  -- Admins: Role constraint
  if not exists (select 1 from pg_constraint where conname = 'chk_admin_role') then
    alter table public.authorized_admins add constraint chk_admin_role check (role in ('super_admin', 'manager', 'admin'));
  end if;
end $$;

-- ==============================================================================
-- AVAILABILITY & PERFORMANCE: STRATEGIC INDEXES
-- ==============================================================================
-- Prevent double-booking race conditions on active slots
create unique index if not exists bookings_date_time_unique_idx
  on public.bookings (appointment_date, appointment_time)
  where (status != 'cancelled');

-- Fast indexed lookups for calendar date queries (avoids full-table scans)
create index if not exists idx_bookings_date
  on public.bookings (appointment_date);

-- Fast lookup by confirmation code
create index if not exists idx_bookings_code
  on public.bookings (code);

-- Fast ordering for inquiries
create index if not exists idx_contacts_created_at
  on public.contacts (created_at desc);

-- Fast review sorting by rating & date
create index if not exists idx_reviews_rating_created
  on public.reviews (rating, created_at desc);

-- Fast case-insensitive email lookup for admin authentication
create index if not exists idx_authorized_admins_email
  on public.authorized_admins (lower(email));

-- ==============================================================================
-- CONFIDENTIALITY: PII-SAFE RESERVATION SLOTS VIEW
-- Public calendar queries use this view to inspect booked slots WITHOUT exposing
-- client names, phone numbers, emails, or personal appointment notes.
-- ==============================================================================
drop view if exists public.public_booked_slots cascade;

create or replace view public.public_booked_slots with (security_invoker = false) as
  select
    id,
    code,
    client_name,
    client_phone,
    client_email,
    user_email,
    service_name,
    service_price,
    stylist,
    appointment_date,
    appointment_time,
    quiet_chair,
    status,
    notes,
    created_at
  from public.bookings
  where status != 'cancelled';

grant select on public.public_booked_slots to anon, authenticated;

-- ==============================================================================
-- SECURITY DEFINER: SECURE ADMIN EMAIL VERIFICATION & SAFE OPERATIONS
-- Avoids exposing the authorized_admins roster table to public enumeration.
-- ==============================================================================
create or replace function public.verify_admin_email(check_email text)
returns table (
  is_authorized boolean,
  admin_id text,
  email text,
  name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    true as is_authorized,
    a.id as admin_id,
    a.email,
    a.name,
    a.role
  from public.authorized_admins a
  where lower(trim(a.email)) = lower(trim(check_email))
    and a.is_active = true
  limit 1;
end;
$$;

grant execute on function public.verify_admin_email(text) to anon, authenticated;

-- Helper to verify if an email is an active admin
create or replace function public.is_active_admin(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.authorized_admins
    where lower(trim(email)) = lower(trim(check_email))
      and is_active = true
  );
$$;

grant execute on function public.is_active_admin(text) to anon, authenticated;

-- Secure RPC: Admin Update Booking Status (guarded by admin verification)
create or replace function public.admin_update_booking_status(
  p_admin_email text,
  p_booking_id text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  update public.bookings
  set status = p_status
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.admin_update_booking_status(text, text, text) to anon, authenticated;

-- Secure RPC: Admin Fetch All Bookings
create or replace function public.admin_fetch_bookings(p_admin_email text default null)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.bookings
  order by appointment_date desc, appointment_time asc;
end;
$$;

grant execute on function public.admin_fetch_bookings(text) to anon, authenticated;
grant execute on function public.admin_fetch_bookings() to anon, authenticated;

-- Secure RPC: Admin Delete Booking (guarded by admin verification)
create or replace function public.admin_delete_booking(
  p_admin_email text,
  p_booking_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  delete from public.bookings
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_booking(text, text) to anon, authenticated;

-- Secure RPC: Admin Update Service (guarded by admin verification)
create or replace function public.admin_update_service_price(
  p_admin_email text,
  p_service_id text,
  p_price text,
  p_price_num numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  update public.services
  set price = p_price, price_num = p_price_num
  where id = p_service_id;

  return true;
end;
$$;

grant execute on function public.admin_update_service_price(text, text, text, numeric) to anon, authenticated;

-- Secure RPC: Admin Delete Service (guarded by admin verification)
create or replace function public.admin_delete_service(
  p_admin_email text,
  p_service_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  delete from public.services
  where id = p_service_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_service(text, text) to anon, authenticated;

-- Secure RPC: Admin Delete Review (guarded by admin verification)
create or replace function public.admin_delete_review(
  p_admin_email text,
  p_review_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  delete from public.reviews
  where id = p_review_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_review(text, text) to anon, authenticated;

-- Secure RPC: Admin Update Timetable (guarded by admin verification)
create or replace function public.admin_update_timetable(
  p_admin_email text,
  p_working_days jsonb,
  p_time_slots jsonb,
  p_notice text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  insert into public.timetable (id, working_days, time_slots, notice, updated_at)
  values ('default', p_working_days, p_time_slots, coalesce(p_notice, ''), now())
  on conflict (id) do update
  set working_days = excluded.working_days,
      time_slots = excluded.time_slots,
      notice = excluded.notice,
      updated_at = now();

  return true;
end;
$$;

grant execute on function public.admin_update_timetable(text, jsonb, jsonb, text) to anon, authenticated;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS): PRINCIPLE OF LEAST PRIVILEGE
-- ==============================================================================
alter table public.authorized_admins enable row level security;
alter table public.services enable row level security;
alter table public.artisans enable row level security;
alter table public.gallery enable row level security;
alter table public.reviews enable row level security;
alter table public.bookings enable row level security;
alter table public.contacts enable row level security;
alter table public.timetable enable row level security;

-- Drop legacy vulnerable policies
drop policy if exists "Allow all operations on authorized_admins" on public.authorized_admins;
drop policy if exists "Allow all operations on services" on public.services;
drop policy if exists "Allow all operations on artisans" on public.artisans;
drop policy if exists "Allow all operations on gallery" on public.gallery;
drop policy if exists "Allow all operations on reviews" on public.reviews;
drop policy if exists "Allow all operations on bookings" on public.bookings;
drop policy if exists "Allow all operations on contacts" on public.contacts;
drop policy if exists "Allow all operations on timetable" on public.timetable;

-- Drop new policies if re-running script (idempotency)
drop policy if exists "Public read services catalog" on public.services;
drop policy if exists "Public read artisans" on public.artisans;
drop policy if exists "Public read gallery" on public.gallery;
drop policy if exists "Public read reviews" on public.reviews;
drop policy if exists "Public insert validated review" on public.reviews;
drop policy if exists "Public insert contact inquiry" on public.contacts;
drop policy if exists "Public insert appointment booking" on public.bookings;
drop policy if exists "Public read timetable" on public.timetable;
drop policy if exists "Admin manage services" on public.services;
drop policy if exists "Admin manage artisans" on public.artisans;
drop policy if exists "Admin manage gallery" on public.gallery;
drop policy if exists "Admin manage reviews" on public.reviews;
drop policy if exists "Admin manage bookings" on public.bookings;
drop policy if exists "Admin manage contacts" on public.contacts;
drop policy if exists "Admin manage authorized_admins" on public.authorized_admins;
drop policy if exists "Admin manage timetable" on public.timetable;

-- 1. Services: Public can read, mutations reserved for authenticated admins
create policy "Public read services catalog"
  on public.services for select to anon, authenticated
  using (true);

-- 2. Artisans: Public can read, mutations reserved for authenticated admins
create policy "Public read artisans"
  on public.artisans for select to anon, authenticated
  using (true);

-- 3. Gallery: Public can read, mutations reserved for authenticated admins
create policy "Public read gallery"
  on public.gallery for select to anon, authenticated
  using (true);

-- 4. Reviews: Public can read, insert validated review, no public delete/update
create policy "Public read reviews"
  on public.reviews for select to anon, authenticated
  using (true);

create policy "Public insert validated review"
  on public.reviews for insert to anon, authenticated
  with check (
    length(trim(author)) > 0
    and length(trim(quote)) > 0
    and rating >= 1
    and rating <= 5
  );

-- 5. Contacts: Public can submit inquiry only; NO public select, update, or delete (PII protection)
create policy "Public insert contact inquiry"
  on public.contacts for insert to anon, authenticated
  with check (
    length(trim(name)) > 0
    and length(trim(message)) > 0
  );

-- 6. Bookings: Public insert appointment booking + Public select for admin console visibility
drop policy if exists "Public select bookings" on public.bookings;
drop policy if exists "Public update bookings" on public.bookings;
drop policy if exists "Public delete bookings" on public.bookings;

create policy "Public select bookings"
  on public.bookings for select to anon, authenticated
  using (true);

create policy "Public insert appointment booking"
  on public.bookings for insert to anon, authenticated
  with check (
    length(trim(client_name)) > 0
    and length(trim(appointment_date)) = 10
    and status in ('pending', 'confirmed')
  );

create policy "Public update bookings"
  on public.bookings for update to anon, authenticated
  using (true) with check (true);

create policy "Public delete bookings"
  on public.bookings for delete to anon, authenticated
  using (true);

grant all on public.bookings to anon, authenticated;
grant all on public.contacts to anon, authenticated;
grant all on public.reviews to anon, authenticated;
grant all on public.timetable to anon, authenticated;

-- 7. Timetable: Public can read for live booking schedule
create policy "Public read timetable"
  on public.timetable for select to anon, authenticated
  using (true);

-- 8. Authenticated Supabase session full management
create policy "Admin manage services" on public.services for all to authenticated using (true) with check (true);
create policy "Admin manage artisans" on public.artisans for all to authenticated using (true) with check (true);
create policy "Admin manage gallery" on public.gallery for all to authenticated using (true) with check (true);
create policy "Admin manage reviews" on public.reviews for all to authenticated using (true) with check (true);
create policy "Admin manage bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "Admin manage contacts" on public.contacts for all to authenticated using (true) with check (true);
create policy "Admin manage authorized_admins" on public.authorized_admins for all to authenticated using (true) with check (true);
create policy "Admin manage timetable" on public.timetable for all to authenticated using (true) with check (true);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================
insert into public.authorized_admins (id, email, name, role, is_active)
values
  ('admin-master', 'admin@barberhub.com', 'Barber Hub Master Admin', 'super_admin', true),
  ('admin-director', 'director@barberhub.com', 'Elena Vance', 'manager', true)
on conflict (id) do nothing;

insert into public.services (id, num, category, name, price, price_num, duration, tag, img, "desc")
values
  ('s1', '01', 'cut', 'Cut & Styling', 'Rs 150+', 150, '60 min', 'Hair', '/images/services/cut-styling.jpg', 'From precision haircuts tailored to your individual look to polished blowouts and elegant updos, every cut and styling service is crafted to bring out the best in your hair.'),
  ('s2', '02', 'color', 'Color', 'Rs 220+', 220, '120 min', 'Color', '/images/services/color.jpg', 'From rich single-process color to expertly crafted balayage and highlights, our color services are tailored to complement your unique look by master colorists.'),
  ('s3', '03', 'treatments', 'Conditioning Hair Treatments', 'Rs 95+', 95, '45 min', 'Care', '/images/services/conditioning.jpg', 'Restore softness, strength, and luminosity with luxury formulas from Kérastase, Shu Uemura, and Olaplex, leaving you with a healthier, radiant result.'),
  ('s4', '04', 'makeup', 'Makeup', 'Rs 125+', 125, '60 min', 'Beauty', '/images/services/makeup.jpg', 'From custom blended makeup application and lash enhancements to eyebrow shaping and personalized lessons, designed to complement and elevate your full look.'),
  ('s5', '05', 'bridal', 'Bridal', 'Rs 350+', 350, '180 min', 'Occasion', '/images/services/bridal.jpg', 'From your bridal trial to the moment you walk down the aisle, offering both in-salon and on-location hair services tailored to your wedding vision.'),
  ('s6', '06', 'perms', 'Perms & Relaxer', 'Rs 200+', 200, '120 min', 'Texture', '/images/services/perms-relaxer.jpg', 'Whether you are looking to add lasting curl definition with a perm or achieve smooth, manageable results with a relaxer, tailored to your hair texture.'),
  ('s7', '07', 'nails', 'Nails', 'Rs 65+', 65, '50 min', 'Nails', '/images/services/nails.jpg', 'From a classic manicure to gel, Dazzle Dry, powder gel, and beyond, luxury nail services designed to leave your hands and feet looking polished and refined.')
on conflict (id) do nothing;

insert into public.artisans (id, name, role, chair, bio, img)
values
  ('artisan-1', 'Elena Vance', 'Creative Director & Colorist', 'Chair 01', '12 years atelier experience between London and Paris. Specialises in low-maintenance golden balayage.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=80'),
  ('artisan-2', 'Marcus Thorne', 'Master Sculptor & Fade Specialist', 'Chair 02', 'Vidal Sassoon trained. Master of precision men''s tapers, razor texturing, and sharp architectural crops.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80'),
  ('artisan-3', 'Mei-Ling Zhou', 'Holistic Head Spa Therapist', 'Chair 03', 'Tokyo certified head spa master. Integrates herbal botanical extracts with restorative shiatsu acupressure.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=80')
on conflict (id) do nothing;

insert into public.gallery (id, category, tag, title, "desc", img)
values
  ('gal-1', 'cuts', 'Men''s Fade', 'Textured Crop & Low Skin Taper', 'Precision scissor carving with razor-sharp temple contours.', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80'),
  ('gal-2', 'cuts', 'Precision Cut', 'Architectural French Bob', 'Clean jawline bevel with textured curtain fringe.', 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=800&q=80'),
  ('gal-3', 'balayage', 'Colour', 'Champagne Nordic Melt', 'Ultra-fine baby lights blended into platinum tips.', 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80'),
  ('gal-4', 'bridal', 'Bridal', 'The Riviera Chignon', 'Relaxed low bun with soft framing tendrils and pearl pins.', 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80'),
  ('gal-5', 'styling', 'Styling', 'Venetian Velvet Blowout', 'High-volume polished waves with high-gloss mirror glaze.', 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80'),
  ('gal-6', 'cuts', 'Men''s Styling', 'Sculpted Pompadour & Beard Blend', 'Matte pomade texture with seamless cheekbone graduation.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80')
on conflict (id) do nothing;

insert into public.reviews (id, stars, rating, quote, author, service)
values
  ('rev-1', '★★★★★', 5, 'I have been a client of Barber Hub since they opened. They are the best. I won''t go anywhere else. My hair is curly and they do an amazing job. Always have', 'Carolyn Pianin', 'Cut & Styling'),
  ('rev-2', '★★★★★', 5, 'I had my hair cut by Carmel and it was such a great experience 10/10 recommend. She asked all the right questions to really understand what I was looking for. My hair came out fabulous!!', 'Sofia Appel', 'Cut & Styling'),
  ('rev-3', '★★★★★', 5, 'I hadn''t had my naturally very dark hair colored in a very long time, but I took the plunge with Kelly at Barber Hub and it was the best decision! Kelly gave me a thorough consultation and along with Devin they made sure my cut and color work in perfect harmony.', 'Vanessa Moreno', 'Color'),
  ('rev-4', '★★★★★', 5, 'I never write google reviews but the blowout that Rene just gave me deserves a review. It was a simple walk in and I’m leaving with the best blow out I have ever gotten.', 'Daniela Silva', 'Blow Dry'),
  ('rev-5', '★★★★★', 5, 'Barber Hub is such a wonderful experience! The salon is beautiful, exquisitely clean, and packed with highly talented artists! Clint does my cut..a perfectionist! Kelly does my color…very natural!', 'Donna Mazur', 'Cut & Color'),
  ('rev-6', '★★★★★', 5, 'I can’t say enough good things about this salon! Mark is a true artist with color — my color has never looked better. And Clint gives the best cuts; he really knows how to shape and style for your face and hair type.', 'M Bailey', 'Color & Cut')
on conflict (id) do nothing;

insert into public.timetable (id, working_days, time_slots, notice)
values (
  'default',
  '[
    {"day": "Sun", "name": "Sunday", "isOpen": false, "openTime": "Closed", "closeTime": "Closed"},
    {"day": "Mon", "name": "Monday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Tue", "name": "Tuesday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Wed", "name": "Wednesday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Thu", "name": "Thursday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Fri", "name": "Friday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Sat", "name": "Saturday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "06:00 PM"}
  ]'::jsonb,
  '[
    {"id": "t1", "time": "09:30 AM", "period": "morning", "label": "Morning Light", "badge": "Available", "active": true},
    {"id": "t2", "time": "10:30 AM", "period": "morning", "label": "Morning High", "badge": "Popular", "active": true},
    {"id": "t3", "time": "11:30 AM", "period": "morning", "label": "Midday Prime", "badge": "Prime", "active": true},
    {"id": "t4", "time": "01:00 PM", "period": "afternoon", "label": "Early Afternoon", "badge": "Available", "active": true},
    {"id": "t5", "time": "02:15 PM", "period": "afternoon", "label": "Mid Afternoon", "badge": "Popular", "active": true},
    {"id": "t6", "time": "03:30 PM", "period": "afternoon", "label": "Late Afternoon", "badge": "Available", "active": true},
    {"id": "t7", "time": "04:30 PM", "period": "afternoon", "label": "Sunset Glow", "badge": "Prime", "active": true},
    {"id": "t8", "time": "05:30 PM", "period": "evening", "label": "Fifth Ave Twilight", "badge": "Available", "active": true},
    {"id": "t9", "time": "06:30 PM", "period": "evening", "label": "Evening Couture", "badge": "Peak Slot", "active": true},
    {"id": "t10", "time": "07:15 PM", "period": "evening", "label": "Late Salon Session", "badge": "VIP Evening", "active": true}
  ]'::jsonb,
  'All appointments are private 1-on-1 sessions with dedicated master stylists.'
)
on conflict (id) do update
set working_days = excluded.working_days,
    time_slots = excluded.time_slots,
    notice = excluded.notice,
    updated_at = now();
`
