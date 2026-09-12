import React, { useState, useMemo, useEffect } from 'react'
import { formatPrice, INITIAL_TIMETABLE } from '../data/initialData'
import {
  signInWithGoogle,
  signOutAdmin,
  subscribeToAuthChanges,
  isFirebaseConfigured
} from '../firebase'
import {
  isSupabaseConfigured,
  SUPABASE_URL,
  testSupabaseConnection,
  syncBookingToSupabase,
  updateBookingStatusInSupabase,
  deleteBookingFromSupabase,
  syncReviewToSupabase,
  deleteReviewFromSupabase,
  syncServiceToSupabase,
  deleteServiceFromSupabase,
  SUPABASE_SCHEMA_SQL,
  isEmailAuthorizedAdmin,
  fetchAuthorizedAdmins,
  addAuthorizedAdmin,
  removeAuthorizedAdmin,
  toggleAuthorizedAdminStatus,
  isTimeSlotBooked,
  normalizeTimeStr,
  fetchAdminBookingsFromSupabase
} from '../supabase'
import { generateUniqueBookingCode, parseBookingCode } from '../utils/bookingCode.js'

export default function AdminPage({
  services = [],
  setServices,
  bookings = [],
  setBookings,
  reviews = [],
  setReviews,
  timetable = INITIAL_TIMETABLE,
  setTimetable,
  onResetData,
  onNavigate
}) {
  // Security & Authorization states
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [authorizedAdminInfo, setAuthorizedAdminInfo] = useState(null)
  const [authDeniedEmail, setAuthDeniedEmail] = useState(null)
  const [authDeniedReason, setAuthDeniedReason] = useState(null)

  // Firebase Auth states
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)
  const [googleAuthError, setGoogleAuthError] = useState(null)

  // Authorized Admin accounts management state
  const [authorizedAdminsList, setAuthorizedAdminsList] = useState([])
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('admin')

  // Load admins list from Supabase / cache
  const loadAdminsList = async () => {
    setIsLoadingAdmins(true)
    const list = await fetchAuthorizedAdmins()
    setAuthorizedAdminsList(list)
    setIsLoadingAdmins(false)
  }

  // Verification helper: Checks if Google account email is authorized
  const verifyUserAuthorization = async (user) => {
    if (!user || !user.email) {
      setIsCheckingAuth(false)
      setIsAuthenticated(false)
      setAuthorizedAdminInfo(null)
      return
    }

    setIsCheckingAuth(true)
    try {
      const res = await isEmailAuthorizedAdmin(user.email)
      if (res.authorized) {
        setIsAuthenticated(true)
        setAuthorizedAdminInfo(res.admin)
        setAuthDeniedEmail(null)
        setAuthDeniedReason(null)
        sessionStorage.setItem('sck_admin_unlocked', 'true')
        sessionStorage.setItem('sck_authorized_admin_info', JSON.stringify(res.admin))
        loadAdminsList()
        fetchAdminBookingsFromSupabase().then((cloudBookings) => {
          if (cloudBookings && cloudBookings.length > 0 && setBookings) {
            setBookings((prev) => {
              const map = new Map()
              cloudBookings.forEach((b) => map.set(b.id || b.code, b))
              prev.forEach((b) => {
                if (!map.has(b.id || b.code)) map.set(b.id || b.code, b)
              })
              return Array.from(map.values())
            })
          }
        })
      } else {
        setIsAuthenticated(false)
        setAuthorizedAdminInfo(null)
        setAuthDeniedEmail(user.email)
        setAuthDeniedReason(res.reason)
        sessionStorage.removeItem('sck_admin_unlocked')
        sessionStorage.removeItem('sck_authorized_admin_info')
      }
    } catch (err) {
      console.warn('Authorization verification failed:', err)
      setIsAuthenticated(false)
      setAuthDeniedEmail(user.email)
      setAuthDeniedReason('Unable to verify administrative authorization.')
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setFirebaseUser(user)
      if (user) {
        verifyUserAuthorization(user)
      } else {
        setIsCheckingAuth(false)
        setIsAuthenticated(false)
        setAuthorizedAdminInfo(null)
        setAuthDeniedEmail(null)
        sessionStorage.removeItem('sck_admin_unlocked')
      }
    })
    return () => unsubscribe()
  }, [])

  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true)
    setGoogleAuthError(null)
    setAuthDeniedEmail(null)
    try {
      const res = await signInWithGoogle()
      if (res?.user) {
        setFirebaseUser(res.user)
        await verifyUserAuthorization(res.user)
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setGoogleAuthError('Google sign-in was closed.')
      } else {
        setGoogleAuthError(err.message || 'Google sign-in failed.')
      }
    } finally {
      setIsGoogleSigningIn(false)
    }
  }

  const handleSwitchGoogleAccount = async () => {
    setAuthDeniedEmail(null)
    setAuthDeniedReason(null)
    try {
      await signOutAdmin()
    } catch { }
    setFirebaseUser(null)
    setIsAuthenticated(false)
    handleGoogleSignIn()
  }

  const handleLockOrSignOut = async () => {
    try {
      await signOutAdmin()
    } catch { }
    setIsAuthenticated(false)
    setAuthorizedAdminInfo(null)
    setAuthDeniedEmail(null)
    setAuthDeniedReason(null)
    sessionStorage.removeItem('sck_admin_unlocked')
    sessionStorage.removeItem('sck_google_user')
    sessionStorage.removeItem('sck_authorized_admin_info')
    setFirebaseUser(null)
    showToast('Signed out of admin console')
  }

  const handleAddAdmin = async (e) => {
    e.preventDefault()
    if (!newAdminEmail.trim()) {
      showToast('Please enter a Google email')
      return
    }
    const cleanEmail = newAdminEmail.trim().toLowerCase()
    const added = await addAuthorizedAdmin({
      email: cleanEmail,
      name: newAdminName.trim() || cleanEmail.split('@')[0],
      role: newAdminRole || 'admin'
    })
    if (added) {
      setNewAdminEmail('')
      setNewAdminName('')
      await loadAdminsList()
      showToast(`Authorized Google account added: ${cleanEmail}`)
    }
  }

  const handleRemoveAdmin = async (id, email) => {
    if (window.confirm(`Revoke admin privileges for "${email}"?`)) {
      await removeAuthorizedAdmin(id)
      await loadAdminsList()
      showToast(`Admin privileges revoked for ${email}`)
    }
  }

  const handleToggleAdminStatus = async (id, currentStatus) => {
    await toggleAuthorizedAdminStatus(id, !currentStatus)
    await loadAdminsList()
    showToast(`Admin status updated`)
  }

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'bookings' | 'services' | 'reviews' | 'admins' | 'system'

  // Booking filters, search & view mode
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all')
  const [bookingDateFilter, setBookingDateFilter] = useState('all') // 'all' | 'today' | 'tomorrow' | 'upcoming' | 'past' | 'custom'
  const [bookingCustomDate, setBookingCustomDate] = useState('')
  const [bookingViewMode, setBookingViewMode] = useState('table') // 'table' | 'agenda'
  const [bookingSearch, setBookingSearch] = useState('')

  // Service modal & state
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false)
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceCategory, setNewServiceCategory] = useState('cut')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceDuration, setNewServiceDuration] = useState('60 min')
  const [newServiceDesc, setNewServiceDesc] = useState('')
  const [newServiceImg, setNewServiceImg] = useState('/images/services/cut-styling.jpg')

  // Booking modal & state
  const [isAddBookingModalOpen, setIsAddBookingModalOpen] = useState(false)
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestPhone, setNewGuestPhone] = useState('')
  const [newGuestEmail, setNewGuestEmail] = useState('')
  const [newBookingService, setNewBookingService] = useState(services[0]?.name || 'Cut & Styling')
  const [newBookingDate, setNewBookingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [newBookingTime, setNewBookingTime] = useState('11:30 AM')
  const [newBookingQuiet, setNewBookingQuiet] = useState(false)

  // Booking details modal state
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null)
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const [isSyncingBookings, setIsSyncingBookings] = useState(false)

  // Review modal & state
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false)
  const [newReviewAuthor, setNewReviewAuthor] = useState('')
  const [newReviewRole, setNewReviewRole] = useState('Fifth Avenue Patron')
  const [newReviewText, setNewReviewText] = useState('')
  const [newReviewRating, setNewReviewRating] = useState(5)

  // Reset confirmation modal
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  // Supabase live testing & schema utilities
  const [isTestingSupabase, setIsTestingSupabase] = useState(false)

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true)
    const res = await testSupabaseConnection()
    setIsTestingSupabase(false)
    if (res.ok) {
      showToast('✓ Supabase Cloud active & verified!')
    } else {
      showToast(`Supabase: ${res.error}`)
    }
  }

  const handleCopySupabaseSchema = () => {
    try {
      navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL)
      showToast('✓ Supabase SQL schema copied! Paste in Supabase SQL Editor.')
    } catch {
      showToast('Copy failed. View src/supabase.js for SQL.')
    }
  }

  const handleSyncCloudBookings = async (silent = false) => {
    if (!silent) showToast('Checking Supabase Cloud for latest reservations...')
    setIsSyncingBookings(true)
    try {
      const cloud = await fetchAdminBookingsFromSupabase()
      if (cloud && cloud.length > 0 && setBookings) {
        setBookings((prev) => {
          const map = new Map()
          cloud.forEach((b) => map.set(b.id || b.code, b))
          ;(prev || []).forEach((b) => {
            if (!map.has(b.id || b.code)) map.set(b.id || b.code, b)
          })
          return Array.from(map.values())
        })
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        if (!silent) showToast(`✓ Synced ${cloud.length} reservation(s) from Supabase Cloud`)
      } else {
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        if (!silent) showToast('Database checked. All reservations up to date.')
      }
    } catch (err) {
      console.warn('Sync bookings notice:', err)
    } finally {
      setIsSyncingBookings(false)
    }
  }

  // Auto-sync reservations on mount and when entering bookings or overview tab
  useEffect(() => {
    handleSyncCloudBookings(true)
  }, [])

  useEffect(() => {
    if (activeTab === 'bookings' || activeTab === 'overview') {
      handleSyncCloudBookings(true)
    }
  }, [activeTab])

  // --- Customer Contact & Quick Connect helpers ---
  const [copiedPhoneId, setCopiedPhoneId] = useState(null)

  const handleCopyPhone = (bookingId, phone) => {
    if (!phone) return
    try {
      navigator.clipboard?.writeText(phone)
      setCopiedPhoneId(bookingId)
      setTimeout(() => setCopiedPhoneId(null), 2000)
    } catch {
      // fallback
    }
  }

  const formatCleanPhone = (phone) => {
    if (!phone) return ''
    return String(phone).replace(/[^\d+]/g, '')
  }

  const formatCleanWhatsApp = (phone) => {
    if (!phone) return ''
    return String(phone).replace(/[^\d]/g, '')
  }

  // --- Schedule & Timing Helpers for Clear Booking Visibility ---
  const todayStr = useMemo(() => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const tomorrowStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const parseBookingSchedule = (dateStr, timeStr) => {
    if (!dateStr) return { dayName: '', formattedDate: 'Date TBD', relativeBadge: null, isToday: false, isTomorrow: false, isPast: false }
    const rawDate = String(dateStr).split('T')[0]
    const parts = rawDate.split('-').map(Number)
    const today = new Date()
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    let dayName = ''
    let formattedDate = rawDate
    let relativeBadge = null
    let isToday = false
    let isTomorrow = false
    let isPast = false

    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const targetDate = new Date(parts[0], parts[1] - 1, parts[2])
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      dayName = days[targetDate.getDay()]
      formattedDate = `${parts[2]} ${months[parts[1] - 1]} ${parts[0]}`

      const diffMs = targetDate.getTime() - todayMid.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        isToday = true
        relativeBadge = { type: 'today', text: 'TODAY' }
      } else if (diffDays === 1) {
        isTomorrow = true
        relativeBadge = { type: 'tomorrow', text: 'TOMORROW' }
      } else if (diffDays < 0) {
        isPast = true
        relativeBadge = { type: 'past', text: `${Math.abs(diffDays)}d ago` }
      } else if (diffDays <= 7) {
        relativeBadge = { type: 'upcoming', text: `In ${diffDays}d` }
      }
    }

    return {
      rawDate,
      dayName,
      formattedDate,
      relativeBadge,
      isToday,
      isTomorrow,
      isPast
    }
  }

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 9999
    const m = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!m) return 9999
    let h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    const ampm = m[3].toUpperCase()
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return h * 60 + min
  }

  // --- Timetable & Operating Hours helpers ---
  const effectiveTimetable = timetable?.workingDays ? timetable : INITIAL_TIMETABLE

  const handleToggleWorkingDay = (dayKey) => {
    if (!setTimetable) return
    const updatedDays = (effectiveTimetable.workingDays || []).map((d) => {
      if (d.day === dayKey) {
        return { ...d, isOpen: !d.isOpen }
      }
      return d
    })
    setTimetable({ ...effectiveTimetable, workingDays: updatedDays })
    showToast('✓ Operating hours updated')
  }

  const handleUpdateDayHours = (dayKey, field, value) => {
    if (!setTimetable) return
    const updatedDays = (effectiveTimetable.workingDays || []).map((d) => {
      if (d.day === dayKey) {
        return { ...d, [field]: value }
      }
      return d
    })
    setTimetable({ ...effectiveTimetable, workingDays: updatedDays })
  }

  const handleToggleTimeSlot = (slotId) => {
    if (!setTimetable) return
    const updatedSlots = (effectiveTimetable.timeSlots || []).map((s) => {
      if (s.id === slotId) {
        return { ...s, active: s.active === false }
      }
      return s
    })
    setTimetable({ ...effectiveTimetable, timeSlots: updatedSlots })
    showToast('✓ Time slot availability updated')
  }

  const handleDeleteTimeSlot = (slotId) => {
    if (!setTimetable) return
    const updatedSlots = (effectiveTimetable.timeSlots || []).filter((s) => s.id !== slotId)
    setTimetable({ ...effectiveTimetable, timeSlots: updatedSlots })
    showToast('✓ Time slot removed')
  }

  const [newSlotTime, setNewSlotTime] = useState('')
  const [newSlotPeriod, setNewSlotPeriod] = useState('morning')
  const [newSlotLabel, setNewSlotLabel] = useState('')
  const [newSlotBadge, setNewSlotBadge] = useState('Available')

  const handleAddSlot = (e) => {
    e.preventDefault()
    if (!newSlotTime.trim() || !setTimetable) return
    const newSlot = {
      id: 't-' + Date.now(),
      time: newSlotTime.trim(),
      period: newSlotPeriod,
      label: newSlotLabel.trim() || 'Custom Slot',
      badge: newSlotBadge.trim() || 'Available',
      active: true
    }
    const updatedSlots = [...(effectiveTimetable.timeSlots || []), newSlot]
    setTimetable({ ...effectiveTimetable, timeSlots: updatedSlots })
    setNewSlotTime('')
    setNewSlotLabel('')
    setNewSlotBadge('Available')
    showToast('✓ New time slot added')
  }

  const handleResetTimetable = () => {
    if (window.confirm('Reset timetable and operating hours to factory default?')) {
      if (setTimetable) setTimetable(INITIAL_TIMETABLE)
      showToast('✓ Timetable reset to default')
    }
  }

  // --- Statistics & Overview calculations ---
  const stats = useMemo(() => {
    const totalBookings = bookings.length
    const pendingCount = bookings.filter((b) => (b.status || '').toLowerCase() === 'pending').length
    const confirmedCount = bookings.filter((b) => (b.status || '').toLowerCase() === 'confirmed').length
    const completedCount = bookings.filter((b) => (b.status || '').toLowerCase() === 'completed').length

    // Estimated revenue from confirmed & completed bookings
    const totalRevenueNum = bookings
      .filter((b) => ['confirmed', 'completed'].includes((b.status || '').toLowerCase()))
      .reduce((acc, b) => {
        const str = String(b.servicePrice || '')
        const num = parseInt(str.replace(/[^0-9]/g, ''), 10)
        return acc + (isNaN(num) ? 0 : num)
      }, 0)

    return {
      totalBookings,
      pendingCount,
      confirmedCount,
      completedCount,
      totalServices: services.length,
      totalReviews: reviews.length,
      totalRevenueNum
    }
  }, [bookings, services, reviews])

  // Date Counts for Fast Admin Overview (Today, Tomorrow, Upcoming)
  const dateCounts = useMemo(() => {
    let todayC = 0
    let tomorrowC = 0
    let upcomingC = 0
    bookings.forEach((b) => {
      const rawDate = (b.date || b.appointment_date || '').split('T')[0]
      if (rawDate === todayStr) todayC++
      if (rawDate === tomorrowStr) tomorrowC++
      if (rawDate >= todayStr) upcomingC++
    })
    return { todayC, tomorrowC, upcomingC, total: bookings.length }
  }, [bookings, todayStr, tomorrowStr])

  // Filtered Bookings with Status, Date & Search
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Status Filter
      const statusMatch =
        bookingStatusFilter === 'all'
          ? true
          : (b.status || '').toLowerCase() === bookingStatusFilter.toLowerCase()
      if (!statusMatch) return false

      // 2. Date Filter
      const rawDate = (b.date || b.appointment_date || '').split('T')[0]
      let dateMatch = true
      if (bookingDateFilter === 'today') {
        dateMatch = rawDate === todayStr
      } else if (bookingDateFilter === 'tomorrow') {
        dateMatch = rawDate === tomorrowStr
      } else if (bookingDateFilter === 'upcoming') {
        dateMatch = rawDate >= todayStr
      } else if (bookingDateFilter === 'past') {
        dateMatch = rawDate < todayStr
      } else if (bookingDateFilter === 'custom' && bookingCustomDate) {
        dateMatch = rawDate === bookingCustomDate
      }
      if (!dateMatch) return false

      // 3. Search Query
      const q = bookingSearch.toLowerCase().trim()
      if (!q) return true

      const nameMatch = (b.guestName || '').toLowerCase().includes(q)
      const serviceMatch = (b.serviceName || '').toLowerCase().includes(q)
      const phoneMatch = (b.guestPhone || '').toLowerCase().includes(q)
      const emailMatch = (b.guestEmail || '').toLowerCase().includes(q)
      const codeMatch = (b.code || '').toLowerCase().includes(q)
      const dateMatchStr = rawDate.includes(q) || (b.time || '').toLowerCase().includes(q)

      return nameMatch || serviceMatch || phoneMatch || emailMatch || codeMatch || dateMatchStr
    })
  }, [bookings, bookingStatusFilter, bookingDateFilter, bookingCustomDate, bookingSearch, todayStr, tomorrowStr])

  // Sorted Filtered Bookings (Chronological by Date then Time)
  const sortedFilteredBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      const dateA = (a.date || a.appointment_date || '').split('T')[0]
      const dateB = (b.date || b.appointment_date || '').split('T')[0]
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return parseTimeToMinutes(a.time || a.appointment_time) - parseTimeToMinutes(b.time || b.appointment_time)
    })
  }, [filteredBookings])

  // Grouped by Date for Daily Schedule / Agenda View
  const dateGroups = useMemo(() => {
    const map = new Map()
    sortedFilteredBookings.forEach((b) => {
      const rawDate = (b.date || b.appointment_date || '').split('T')[0] || 'Unknown Date'
      if (!map.has(rawDate)) map.set(rawDate, [])
      map.get(rawDate).push(b)
    })
    return Array.from(map.entries()).map(([dateKey, items]) => ({
      dateKey,
      scheduleInfo: parseBookingSchedule(dateKey),
      items
    }))
  }, [sortedFilteredBookings])

  // --- Booking Operations ---
  const handleUpdateBookingStatus = (bookingId, newStatus) => {
    if (!setBookings) return
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    )
    setSelectedBookingDetail((prev) => (prev && prev.id === bookingId ? { ...prev, status: newStatus } : prev))
    updateBookingStatusInSupabase(bookingId, newStatus)
    showToast(`Appointment status updated to ${newStatus}`)
  }

  const handleDeleteBooking = (bookingId) => {
    if (!setBookings) return
    if (window.confirm('Are you sure you want to remove this reservation?')) {
      setBookings((prev) => prev.filter((b) => b.id !== bookingId))
      setSelectedBookingDetail((prev) => (prev && prev.id === bookingId ? null : prev))
      deleteBookingFromSupabase(bookingId)
      showToast('Appointment removed successfully')
    }
  }

  const isNewSlotBooked = useMemo(() => {
    return isTimeSlotBooked(newBookingDate, newBookingTime, bookings)
  }, [newBookingDate, newBookingTime, bookings])

  const handleCreateBooking = async (e) => {
    e.preventDefault()
    if (!newGuestName.trim()) {
      alert('Please enter guest name')
      return
    }

    // Double-booking check
    if (isTimeSlotBooked(newBookingDate, newBookingTime, bookings)) {
      alert(`Conflict: An active appointment is already scheduled for ${newBookingDate} at ${newBookingTime}. Please choose another time slot.`)
      return
    }

    const matchedService = services.find((s) => s.name === newBookingService)
    const newEntry = {
      id: `bk-${Date.now()}`,
      code: generateUniqueBookingCode(newGuestName, newGuestPhone, newGuestEmail, bookings),
      guestName: newGuestName.trim(),
      guestPhone: newGuestPhone.trim() || 'In-Salon Walk-in',
      guestEmail: newGuestEmail.trim() || 'reception@salonhub.com',
      serviceName: newBookingService,
      servicePrice: formatPrice(matchedService?.price || 'Rs 150+'),
      stylist: 'Fifth Avenue Master Stylist',
      date: newBookingDate,
      time: newBookingTime,
      isQuietChair: newBookingQuiet,
      status: 'Confirmed',
      createdAt: new Date().toISOString().split('T')[0]
    }

    setBookings((prev) => [newEntry, ...prev])
    setIsAddBookingModalOpen(false)
    setNewGuestName('')
    setNewGuestPhone('')
    setNewGuestEmail('')
    showToast(`Reservation created for ${newEntry.guestName}`)

    // Sync to Supabase with conflict notification
    const res = await syncBookingToSupabase(newEntry)
    if (res && res.conflict) {
      showToast(`Warning: Cloud sync conflict: ${res.error}`)
    }
  }

  // --- Service Operations ---
  const handleUpdateServicePrice = (serviceId, newPriceRaw) => {
    if (!setServices) return
    const cleaned = formatPrice(newPriceRaw)
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, price: cleaned } : s))
    )
    const current = services.find((s) => s.id === serviceId)
    if (current) {
      syncServiceToSupabase({ ...current, price: cleaned })
    }
    showToast('Service price updated')
  }

  const handleDeleteService = (serviceId) => {
    if (!setServices) return
    if (window.confirm('Delete this service from the live salon catalog?')) {
      setServices((prev) => prev.filter((s) => s.id !== serviceId))
      deleteServiceFromSupabase(serviceId)
      showToast('Service removed from catalog')
    }
  }

  const handleCreateService = (e) => {
    e.preventDefault()
    if (!newServiceName.trim()) {
      alert('Please provide a service title')
      return
    }

    const newServiceObj = {
      id: `srv-${Date.now()}`,
      num: `0${services.length + 1}`.slice(-2),
      category: newServiceCategory,
      name: newServiceName.trim(),
      price: formatPrice(newServicePrice.trim() || 'Rs 150+'),
      duration: newServiceDuration.trim() || '60 min',
      tag: newServiceCategory.charAt(0).toUpperCase() + newServiceCategory.slice(1),
      img: newServiceImg || '/images/services/cut-styling.jpg',
      desc: newServiceDesc.trim() || 'Bespoke artisanal styling formulation crafted for individual hair health.'
    }

    setServices((prev) => [...prev, newServiceObj])
    syncServiceToSupabase(newServiceObj)
    setIsAddServiceModalOpen(false)
    setNewServiceName('')
    setNewServicePrice('')
    setNewServiceDesc('')
    showToast(`Service "${newServiceObj.name}" added to catalog`)
  }

  // --- Review Operations ---
  const handleDeleteReview = (reviewId) => {
    if (!setReviews) return
    if (window.confirm('Delete this client testimonial?')) {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      deleteReviewFromSupabase(reviewId)
      showToast('Testimonial removed')
    }
  }

  const handleCreateReview = (e) => {
    e.preventDefault()
    if (!newReviewAuthor.trim() || !newReviewText.trim()) {
      alert('Please fill out all fields')
      return
    }

    const newRev = {
      id: `rev-${Date.now()}`,
      author: newReviewAuthor.trim(),
      role: newReviewRole.trim(),
      text: newReviewText.trim(),
      rating: Number(newReviewRating),
      service: 'Barber Hub Bespoke Experience'
    }

    setReviews((prev) => [newRev, ...prev])
    syncReviewToSupabase(newRev)
    setIsAddReviewModalOpen(false)
    setNewReviewAuthor('')
    setNewReviewText('')
    showToast('Client testimonial published')
  }

  // --- Factory Reset ---
  const handleExecuteReset = () => {
    if (onResetData) {
      onResetData()
      setIsResetConfirmOpen(false)
      showToast('All salon data reverted to factory defaults')
    }
  }

  // --- Export JSON Backup ---
  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      services,
      bookings,
      reviews
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salonhub-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Atelier backup file downloaded')
  }

  // -------------------------------------------------------------
  // Render 1: Checking Authentication State
  // -------------------------------------------------------------
  if (isCheckingAuth) {
    return (
      <div className="sck-admin-lock-screen">
        <div className="sck-admin-lock-card">
          <div className="sck-admin-lock-logo-wrap" style={{ marginBottom: 16 }}>
            <img src="/logo.png" alt="Barber Hub" className="sck-admin-lock-logo" />
          </div>
          <div className="sck-auth-loading-spinner" />
          <h2 className="sck-admin-lock-title" style={{ marginTop: 22 }}>
            Verifying Authorization
          </h2>
          <p className="sck-admin-lock-subtitle">
            Validating Google account administrative credentials with Barber Hub security protocols...
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // Render 2: Access Denied for Unauthorized Google Accounts
  // -------------------------------------------------------------
  if (authDeniedEmail) {
    return (
      <div className="sck-admin-lock-screen">
        <div className="sck-admin-lock-card is-denied">
          <div className="sck-admin-lock-icon is-denied">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <span className="sck-denied-tag">ACCESS RESTRICTED</span>
          <h1 className="sck-admin-lock-title">Unauthorized Account</h1>
          <p className="sck-admin-lock-subtitle">
            Only authorized Google accounts can view or manage the Barber Hub Admin Panel.
          </p>

          <div className="sck-denied-user-box">
            <div className="sck-denied-user-row">
              <span className="sck-denied-label">Signed in with Google as:</span>
              <strong className="sck-denied-email">{authDeniedEmail}</strong>
            </div>
            <p className="sck-denied-detail">
              {authDeniedReason || 'This Google account is not listed in the authorized administrators roster.'}
            </p>
          </div>

          <div className="sck-denied-actions">
            <button
              type="button"
              className="sck-google-signin-btn is-switch"
              onClick={handleSwitchGoogleAccount}
            >
              <svg className="sck-google-icon" width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign In with Different Google Account</span>
            </button>

            <button
              type="button"
              className="sck-btn-back-site"
              onClick={() => onNavigate && onNavigate('home')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Return to Public Website</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // Render 3: Standard Google Authentication Gate (Not Signed In)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="sck-admin-lock-screen">
        <div className="sck-admin-lock-card">
          <div className="sck-admin-lock-logo-wrap">
            <img src="/logo.png" alt="Barber Hub" className="sck-admin-lock-logo" />
          </div>
          <span className="sck-gold-tag">ATELIER PRIVÉ</span>
          <h1 className="sck-admin-lock-title">Barber Hub Management</h1>
          <p className="sck-admin-lock-subtitle">
            Sign in with an authorized Google administrator account to access the Barber Hub management console.
          </p>

          <div className="sck-auth-status-chip">
            <span className="sck-pulse-dot" style={{ width: 6, height: 6, background: '#4285F4', boxShadow: '0 0 8px #4285F4' }} />
            <span>{isFirebaseConfigured ? 'Live Firebase Google Auth' : 'Google Authentication Ready'}</span>
          </div>

          <button
            type="button"
            className="sck-google-signin-btn"
            onClick={() => handleGoogleSignIn()}
            disabled={isGoogleSigningIn}
          >
            <svg className="sck-google-icon" width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isGoogleSigningIn ? 'Connecting to Google…' : 'Sign in with Google'}</span>
          </button>

          {googleAuthError && (
            <div className="sck-google-error-msg">
              {googleAuthError}
            </div>
          )}

          <div className="sck-back-to-site-wrap">
            <button
              type="button"
              className="sck-btn-back-site"
              onClick={() => onNavigate && onNavigate('home')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Return to Public Website</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // Render: Main Back-Office Management Dashboard
  // -------------------------------------------------------------
  return (
    <div className="sck-admin-dashboard">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="sck-admin-toast">
          <span>✓ {toastMessage}</span>
        </div>
      )}

      {/* Top Console Bar */}
      <header className="sck-admin-topbar">
        <div className="sck-admin-topbar-left">
          <div className="sck-admin-logo">
            <img src="/logo.png" alt="Barber Hub" className="sck-admin-topbar-logo" />
            <span className="sck-admin-logo-badge">ADMIN</span>
            <span className="sck-admin-brand">Barber Hub Fifth Avenue</span>
          </div>
          <div className="sck-admin-env-pill" title={`Connected to Supabase Project: ${SUPABASE_URL}`}>
            <span className="sck-pulse-dot" /> Supabase Cloud Active
          </div>
        </div>

        <div className="sck-admin-topbar-right">
          {/* User Profile Badge (Google Auth or Master Admin) */}
          {firebaseUser ? (
            <div className="sck-admin-user-profile">
              {firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={firebaseUser.displayName || 'Admin'}
                  className="sck-admin-avatar"
                />
              ) : (
                <div className="sck-admin-avatar-fallback">
                  {(firebaseUser.displayName || firebaseUser.email || 'A')[0].toUpperCase()}
                </div>
              )}
              <div className="sck-admin-user-info">
                <span className="sck-admin-user-name">{firebaseUser.displayName || authorizedAdminInfo?.name || 'Administrator'}</span>
                <span className="sck-admin-user-email">{firebaseUser.email}</span>
              </div>
              <span className="sck-google-topbar-pill is-authorized" title="Authorized Administrator via Google OAuth">
                <svg width="12" height="12" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Authorized
              </span>
            </div>
          ) : (
            <div className="sck-admin-user-profile is-pin">
              <span className="sck-admin-role-badge">Master Admin</span>
            </div>
          )}

          <button
            type="button"
            className="sck-admin-nav-btn is-website"
            onClick={() => onNavigate && onNavigate('home')}
            title="Return to Public Home Page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>View Live Site</span>
          </button>

          <button
            type="button"
            className="sck-admin-nav-btn is-lock"
            onClick={handleLockOrSignOut}
            title="Sign Out from Admin Console"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Dashboard Body with Sidebar Tabs */}
      <div className="sck-admin-layout">
        {/* Navigation Sidebar */}
        <aside className="sck-admin-sidebar">
          <div className="sck-admin-sidebar-menu">
            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Overview</span>
            </button>

            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'bookings' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Appointments</span>
              <span className="sck-tab-badge">{bookings.length}</span>
            </button>

            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'services' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                <line x1="16" y1="8" x2="2" y2="22" />
                <line x1="17.5" y1="15" x2="9" y2="15" />
              </svg>
              <span>Services &amp; Pricing</span>
              <span className="sck-tab-badge">{services.length}</span>
            </button>

            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'reviews' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Reviews</span>
              <span className="sck-tab-badge">{reviews.length}</span>
            </button>

            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'timetable' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('timetable')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Timetable &amp; Hours</span>
              <span className="sck-tab-badge">
                {(effectiveTimetable?.timeSlots || []).filter((s) => s.active !== false).length}
              </span>
            </button>

            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'admins' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('admins')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Authorized Admins</span>
              <span className="sck-tab-badge">{authorizedAdminsList.length}</span>
            </button>

            <button
              type="button"
              className={`sck-sidebar-tab ${activeTab === 'system' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Backup &amp; Reset</span>
            </button>
          </div>

          <div className="sck-sidebar-footer">
            <div className="sck-sidebar-footer-card">
              <span className="sck-footer-title">Barber Hub New York</span>
              <p>587 5th Ave, Fourth Floor</p>
              <span className="sck-footer-pin-note">Secured by Google OAuth &amp; Supabase</span>
            </div>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="sck-admin-main">
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">Executive Dashboard</h2>
                  <p className="sck-pane-subtitle">Live activity, booking volume, and catalog status for Barber Hub.</p>
                </div>
                <button
                  type="button"
                  className="sck-btn-teal"
                  onClick={() => setIsAddBookingModalOpen(true)}
                >
                  + New Walk-In Booking
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="sck-admin-stats-grid">
                <div className="sck-stat-card">
                  <span className="sck-stat-label">TOTAL BOOKINGS</span>
                  <div className="sck-stat-val">{stats.totalBookings}</div>
                  <span className="sck-stat-sub">Across all salon chairs</span>
                </div>

                <div className="sck-stat-card is-pending">
                  <span className="sck-stat-label">PENDING CONFIRMATION</span>
                  <div className="sck-stat-val">{stats.pendingCount}</div>
                  <span className="sck-stat-sub">Requires stylist review</span>
                </div>

                <div className="sck-stat-card is-confirmed">
                  <span className="sck-stat-label">CONFIRMED SESSIONS</span>
                  <div className="sck-stat-val">{stats.confirmedCount}</div>
                  <span className="sck-stat-sub">Reserved Fifth Ave dates</span>
                </div>

                <div className="sck-stat-card is-revenue">
                  <span className="sck-stat-label">CONFIRMED VALUE</span>
                  <div className="sck-stat-val">Rs {stats.totalRevenueNum.toLocaleString()}</div>
                  <span className="sck-stat-sub">Confirmed &amp; Completed</span>
                </div>
              </div>

              {/* Recent Bookings Snapshot */}
              <div className="sck-admin-section-box">
                <div className="sck-box-header">
                  <h3 className="sck-box-title">Recent Reservations</h3>
                  <button
                    type="button"
                    className="sck-text-btn"
                    onClick={() => setActiveTab('bookings')}
                  >
                    View All ({bookings.length}) →
                  </button>
                </div>

                {bookings.length === 0 ? (
                  <p className="sck-empty-text">No bookings recorded yet.</p>
                ) : (
                  <div className="sck-table-responsive">
                    <table className="sck-admin-table">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Client</th>
                          <th>Service</th>
                          <th>Investment</th>
                          <th>Schedule</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.slice(0, 5).map((b) => (
                          <tr key={b.id}>
                            <td>
                              <span className="sck-code-tag">{b.code || b.id.slice(0, 8)}</span>
                            </td>
                            <td>
                              <div className="sck-guest-cell">
                                <div className="sck-guest-name">
                                  <strong>{b.guestName}</strong>
                                  {b.isQuietChair && <span className="sck-quiet-tag">Quiet</span>}
                                </div>
                                {b.guestPhone && (
                                  <div className="sck-quick-connect-row" style={{ marginTop: 4 }}>
                                    <a
                                      href={`tel:${formatCleanPhone(b.guestPhone)}`}
                                      className="sck-contact-chip is-call"
                                      title="Call customer"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 4 }}>
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                      </svg>
                                      {b.guestPhone}
                                    </a>
                                    <a
                                      href={`https://wa.me/${formatCleanWhatsApp(b.guestPhone)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="sck-contact-chip is-wa"
                                      title="Chat on WhatsApp"
                                    >
                                      WhatsApp
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>{b.serviceName}</td>
                            <td>
                              <span className="sck-price-badge">{formatPrice(b.servicePrice)}</span>
                            </td>
                            <td>
                              {(() => {
                                const sch = parseBookingSchedule(b.date, b.time)
                                return (
                                  <div className="sck-schedule-cell">
                                    <div className="sck-schedule-time-row">
                                      <span className="sck-schedule-time-badge">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <circle cx="12" cy="12" r="10" />
                                          <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        <strong>{b.time || 'TBD'}</strong>
                                      </span>
                                      {sch.relativeBadge && (
                                        <span className={`sck-relative-pill is-${sch.relativeBadge.type}`}>
                                          {sch.relativeBadge.text}
                                        </span>
                                      )}
                                    </div>
                                    <div className="sck-schedule-date-row">
                                      <strong className="sck-schedule-day-highlight">{sch.dayName ? sch.dayName.slice(0, 3) : ''},</strong>
                                      <span>{sch.formattedDate}</span>
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>
                            <td>
                              <span className={`sck-status-pill is-${(b.status || 'pending').toLowerCase()}`}>
                                {b.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: APPOINTMENTS & BOOKINGS */}
          {/* ========================================================= */}
          {activeTab === 'bookings' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">Appointments &amp; Reservations</h2>
                  <p className="sck-pane-subtitle">Manage guest schedules, approve sessions, and record walk-ins.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="sck-btn-ghost"
                    onClick={() => handleSyncCloudBookings(false)}
                    disabled={isSyncingBookings}
                    title="Fetch latest online bookings from Supabase Cloud"
                  >
                    <span style={{ display: 'inline-block', transform: isSyncingBookings ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>↻</span>
                    <span>{isSyncingBookings ? 'Syncing...' : 'Sync Cloud'}</span>
                    {lastSyncTime && <span className="sck-sync-time">{lastSyncTime}</span>}
                  </button>
                  <button
                    type="button"
                    className="sck-btn-teal"
                    onClick={() => setIsAddBookingModalOpen(true)}
                  >
                    + Add Walk-In Reservation
                  </button>
                </div>
              </div>

              {/* Status & Search Filter Bar */}
              <div className="sck-filter-controls-row">
                <div className="sck-status-tabs">
                  {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`sck-filter-btn ${bookingStatusFilter === st ? 'is-active' : ''}`}
                      onClick={() => setBookingStatusFilter(st)}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="sck-search-wrap">
                  <input
                    type="text"
                    placeholder="Search client, service, phone, date..."
                    maxLength={50}
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="sck-search-input"
                  />
                  {bookingSearch && (
                    <button
                      type="button"
                      className="sck-search-clear"
                      onClick={() => setBookingSearch('')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filters & Schedule View Mode Bar */}
              <div className="sck-date-controls-bar">
                <div className="sck-date-filter-tabs">
                  <button
                    type="button"
                    className={`sck-date-tab-btn ${bookingDateFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => {
                      setBookingDateFilter('all')
                      setBookingCustomDate('')
                    }}
                  >
                    All Dates ({dateCounts.total})
                  </button>
                  <button
                    type="button"
                    className={`sck-date-tab-btn is-today-tab ${bookingDateFilter === 'today' ? 'is-active' : ''}`}
                    onClick={() => {
                      setBookingDateFilter('today')
                      setBookingCustomDate('')
                    }}
                  >
                    <span className="sck-pulse-dot is-green" /> Today ({dateCounts.todayC})
                  </button>
                  <button
                    type="button"
                    className={`sck-date-tab-btn ${bookingDateFilter === 'tomorrow' ? 'is-active' : ''}`}
                    onClick={() => {
                      setBookingDateFilter('tomorrow')
                      setBookingCustomDate('')
                    }}
                  >
                    Tomorrow ({dateCounts.tomorrowC})
                  </button>
                  <button
                    type="button"
                    className={`sck-date-tab-btn ${bookingDateFilter === 'upcoming' ? 'is-active' : ''}`}
                    onClick={() => {
                      setBookingDateFilter('upcoming')
                      setBookingCustomDate('')
                    }}
                  >
                    Upcoming ({dateCounts.upcomingC})
                  </button>

                  <div className="sck-custom-date-wrap">
                    <label className="sck-date-picker-label" htmlFor="sck-admin-date-picker">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </label>
                    <input
                      id="sck-admin-date-picker"
                      type="date"
                      className="sck-custom-date-input"
                      value={bookingCustomDate}
                      onChange={(e) => {
                        setBookingCustomDate(e.target.value)
                        setBookingDateFilter(e.target.value ? 'custom' : 'all')
                      }}
                      title="Filter by specific appointment date"
                    />
                    {bookingCustomDate && (
                      <button
                        type="button"
                        className="sck-clear-date-btn"
                        onClick={() => {
                          setBookingCustomDate('')
                          setBookingDateFilter('all')
                        }}
                        title="Clear date selection"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* View Switcher: Table View vs Daily Schedule View */}
                <div className="sck-view-mode-tabs">
                  <button
                    type="button"
                    className={`sck-view-mode-btn ${bookingViewMode === 'table' ? 'is-active' : ''}`}
                    onClick={() => setBookingViewMode('table')}
                    title="Switch to Table View"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    className={`sck-view-mode-btn ${bookingViewMode === 'agenda' ? 'is-active' : ''}`}
                    onClick={() => setBookingViewMode('agenda')}
                    title="Switch to Daily Schedule View"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Daily Schedule</span>
                  </button>
                </div>
              </div>

              {/* Bookings View: Table or Daily Agenda */}
              {sortedFilteredBookings.length === 0 ? (
                <div className="sck-admin-section-box">
                  <p className="sck-empty-text">No reservations match the selected date and status filters.</p>
                </div>
              ) : bookingViewMode === 'agenda' ? (
                /* ================= DAILY SCHEDULE / AGENDA VIEW ================= */
                <div className="sck-agenda-container">
                  {dateGroups.map((grp) => (
                    <div key={grp.dateKey} className="sck-agenda-group">
                      <div className="sck-agenda-group-header">
                        <div className="sck-agenda-group-title">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #ff9000)" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span className="sck-agenda-day-name">{grp.scheduleInfo.dayName || 'Date'},</span>
                          <span className="sck-agenda-date-val">{grp.scheduleInfo.formattedDate}</span>
                          {grp.scheduleInfo.relativeBadge && (
                            <span className={`sck-relative-pill is-${grp.scheduleInfo.relativeBadge.type}`}>
                              {grp.scheduleInfo.relativeBadge.text}
                            </span>
                          )}
                        </div>
                        <span className="sck-agenda-count-badge">
                          {grp.items.length} {grp.items.length === 1 ? 'Booking' : 'Bookings'}
                        </span>
                      </div>

                      <div className="sck-agenda-items-list">
                        {grp.items.map((b) => (
                          <div key={b.id} className="sck-agenda-card">
                            {/* Prominent Time Section */}
                            <div className="sck-agenda-time-box">
                              <div className="sck-agenda-time-large">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>{b.time || 'TBD'}</span>
                              </div>
                              <span className={`sck-status-pill is-${(b.status || 'pending').toLowerCase()}`}>
                                {b.status || 'Pending'}
                              </span>
                            </div>

                            {/* Guest & Contact Info */}
                            <div className="sck-agenda-client-box">
                              <div className="sck-agenda-client-top">
                                <strong className="sck-agenda-client-name">{b.guestName}</strong>
                                {b.isQuietChair && <span className="sck-quiet-tag">Quiet Chair</span>}
                                <span className="sck-code-tag">{b.code || b.id.slice(0, 8)}</span>
                              </div>

                              {b.guestPhone ? (
                                <div className="sck-quick-connect-row" style={{ marginTop: 6 }}>
                                  <span className="sck-phone-num">{b.guestPhone}</span>
                                  <a
                                    href={`tel:${formatCleanPhone(b.guestPhone)}`}
                                    className="sck-contact-chip is-call"
                                    title={`Call ${b.guestName}`}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 4 }}>
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    Call
                                  </a>
                                  <a
                                    href={`https://wa.me/${formatCleanWhatsApp(b.guestPhone)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="sck-contact-chip is-wa"
                                    title={`WhatsApp ${b.guestName}`}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 4 }}>
                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                    </svg>
                                    WhatsApp
                                  </a>
                                  <button
                                    type="button"
                                    className="sck-contact-chip is-copy"
                                    onClick={() => handleCopyPhone(b.id, b.guestPhone)}
                                    title="Copy Phone Number"
                                  >
                                    {copiedPhoneId === b.id ? '✓ Copied' : 'Copy'}
                                  </button>
                                </div>
                              ) : (
                                <div className="sck-guest-sub">No phone provided</div>
                              )}

                              {(b.notes || b.guestNotes) && (
                                <div className="sck-agenda-notes">
                                  <span className="sck-notes-tag is-req">Request:</span> <em>&ldquo;{b.notes || b.guestNotes}&rdquo;</em>
                                </div>
                              )}

                              {(b.isQuietChair || b.quiet_chair) && (
                                <div style={{ marginTop: '4px' }}>
                                  <span className="sck-notes-tag is-quiet">🤫 Silent Chair Requested</span>
                                </div>
                              )}
                            </div>

                            {/* Treatment & Stylist */}
                            <div className="sck-agenda-treatment-box">
                              <strong className="sck-agenda-treatment-name">{b.serviceName}</strong>
                              <div className="sck-agenda-treatment-sub">
                                <span>{b.stylist || 'Fifth Ave Stylist'}</span>
                                <span className="sck-price-badge">{formatPrice(b.servicePrice)}</span>
                              </div>
                            </div>

                            {/* Status Actions */}
                            <div className="sck-agenda-actions-box">
                              <div className="sck-status-action-btns">
                                <button
                                  type="button"
                                  className="sck-act-btn is-details"
                                  onClick={() => setSelectedBookingDetail(b)}
                                  title="View full customer dossier"
                                >
                                  Details
                                </button>
                                {b.status !== 'Confirmed' && (
                                  <button
                                    type="button"
                                    className="sck-act-btn is-confirm"
                                    onClick={() => handleUpdateBookingStatus(b.id, 'Confirmed')}
                                    title="Mark Confirmed"
                                  >
                                    Confirm
                                  </button>
                                )}
                                {b.status !== 'Completed' && (
                                  <button
                                    type="button"
                                    className="sck-act-btn is-complete"
                                    onClick={() => handleUpdateBookingStatus(b.id, 'Completed')}
                                    title="Mark Completed"
                                  >
                                    Complete
                                  </button>
                                )}
                                {b.status !== 'Cancelled' && (
                                  <button
                                    type="button"
                                    className="sck-act-btn is-cancel"
                                    onClick={() => handleUpdateBookingStatus(b.id, 'Cancelled')}
                                    title="Mark Cancelled"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                className="sck-del-btn"
                                onClick={() => handleDeleteBooking(b.id)}
                                title="Delete record"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ================= TABLE VIEW ================= */
                <div className="sck-admin-section-box">
                  <div className="sck-table-responsive">
                    <table className="sck-admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '135px' }}>Ref</th>
                          <th>Guest &amp; Contact</th>
                          <th>Treatment &amp; Stylist</th>
                          <th>When &amp; Time</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right', width: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFilteredBookings.map((b) => (
                          <tr key={b.id}>
                            <td style={{ width: '135px', whiteSpace: 'nowrap' }}>
                              <span className="sck-code-tag" title={b.code || b.id}>
                                {b.code || b.id.slice(0, 10)}
                              </span>
                            </td>
                            <td>
                              <div className="sck-guest-cell">
                                <div className="sck-guest-name">
                                  <strong>{b.guestName}</strong>
                                </div>
                                {b.guestPhone ? (
                                  <div className="sck-customer-contact-box">
                                    <div className="sck-phone-row">
                                      <span className="sck-phone-num">{b.guestPhone}</span>
                                      <div className="sck-quick-connect-row">
                                        <a
                                          href={`tel:${formatCleanPhone(b.guestPhone)}`}
                                          className="sck-contact-chip is-call"
                                          title={`Call ${b.guestName}`}
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                          </svg>
                                          Call
                                        </a>
                                        <a
                                          href={`https://wa.me/${formatCleanWhatsApp(b.guestPhone)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="sck-contact-chip is-wa"
                                          title={`WhatsApp ${b.guestName}`}
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                          </svg>
                                          WhatsApp
                                        </a>
                                        <button
                                          type="button"
                                          className="sck-contact-chip is-copy"
                                          onClick={() => handleCopyPhone(b.id, b.guestPhone)}
                                          title="Copy phone number"
                                        >
                                          {copiedPhoneId === b.id ? '✓' : 'Copy'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="sck-guest-sub">No phone provided</div>
                                )}
                                {b.guestEmail && (
                                  <div className="sck-guest-sub" style={{ marginTop: 2 }}>
                                    <a href={`mailto:${b.guestEmail}`} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                                      ✉ {b.guestEmail}
                                    </a>
                                  </div>
                                )}
                                <div className="sck-guest-tags-row">
                                  {(b.isQuietChair || b.quiet_chair) && (
                                    <span className="sck-notes-tag is-quiet">🤫 Silent Chair</span>
                                  )}
                                  {(b.notes || b.guestNotes) && (
                                    <span className="sck-table-special-requests" title={b.notes || b.guestNotes}>
                                      <span className="sck-req-label">Req:</span> &ldquo;{b.notes || b.guestNotes}&rdquo;
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{b.serviceName}</strong>
                              <div className="sck-guest-sub">{b.stylist || 'Fifth Ave Artist'}</div>
                            </td>
                            <td>
                              {(() => {
                                const sch = parseBookingSchedule(b.date, b.time)
                                return (
                                  <div className="sck-schedule-cell">
                                    <div className="sck-schedule-time-row">
                                      <span className="sck-schedule-time-badge">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <circle cx="12" cy="12" r="10" />
                                          <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        <strong>{b.time || 'TBD'}</strong>
                                      </span>
                                      {sch.relativeBadge && (
                                        <span className={`sck-relative-pill is-${sch.relativeBadge.type}`}>
                                          {sch.relativeBadge.text}
                                        </span>
                                      )}
                                    </div>
                                    <div className="sck-schedule-date-row">
                                      <strong className="sck-schedule-day-highlight">{sch.dayName ? sch.dayName.slice(0, 3) : ''},</strong>
                                      <span>{sch.formattedDate}</span>
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>
                            <td>
                              <span className="sck-price-badge">{formatPrice(b.servicePrice)}</span>
                            </td>
                            <td>
                              <span className={`sck-status-pill is-${(b.status || 'pending').toLowerCase()}`}>
                                {b.status || 'Pending'}
                              </span>
                            </td>
                            <td>
                              <div className="sck-unified-actions">
                                <button
                                  type="button"
                                  className="sck-act-btn is-details"
                                  onClick={() => setSelectedBookingDetail(b)}
                                  title="View full reservation dossier"
                                >
                                  Details
                                </button>
                                {b.status !== 'Confirmed' && (
                                  <button
                                    type="button"
                                    className="sck-act-btn is-confirm"
                                    onClick={() => handleUpdateBookingStatus(b.id, 'Confirmed')}
                                    title="Mark Confirmed"
                                  >
                                    Confirm
                                  </button>
                                )}
                                {b.status !== 'Completed' && (
                                  <button
                                    type="button"
                                    className="sck-act-btn is-complete"
                                    onClick={() => handleUpdateBookingStatus(b.id, 'Completed')}
                                    title="Mark Completed"
                                  >
                                    Complete
                                  </button>
                                )}
                                {b.status !== 'Cancelled' && (
                                  <button
                                    type="button"
                                    className="sck-act-btn is-cancel"
                                    onClick={() => handleUpdateBookingStatus(b.id, 'Cancelled')}
                                    title="Mark Cancelled"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="sck-del-btn"
                                  onClick={() => handleDeleteBooking(b.id)}
                                  title="Remove reservation"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SERVICES & PRICING */}
          {/* ========================================================= */}
          {activeTab === 'services' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">Salon Offerings &amp; Pricing</h2>
                  <p className="sck-pane-subtitle">
                    Live updates to service cards, descriptions, and prices in <strong>Rs</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className="sck-btn-teal"
                  onClick={() => setIsAddServiceModalOpen(true)}
                >
                  + Add New Service
                </button>
              </div>

              <div className="sck-services-admin-grid">
                {services.map((srv) => (
                  <div key={srv.id} className="sck-srv-admin-card">
                    <div className="sck-srv-card-top">
                      <span className="sck-srv-category-tag">{srv.category}</span>
                      <button
                        type="button"
                        className="sck-del-srv-btn"
                        onClick={() => handleDeleteService(srv.id)}
                        title="Delete service"
                      >
                        Remove
                      </button>
                    </div>

                    <h3 className="sck-srv-card-name">{srv.name}</h3>
                    <p className="sck-srv-card-desc">{srv.desc}</p>

                    <div className="sck-srv-admin-meta">
                      <div className="sck-srv-meta-field">
                        <label>Price (Rs):</label>
                        <input
                          type="text"
                          defaultValue={srv.price}
                          onBlur={(e) => {
                            if (e.target.value !== srv.price) {
                              handleUpdateServicePrice(srv.id, e.target.value)
                            }
                          }}
                          className="sck-admin-edit-price"
                        />
                      </div>
                      <div className="sck-srv-meta-field">
                        <label>Duration:</label>
                        <span>{srv.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: REVIEWS & TESTIMONIALS */}
          {/* ========================================================= */}
          {activeTab === 'reviews' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">Client Reviews &amp; Testimonials</h2>
                  <p className="sck-pane-subtitle">Manage guest feedback displayed across the website.</p>
                </div>
                <button
                  type="button"
                  className="sck-btn-teal"
                  onClick={() => setIsAddReviewModalOpen(true)}
                >
                  + Add Client Testimonial
                </button>
              </div>

              <div className="sck-reviews-admin-grid">
                {reviews.map((rev) => (
                  <div key={rev.id} className="sck-rev-admin-card">
                    <div className="sck-rev-top">
                      <div className="sck-rev-stars">
                        {'★'.repeat(rev.rating || 5)}
                      </div>
                      <button
                        type="button"
                        className="sck-del-srv-btn"
                        onClick={() => handleDeleteReview(rev.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <p className="sck-rev-quote">"{rev.text}"</p>

                    <div className="sck-rev-author-box">
                      <strong>{rev.author}</strong>
                      <span>{rev.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: AUTHORIZED GOOGLE ACCOUNTS */}
          {/* ========================================================= */}
          {activeTab === 'admins' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">Authorized Google Accounts</h2>
                  <p className="sck-pane-subtitle">
                    Only verified Google accounts listed below have permission to unlock and view the Barber Hub Admin Console.
                  </p>
                </div>
                <button
                  type="button"
                  className="sck-btn-teal"
                  onClick={loadAdminsList}
                  disabled={isLoadingAdmins}
                >
                  {isLoadingAdmins ? 'Refreshing...' : '↻ Refresh Accounts'}
                </button>
              </div>

              {/* Add New Authorized Google Account Form */}
              <div className="sck-admin-section-box" style={{ marginBottom: 24 }}>
                <div className="sck-box-header">
                  <h3 className="sck-box-title">+ Authorize New Google Account</h3>
                </div>
                <form onSubmit={handleAddAdmin} className="sck-modal-form" style={{ marginTop: 14 }}>
                  <div className="sck-form-grid-3">
                    <div className="sck-form-row">
                      <label>Google Account Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. manager@salonhub.com"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                      />
                    </div>
                    <div className="sck-form-row">
                      <label>Admin Full Name / Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Elena Vance"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                      />
                    </div>
                    <div className="sck-form-row">
                      <label>Role Privilege</label>
                      <select
                        value={newAdminRole}
                        onChange={(e) => setNewAdminRole(e.target.value)}
                      >
                        <option value="super_admin">Super Admin (Full Control)</option>
                        <option value="manager">Salon Manager</option>
                        <option value="admin">Desk Admin</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button type="submit" className="sck-btn-teal">
                      Authorize Account
                    </button>
                  </div>
                </form>
              </div>

              {/* Authorized Accounts List */}
              <div className="sck-admin-section-box">
                <div className="sck-box-header">
                  <h3 className="sck-box-title">
                    Active Authorized Accounts ({authorizedAdminsList.length})
                  </h3>
                </div>

                <div className="sck-table-responsive" style={{ marginTop: 14 }}>
                  <table className="sck-admin-table sck-accounts-table">
                    <thead>
                      <tr>
                        <th style={{ width: '32%' }}>Google Account</th>
                        <th style={{ width: '22%' }}>Assigned Name</th>
                        <th style={{ width: '15%' }}>Role</th>
                        <th style={{ width: '13%' }}>Status</th>
                        <th style={{ width: '10%', whiteSpace: 'nowrap' }}>Added Date</th>
                        <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authorizedAdminsList.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: 28, color: 'rgba(255,255,255,0.4)' }}>
                            No authorized accounts loaded.
                          </td>
                        </tr>
                      ) : (
                        authorizedAdminsList.map((adm) => {
                          const isCurrent =
                            firebaseUser?.email &&
                            adm.email &&
                            firebaseUser.email.toLowerCase() === adm.email.toLowerCase()
                          return (
                            <tr key={adm.id || adm.email}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                  <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px' }}>
                                    {adm.email}
                                  </span>
                                  {isCurrent && (
                                    <span className="sck-current-badge">
                                      Current User
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                                {adm.name || '—'}
                              </td>
                              <td>
                                <span className={`sck-role-pill is-${adm.role || 'admin'}`}>
                                  {(adm.role || 'admin').replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={`sck-status-toggle-btn ${adm.is_active !== false ? 'is-active' : 'is-disabled'}`}
                                  onClick={() => handleToggleAdminStatus(adm.id, adm.is_active !== false)}
                                  title="Click to toggle active status"
                                >
                                  <span className="sck-status-dot" />
                                  <span>{adm.is_active !== false ? 'Active' : 'Disabled'}</span>
                                </button>
                              </td>
                              <td style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                {adm.created_at
                                  ? new Date(adm.created_at).toLocaleDateString()
                                  : 'Default'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {!isCurrent ? (
                                  <button
                                    type="button"
                                    className="sck-revoke-btn"
                                    onClick={() => handleRemoveAdmin(adm.id, adm.email)}
                                    title="Revoke access"
                                  >
                                    Revoke
                                  </button>
                                ) : (
                                  <span className="sck-locked-badge">Protected</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: TIMETABLE & WORKING HOURS */}
          {/* ========================================================= */}
          {activeTab === 'timetable' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">Salon Timetable &amp; Operating Hours</h2>
                  <p className="sck-pane-subtitle">
                    Configure weekly operating days, hours, and available reservation slots. Changes automatically synchronize with client booking availability.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="sck-btn-secondary"
                    onClick={handleResetTimetable}
                  >
                    ↺ Reset Standard Hours
                  </button>
                </div>
              </div>

              {/* Weekly Operating Schedule */}
              <div className="sck-admin-section-box">
                <div className="sck-box-header">
                  <div>
                    <h3 className="sck-box-title">Weekly Operating Schedule</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                      Days marked &quot;Closed&quot; will be automatically blocked in the client reservation calendar.
                    </p>
                  </div>
                </div>

                <div className="sck-schedule-grid">
                  {(effectiveTimetable.workingDays || []).map((dayObj) => (
                    <div
                      key={dayObj.day}
                      className={`sck-day-card ${dayObj.isOpen ? 'is-open' : 'is-closed'}`}
                    >
                      <div className="sck-day-header">
                        <div className="sck-day-name-box">
                          <span className="sck-day-short">{dayObj.day}</span>
                          <span className="sck-day-full">{dayObj.name}</span>
                        </div>
                        <button
                          type="button"
                          className={`sck-status-toggle-btn ${dayObj.isOpen ? 'is-active' : 'is-disabled'}`}
                          onClick={() => handleToggleWorkingDay(dayObj.day)}
                          title={`Click to mark ${dayObj.name} as ${dayObj.isOpen ? 'Closed' : 'Open'}`}
                        >
                          <span className="sck-status-dot" />
                          <span>{dayObj.isOpen ? 'Open' : 'Closed'}</span>
                        </button>
                      </div>

                      {dayObj.isOpen ? (
                        <div className="sck-day-hours">
                          <div className="sck-hour-field">
                            <label>Opens</label>
                            <input
                              type="text"
                              value={dayObj.openTime || '09:00 AM'}
                              maxLength={12}
                              onChange={(e) => handleUpdateDayHours(dayObj.day, 'openTime', e.target.value)}
                            />
                          </div>
                          <span className="sck-hour-sep">–</span>
                          <div className="sck-hour-field">
                            <label>Closes</label>
                            <input
                              type="text"
                              value={dayObj.closeTime || '07:00 PM'}
                              maxLength={12}
                              onChange={(e) => handleUpdateDayHours(dayObj.day, 'closeTime', e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="sck-day-closed-note">
                          <span>Closed for appointments</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bookable Time Slots */}
              <div className="sck-admin-section-box">
                <div className="sck-box-header">
                  <div>
                    <h3 className="sck-box-title">
                      Active Reservation Time Slots ({(effectiveTimetable.timeSlots || []).filter(s => s.active !== false).length})
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                      Clients can choose from these active slots when scheduling an appointment on the booking page.
                    </p>
                  </div>
                </div>

                <div className="sck-slots-grid">
                  {(effectiveTimetable.timeSlots || []).map((slot) => (
                    <div
                      key={slot.id}
                      className={`sck-slot-admin-card ${slot.active !== false ? 'is-active' : 'is-inactive'}`}
                    >
                      <div className="sck-slot-top">
                        <span className="sck-slot-time">{slot.time}</span>
                        <span className={`sck-slot-period is-${slot.period || 'morning'}`}>
                          {(slot.period || 'morning').toUpperCase()}
                        </span>
                      </div>
                      <div className="sck-slot-meta">
                        <span className="sck-slot-label">{slot.label || 'Standard Slot'}</span>
                        <span className="sck-slot-badge">{slot.badge || 'Available'}</span>
                      </div>
                      <div className="sck-slot-actions">
                        <button
                          type="button"
                          className={`sck-slot-toggle ${slot.active !== false ? 'is-enabled' : 'is-disabled'}`}
                          onClick={() => handleToggleTimeSlot(slot.id)}
                        >
                          {slot.active !== false ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          type="button"
                          className="sck-del-btn"
                          onClick={() => handleDeleteTimeSlot(slot.id)}
                          title="Remove time slot"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Time Slot Form */}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <h4 style={{ color: '#ffffff', fontSize: 14, margin: '0 0 12px' }}>+ Add Custom Time Slot</h4>
                  <form onSubmit={handleAddSlot} className="sck-modal-form">
                    <div className="sck-form-grid-4">
                      <div className="sck-form-row">
                        <label>Slot Time *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 08:30 AM"
                          maxLength={15}
                          value={newSlotTime}
                          onChange={(e) => setNewSlotTime(e.target.value)}
                        />
                      </div>
                      <div className="sck-form-row">
                        <label>Day Period</label>
                        <select
                          value={newSlotPeriod}
                          onChange={(e) => setNewSlotPeriod(e.target.value)}
                        >
                          <option value="morning">Morning</option>
                          <option value="afternoon">Afternoon</option>
                          <option value="evening">Evening</option>
                        </select>
                      </div>
                      <div className="sck-form-row">
                        <label>Custom Label</label>
                        <input
                          type="text"
                          placeholder="e.g. Early Sunrise"
                          maxLength={30}
                          value={newSlotLabel}
                          onChange={(e) => setNewSlotLabel(e.target.value)}
                        />
                      </div>
                      <div className="sck-form-row">
                        <label>Tag Badge</label>
                        <input
                          type="text"
                          placeholder="e.g. Prime, Popular"
                          maxLength={20}
                          value={newSlotBadge}
                          onChange={(e) => setNewSlotBadge(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button type="submit" className="sck-btn-teal">
                        Add Time Slot
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: SYSTEM BACKUP & FACTORY RESET */}
          {/* ========================================================= */}
          {activeTab === 'system' && (
            <div className="sck-tab-pane">
              <div className="sck-pane-header">
                <div>
                  <h2 className="sck-pane-title">System Storage &amp; Backup</h2>
                  <p className="sck-pane-subtitle">Export current records or revert database state to initial factory presets.</p>
                </div>
              </div>

              <div className="sck-admin-system-grid">
                <div className="sck-system-card is-supabase">
                  <div className="sck-system-card-header">
                    <div className="sck-supabase-logo-row">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M12.98 2.01L3.5 13.5h7.24l-1.72 8.49L18.5 10.5h-7.24l1.72-8.49z" fill="#3ECF8E" />
                      </svg>
                      <h3 className="sck-system-card-title">Supabase Cloud Database</h3>
                    </div>
                    <span className="sck-supabase-badge">
                      <span className="sck-pulse-dot" /> Connected &amp; Ready
                    </span>
                  </div>
                  <p className="sck-system-card-desc">
                    Connected to remote PostgreSQL instance for cloud synchronization of bookings, guest contacts, and reviews.
                  </p>
                  <div className="sck-supabase-meta">
                    <div className="sck-supabase-meta-item">
                      <span className="sck-meta-label">Endpoint:</span>
                      <code className="sck-meta-code">{SUPABASE_URL}</code>
                    </div>
                    <div className="sck-supabase-meta-item">
                      <span className="sck-meta-label">Key Status:</span>
                      <span className="sck-meta-text">Publishable Key Active</span>
                    </div>
                    <div className="sck-supabase-meta-item">
                      <span className="sck-meta-label">Sync Tables:</span>
                      <span className="sck-meta-text">bookings, contacts, reviews</span>
                    </div>
                  </div>
                  <div className="sck-system-card-actions">
                    <button
                      type="button"
                      className="sck-btn-teal"
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase}
                    >
                      {isTestingSupabase ? 'Pinging Cloud...' : '⚡ Test Live Ping'}
                    </button>
                    <button
                      type="button"
                      className="sck-btn-secondary"
                      onClick={handleCopySupabaseSchema}
                      title="Copy SQL Table & RLS Schema for Supabase SQL Editor"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 6 }}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy SQL Schema
                    </button>
                  </div>
                </div>

                <div className="sck-system-card">
                  <h3 className="sck-system-card-title">Export Salon Data</h3>
                  <p className="sck-system-card-desc">
                    Download a full JSON backup of all services, bookings, client records, and testimonials.
                  </p>
                  <button
                    type="button"
                    className="sck-btn-teal"
                    onClick={handleExportData}
                  >
                    Download JSON Backup ↓
                  </button>
                </div>

                <div className="sck-system-card is-danger">
                  <h3 className="sck-system-card-title">Factory Reset</h3>
                  <p className="sck-system-card-desc">
                    Erase all local modifications and restore original Fifth Avenue curated services and test bookings.
                  </p>
                  <button
                    type="button"
                    className="sck-btn-danger"
                    onClick={() => setIsResetConfirmOpen(true)}
                  >
                    Reset Atelier to Factory State
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL: VIEW BOOKING DOSSIER / USER SUBMISSION DETAILS */}
      {/* ========================================================= */}
      {selectedBookingDetail && (
        <div className="sck-modal-backdrop" onClick={() => setSelectedBookingDetail(null)}>
          <div className="sck-modal-dialog sck-dossier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sck-modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0 }}>Reservation Dossier</h3>
                  <span className={`sck-status-pill is-${(selectedBookingDetail.status || 'pending').toLowerCase()}`}>
                    {selectedBookingDetail.status || 'Pending'}
                  </span>
                </div>
                <p className="sck-modal-subtitle" style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
                  Reference: <strong className="sck-code-tag" style={{ color: 'var(--sck-gold-primary, #d4af37)', fontSize: '0.88rem' }}>{selectedBookingDetail.code || selectedBookingDetail.id}</strong>
                  {(() => {
                    const parsed = parseBookingCode(selectedBookingDetail.code)
                    if (parsed) {
                      return (
                        <span style={{ marginLeft: 6, color: '#a7f3d0', fontSize: '0.78rem', background: 'rgba(80, 200, 160, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                          ✓ Recognized User: {parsed.initials} &bull; ..{parsed.userPhoneRef}
                        </span>
                      )
                    }
                    return null
                  })()}
                  {selectedBookingDetail.createdAt && ` · Submitted ${new Date(selectedBookingDetail.createdAt).toLocaleString()}`}
                </p>
              </div>
              <button
                type="button"
                className="sck-modal-close"
                onClick={() => setSelectedBookingDetail(null)}
              >
                ✕
              </button>
            </div>

            <div className="sck-dossier-body">
              {/* Client Info Card */}
              <div className="sck-dossier-section">
                <h4 className="sck-dossier-sec-title">Client Contact &amp; Profile</h4>
                <div className="sck-dossier-grid">
                  <div className="sck-dossier-item">
                    <span className="sck-dossier-label">Full Name</span>
                    <strong className="sck-dossier-val-lg">{selectedBookingDetail.guestName || selectedBookingDetail.client_name || 'Guest'}</strong>
                  </div>
                  <div className="sck-dossier-item">
                    <span className="sck-dossier-label">Mobile (WhatsApp)</span>
                    <div className="sck-dossier-phone-row">
                      <strong className="sck-dossier-val">{selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone || 'None'}</strong>
                      {(selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone) && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          <a
                            href={`https://wa.me/${formatCleanWhatsApp(selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sck-contact-chip is-wa"
                            title="Open direct WhatsApp conversation"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 4 }}>
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone}`}
                            className="sck-contact-chip is-copy"
                          >
                            Call
                          </a>
                          <button
                            type="button"
                            className="sck-contact-chip is-copy"
                            onClick={() => handleCopyPhone(selectedBookingDetail.id, selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone)}
                          >
                            {copiedPhoneId === selectedBookingDetail.id ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedBookingDetail.guestEmail && (
                    <div className="sck-dossier-item">
                      <span className="sck-dossier-label">Email Address</span>
                      <a href={`mailto:${selectedBookingDetail.guestEmail}`} style={{ color: 'var(--sck-gold-primary, #d4af37)', textDecoration: 'none' }}>
                        {selectedBookingDetail.guestEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Requests / Hair Goals */}
              <div className="sck-dossier-section">
                <h4 className="sck-dossier-sec-title">Special Requests / Hair Goals</h4>
                {(selectedBookingDetail.notes || selectedBookingDetail.guestNotes) ? (
                  <div className="sck-dossier-notes-box">
                    <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.5, color: '#f5f5f5' }}>
                      &ldquo;{selectedBookingDetail.notes || selectedBookingDetail.guestNotes}&rdquo;
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: 0, opacity: 0.5, fontStyle: 'italic', fontSize: '0.88rem' }}>
                    No special requests or hair transformation goals specified by guest.
                  </p>
                )}

                {/* Silent Chair Feature Indicator */}
                <div style={{ marginTop: '12px' }}>
                  {(selectedBookingDetail.isQuietChair || selectedBookingDetail.quiet_chair) ? (
                    <div className="sck-dossier-silent-badge is-active">
                      <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>🤫</span>
                      <div>
                        <strong>Silent Chair Requested</strong>
                        <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
                          Guest requested minimal dialogue for deep acoustic relaxation &amp; tranquility.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="sck-dossier-silent-badge is-standard">
                      <span style={{ fontSize: '1rem', marginRight: '8px' }}>💬</span>
                      <div>
                        <strong style={{ opacity: 0.75 }}>Standard Consultation Chair</strong>
                        <div style={{ fontSize: '0.78rem', opacity: 0.55, marginTop: '1px' }}>
                          Standard salon conversation &amp; consultation preferred.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Service & Appointment Details */}
              <div className="sck-dossier-section">
                <h4 className="sck-dossier-sec-title">Treatment &amp; Schedule</h4>
                <div className="sck-dossier-grid">
                  <div className="sck-dossier-item">
                    <span className="sck-dossier-label">Treatment Service</span>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{selectedBookingDetail.serviceName || selectedBookingDetail.service_name}</strong>
                  </div>
                  <div className="sck-dossier-item">
                    <span className="sck-dossier-label">Rate / Reservation Estimate</span>
                    <span className="sck-price-badge">{formatPrice(selectedBookingDetail.servicePrice || selectedBookingDetail.service_price)}</span>
                  </div>
                  <div className="sck-dossier-item">
                    <span className="sck-dossier-label">Stylist &amp; Station</span>
                    <span>{selectedBookingDetail.stylist || 'Barber Hub Dedicated Chair'}</span>
                  </div>
                  <div className="sck-dossier-item">
                    <span className="sck-dossier-label">Scheduled Date &amp; Time</span>
                    <strong>{selectedBookingDetail.date} at {selectedBookingDetail.time}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="sck-modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="sck-btn-ghost"
                  onClick={() => handleUpdateBookingStatus(selectedBookingDetail.id, 'Confirmed')}
                >
                  ✓ Confirm
                </button>
                <button
                  type="button"
                  className="sck-btn-ghost"
                  onClick={() => handleUpdateBookingStatus(selectedBookingDetail.id, 'Completed')}
                >
                  Mark Completed
                </button>
                <button
                  type="button"
                  className="sck-btn-ghost"
                  style={{ color: '#e57373' }}
                  onClick={() => handleUpdateBookingStatus(selectedBookingDetail.id, 'Cancelled')}
                >
                  Cancel
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {(selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone) && (
                  <a
                    href={`https://wa.me/${formatCleanWhatsApp(selectedBookingDetail.guestPhone || selectedBookingDetail.client_phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sck-btn-teal"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    Contact on WhatsApp →
                  </a>
                )}
                <button
                  type="button"
                  className="sck-btn-ghost"
                  onClick={() => setSelectedBookingDetail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD WALK-IN RESERVATION */}
      {/* ========================================================= */}
      {isAddBookingModalOpen && (
        <div className="sck-modal-backdrop" onClick={() => setIsAddBookingModalOpen(false)}>
          <div className="sck-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sck-modal-header">
              <h3>Create In-Salon Reservation</h3>
              <button
                type="button"
                className="sck-modal-close"
                onClick={() => setIsAddBookingModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="sck-modal-form">
              <div className="sck-form-row">
                <label>Guest Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  maxLength={60}
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                />
              </div>

              <div className="sck-form-grid-2">
                <div className="sck-form-row">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 (212) 555-0199"
                    maxLength={18}
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                  />
                </div>
                <div className="sck-form-row">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="guest@domain.com"
                    maxLength={80}
                    value={newGuestEmail}
                    onChange={(e) => setNewGuestEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="sck-form-row">
                <label>Treatment Service</label>
                <select
                  value={newBookingService}
                  onChange={(e) => setNewBookingService(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({formatPrice(s.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sck-form-grid-2">
                <div className="sck-form-row">
                  <label>Reservation Date</label>
                  <input
                    type="date"
                    value={newBookingDate}
                    onChange={(e) => setNewBookingDate(e.target.value)}
                  />
                </div>
                <div className="sck-form-row">
                  <label>
                    Time Slot {isNewSlotBooked && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>[Already Booked]</span>}
                  </label>
                  <select
                    value={newBookingTime}
                    onChange={(e) => setNewBookingTime(e.target.value)}
                    style={isNewSlotBooked ? { borderColor: '#ef4444' } : {}}
                  >
                    {[
                      '09:30 AM', '10:30 AM', '11:30 AM', '01:00 PM',
                      '02:15 PM', '03:30 PM', '04:30 PM', '05:30 PM', '06:30 PM', '07:15 PM'
                    ].map((t) => {
                      const booked = isTimeSlotBooked(newBookingDate, t, bookings)
                      return (
                        <option key={t} value={t} disabled={booked}>
                          {t} {booked ? '— [Reserved / Booked]' : '— Available'}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {isNewSlotBooked && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.84rem',
                  color: '#fca5a5'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span><strong>Double-Booking Conflict:</strong> An active reservation is already scheduled for <strong>{newBookingDate}</strong> at <strong>{newBookingTime}</strong>. Please choose another time.</span>
                </div>
              )}

              <div className="sck-form-row">
                <label className="sck-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newBookingQuiet}
                    onChange={(e) => setNewBookingQuiet(e.target.checked)}
                  />
                  <span>Quiet Chair Request (Minimal conversation during treatment)</span>
                </label>
              </div>

              <div className="sck-modal-actions">
                <button
                  type="button"
                  className="sck-btn-secondary"
                  onClick={() => setIsAddBookingModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sck-btn-teal"
                  disabled={isNewSlotBooked}
                  style={isNewSlotBooked ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {isNewSlotBooked ? 'Slot Unavailable' : 'Save Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD SERVICE */}
      {/* ========================================================= */}
      {isAddServiceModalOpen && (
        <div className="sck-modal-backdrop" onClick={() => setIsAddServiceModalOpen(false)}>
          <div className="sck-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sck-modal-header">
              <h3>Add New Salon Service</h3>
              <button
                type="button"
                className="sck-modal-close"
                onClick={() => setIsAddServiceModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateService} className="sck-modal-form">
              <div className="sck-form-row">
                <label>Service Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Japanese Scalp Head Spa"
                  maxLength={80}
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                />
              </div>

              <div className="sck-form-grid-2">
                <div className="sck-form-row">
                  <label>Category</label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                  >
                    <option value="cut">Cut &amp; Styling</option>
                    <option value="color">Color &amp; Balayage</option>
                    <option value="treatments">Hair Treatments</option>
                    <option value="makeup">Makeup Artistry</option>
                    <option value="bridal">Bridal Atelier</option>
                    <option value="perms">Perms &amp; Relaxer</option>
                    <option value="nails">Nail Care</option>
                  </select>
                </div>

                <div className="sck-form-row">
                  <label>Price (in Rs) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rs 180+"
                    maxLength={20}
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="sck-form-grid-2">
                <div className="sck-form-row">
                  <label>Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 60 min"
                    maxLength={20}
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(e.target.value)}
                  />
                </div>

                <div className="sck-form-row">
                  <label>Image Reference</label>
                  <select
                    value={newServiceImg}
                    onChange={(e) => setNewServiceImg(e.target.value)}
                  >
                    <option value="/images/services/cut-styling.jpg">Cut &amp; Styling</option>
                    <option value="/images/services/color.jpg">Color</option>
                    <option value="/images/services/conditioning.jpg">Conditioning</option>
                    <option value="/images/services/makeup.jpg">Makeup</option>
                    <option value="/images/services/bridal.jpg">Bridal</option>
                    <option value="/images/services/perms-relaxer.jpg">Perms &amp; Relaxer</option>
                    <option value="/images/services/nails.jpg">Nails</option>
                  </select>
                </div>
              </div>

              <div className="sck-form-row">
                <label>Description</label>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Detail the consultation, formulation, and finish of this service..."
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                />
              </div>

              <div className="sck-modal-actions">
                <button
                  type="button"
                  className="sck-btn-secondary"
                  onClick={() => setIsAddServiceModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sck-btn-teal">
                  Add to Live Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD CLIENT TESTIMONIAL */}
      {/* ========================================================= */}
      {isAddReviewModalOpen && (
        <div className="sck-modal-backdrop" onClick={() => setIsAddReviewModalOpen(false)}>
          <div className="sck-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sck-modal-header">
              <h3>Publish Client Testimonial</h3>
              <button
                type="button"
                className="sck-modal-close"
                onClick={() => setIsAddReviewModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="sck-modal-form">
              <div className="sck-form-row">
                <label>Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Carolyn Pianin"
                  maxLength={50}
                  value={newReviewAuthor}
                  onChange={(e) => setNewReviewAuthor(e.target.value)}
                />
              </div>

              <div className="sck-form-grid-2">
                <div className="sck-form-row">
                  <label>Title / Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Fifth Avenue Patron"
                    maxLength={50}
                    value={newReviewRole}
                    onChange={(e) => setNewReviewRole(e.target.value)}
                  />
                </div>

                <div className="sck-form-row">
                  <label>Star Rating</label>
                  <select
                    value={newReviewRating}
                    onChange={(e) => setNewReviewRating(e.target.value)}
                  >
                    <option value={5}>★★★★★ (5 Stars)</option>
                    <option value={4}>★★★★☆ (4 Stars)</option>
                    <option value={3}>★★★☆☆ (3 Stars)</option>
                  </select>
                </div>
              </div>

              <div className="sck-form-row">
                <label>Testimonial Text *</label>
                <textarea
                  rows={3}
                  required
                  maxLength={400}
                  placeholder="Share the client's words on their hair transformation..."
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                />
              </div>

              <div className="sck-modal-actions">
                <button
                  type="button"
                  className="sck-btn-secondary"
                  onClick={() => setIsAddReviewModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sck-btn-teal">
                  Publish Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET CONFIRMATION */}
      {/* ========================================================= */}
      {isResetConfirmOpen && (
        <div className="sck-modal-backdrop" onClick={() => setIsResetConfirmOpen(false)}>
          <div className="sck-modal-dialog is-warning" onClick={(e) => e.stopPropagation()}>
            <div className="sck-modal-header">
              <h3>Confirm Factory Reset</h3>
              <button
                type="button"
                className="sck-modal-close"
                onClick={() => setIsResetConfirmOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="sck-modal-body">
              <p>
                Are you sure you want to revert all salon data to original factory defaults?
              </p>
              <p className="sck-warning-note">
                This will reset all newly added appointments, custom services, and modified prices back to the curated presets.
              </p>
            </div>
            <div className="sck-modal-actions">
              <button
                type="button"
                className="sck-btn-secondary"
                onClick={() => setIsResetConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sck-btn-danger"
                onClick={handleExecuteReset}
              >
                Yes, Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
