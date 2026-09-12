import React, { useState, useEffect, useMemo } from 'react'
import { INITIAL_SERVICES, formatPrice, STORAGE_KEY } from '../data/initialData'
import {
  syncBookingToSupabase,
  fetchBookingsFromSupabase,
  normalizeTimeStr,
  isTimeSlotBooked
} from '../supabase'
import { generateUniqueBookingCode, extractPhoneLast4 } from '../utils/bookingCode.js'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIME_SLOTS_DATA = [
  { id: 't1', time: '09:30 AM', period: 'morning', label: 'Morning Light', badge: 'Available' },
  { id: 't2', time: '10:30 AM', period: 'morning', label: 'Morning High', badge: 'Popular' },
  { id: 't3', time: '11:30 AM', period: 'morning', label: 'Midday Prime', badge: 'Prime' },
  { id: 't4', time: '01:00 PM', period: 'afternoon', label: 'Early Afternoon', badge: 'Available' },
  { id: 't5', time: '02:15 PM', period: 'afternoon', label: 'Mid Afternoon', badge: 'Popular' },
  { id: 't6', time: '03:30 PM', period: 'afternoon', label: 'Late Afternoon', badge: 'Available' },
  { id: 't7', time: '04:30 PM', period: 'afternoon', label: 'Sunset Glow', badge: 'Prime' },
  { id: 't8', time: '05:30 PM', period: 'evening', label: 'Fifth Ave Twilight', badge: 'Available' },
  { id: 't9', time: '06:30 PM', period: 'evening', label: 'Evening Couture', badge: 'Peak Slot' },
  { id: 't10', time: '07:15 PM', period: 'evening', label: 'Late Salon Session', badge: 'VIP Evening' },
]

function CheckCircleIcon({ size = 52 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold, #ff9000)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  )
}

function calculateEndTime(startTimeStr, durationStr = '60 min') {
  try {
    const match = startTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return ''
    let hour = parseInt(match[1], 10)
    let minute = parseInt(match[2], 10)
    const ampm = match[3].toUpperCase()

    if (ampm === 'PM' && hour !== 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0

    const durMatch = durationStr.match(/(\d+)/)
    const durationMinutes = durMatch ? parseInt(durMatch[1], 10) : 60

    const totalMinutes = hour * 60 + minute + durationMinutes
    let endHour = Math.floor(totalMinutes / 60) % 24
    let endMin = totalMinutes % 60

    const endAmpm = endHour >= 12 ? 'PM' : 'AM'
    let displayHour = endHour % 12
    if (displayHour === 0) displayHour = 12

    const displayMin = endMin < 10 ? `0${endMin}` : endMin
    return `${displayHour}:${displayMin} ${endAmpm}`
  } catch {
    return ''
  }
}

export function getLocalDateStr(date = new Date()) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseSlotDateTime(dateStr, timeStr) {
  try {
    if (!dateStr || !timeStr) return null
    const parts = dateStr.split('-')
    if (parts.length !== 3) return null
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)

    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return null

    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const ampm = match[3].toUpperCase()

    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0

    return new Date(year, month - 1, day, hours, minutes, 0, 0)
  } catch {
    return null
  }
}

export function isSlotPassed(dateStr, timeStr, refTime = new Date()) {
  const slotDate = parseSlotDateTime(dateStr, timeStr)
  if (!slotDate) return false
  return slotDate.getTime() <= refTime.getTime()
}

export default function BookingPage({
  services = INITIAL_SERVICES,
  bookings = [],
  timetable = {},
  preselectedService = null,
  onBookSuccess,
  onNavigate
}) {
  // Cloud bookings fetched from Supabase
  const [cloudBookings, setCloudBookings] = useState([])
  const [slotConflictMsg, setSlotConflictMsg] = useState(null)

  // Fetch live active reservations from Supabase on mount
  useEffect(() => {
    let isMounted = true
    fetchBookingsFromSupabase().then((data) => {
      if (isMounted && data && data.length > 0) {
        setCloudBookings(data)
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Combined pool of all active bookings (local state + cloud)
  const allBookings = useMemo(() => {
    const map = new Map()
    bookings.forEach((b) => {
      if (b.id) map.set(b.id, b)
    })
    cloudBookings.forEach((b) => {
      if (b.id) map.set(b.id, b)
    })
    return Array.from(map.values())
  }, [bookings, cloudBookings])

  // Read service or stylist from URL query parameters or preselectedService prop if present
  const [selectedService, setSelectedService] = useState(() => {
    if (preselectedService) {
      const match = services.find(
        (s) => s.name.toLowerCase() === preselectedService.toLowerCase() ||
               s.category.toLowerCase() === preselectedService.toLowerCase() ||
               s.id === preselectedService
      )
      if (match) return match
    }
    try {
      const params = new URLSearchParams(window.location.search)
      const queryServiceName = params.get('service')
      if (queryServiceName) {
        const found = services.find(
          (s) => s.name.toLowerCase() === queryServiceName.toLowerCase() ||
                 s.category.toLowerCase() === queryServiceName.toLowerCase()
        )
        if (found) return found
      }
    } catch {
      // Fallback
    }
    return services[0] || null
  })

  // Synchronize when preselectedService changes
  useEffect(() => {
    if (preselectedService) {
      const match = services.find(
        (s) => s.name.toLowerCase() === preselectedService.toLowerCase() ||
               s.category.toLowerCase() === preselectedService.toLowerCase() ||
               s.id === preselectedService
      )
      if (match) setSelectedService(match)
    }
  }, [preselectedService, services])

  // Real-time clock state (updates every 15s to keep slot availability strictly real-time)
  const [currentRealTime, setCurrentRealTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentRealTime(new Date())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  // Date states
  const today = currentRealTime
  const todayStr = useMemo(() => getLocalDateStr(currentRealTime), [currentRealTime])
  const tomorrowStr = useMemo(() => {
    const tm = new Date(currentRealTime)
    tm.setDate(tm.getDate() + 1)
    return getLocalDateStr(tm)
  }, [currentRealTime])

  const [bookingDate, setBookingDate] = useState(() => {
    const now = new Date()
    const tStr = getLocalDateStr(now)
    // Check if any slot is still unpassed today
    const hasRemainingToday = TIME_SLOTS_DATA.some((s) => !isSlotPassed(tStr, s.time, now))
    if (hasRemainingToday) {
      return tStr
    }
    const tm = new Date(now)
    tm.setDate(tm.getDate() + 1)
    return getLocalDateStr(tm)
  })

  // Calendar View month & year
  const [calYear, setCalYear] = useState(() => {
    const parts = bookingDate.split('-').map(Number)
    return parts[0] || new Date().getFullYear()
  })
  const [calMonth, setCalMonth] = useState(() => {
    const parts = bookingDate.split('-').map(Number)
    return parts[1] ? parts[1] - 1 : new Date().getMonth()
  })

  // Time states
  const [timeFilter, setTimeFilter] = useState('all') // 'all' | 'morning' | 'afternoon' | 'evening' | 'custom'
  const [bookingTime, setBookingTime] = useState('11:30 AM')
  const [customHour, setCustomHour] = useState('11')
  const [customMin, setCustomMin] = useState('30')
  const [customAmpm, setCustomAmpm] = useState('AM')

  // Guest details
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestNotes, setGuestNotes] = useState('')
  const [isQuietChair, setIsQuietChair] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrorMsg, setSubmitErrorMsg] = useState(null)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  // Listen for changes in URL search params
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const srvParam = params.get('service')
      if (srvParam) {
        const match = services.find(
          (s) => s.name.toLowerCase() === srvParam.toLowerCase() ||
                 s.category.toLowerCase() === srvParam.toLowerCase()
        )
        if (match) setSelectedService(match)
      }
    } catch {
      // ignore
    }
  }, [services])

  // Calendar computation
  const daysInMonth = useMemo(() => {
    return new Date(calYear, calMonth + 1, 0).getDate()
  }, [calYear, calMonth])

  const firstDayWeekday = useMemo(() => {
    return new Date(calYear, calMonth, 1).getDay()
  }, [calYear, calMonth])

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear((y) => y - 1)
    } else {
      setCalMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear((y) => y + 1)
    } else {
      setCalMonth((m) => m + 1)
    }
  }

  const isDateClosed = (year, month, day) => {
    if (!timetable?.workingDays || !Array.isArray(timetable.workingDays)) return false
    const d = new Date(year, month, day)
    const dayName = DAY_NAMES[d.getDay()]
    const config = timetable.workingDays.find((item) => item.day === dayName)
    return config ? config.isOpen === false : false
  }

  const handleSelectDay = (dayNum) => {
    if (isDateClosed(calYear, calMonth, dayNum)) {
      const d = new Date(calYear, calMonth, dayNum)
      const dayName = DAY_NAMES[d.getDay()]
      setSlotConflictMsg(`Notice: Barber Hub is closed on ${dayName}s. Please choose an open day.`)
      return
    }
    const mm = String(calMonth + 1).padStart(2, '0')
    const dd = String(dayNum).padStart(2, '0')
    const newDateStr = `${calYear}-${mm}-${dd}`
    setBookingDate(newDateStr)
    setSlotConflictMsg(null)
  }

  const handleQuickPreset = (preset) => {
    const target = new Date(currentRealTime)
    if (preset === 'today') {
      // keep target as today
    } else if (preset === 'tomorrow') {
      target.setDate(target.getDate() + 1)
    } else if (preset === 'in3days') {
      target.setDate(target.getDate() + 3)
    } else if (preset === 'weekend') {
      const day = target.getDay()
      const diff = day === 6 ? 7 : (6 - day)
      target.setDate(target.getDate() + diff)
    } else if (preset === 'nextweek') {
      target.setDate(target.getDate() + 7)
    }
    const newDateStr = getLocalDateStr(target)
    setBookingDate(newDateStr)
    setCalYear(target.getFullYear())
    setCalMonth(target.getMonth())
    setSlotConflictMsg(null)
  }

  // Calculate all time slots that have already been reserved for the currently selected date
  const bookedTimesOnSelectedDate = useMemo(() => {
    const set = new Set()
    allBookings.forEach((b) => {
      const bDate = b.date || b.appointment_date
      const bTime = normalizeTimeStr(b.time || b.appointment_time)
      const status = (b.status || '').toLowerCase()
      if (bDate === bookingDate && status !== 'cancelled' && bTime) {
        set.add(bTime)
      }
    })
    return set
  }, [allBookings, bookingDate])

  // Check if every slot is unavailable for the selected date
  const allSlotsUnavailable = useMemo(() => {
    const pool = timetable?.timeSlots && Array.isArray(timetable.timeSlots) && timetable.timeSlots.length > 0
      ? timetable.timeSlots.filter((s) => s.active !== false)
      : TIME_SLOTS_DATA
    return pool.length > 0 && pool.every(
      (s) => bookedTimesOnSelectedDate.has(normalizeTimeStr(s.time)) || isSlotPassed(bookingDate, s.time, currentRealTime)
    )
  }, [bookedTimesOnSelectedDate, bookingDate, timetable, currentRealTime])

  // Check if Today has upcoming slots left
  const isTodayAvailable = useMemo(() => {
    if (isDateClosed(currentRealTime.getFullYear(), currentRealTime.getMonth(), currentRealTime.getDate())) {
      return false
    }
    const pool = timetable?.timeSlots && Array.isArray(timetable.timeSlots) && timetable.timeSlots.length > 0
      ? timetable.timeSlots.filter((s) => s.active !== false)
      : TIME_SLOTS_DATA
    return pool.some((s) => !isSlotPassed(todayStr, s.time, currentRealTime))
  }, [currentRealTime, timetable, todayStr])

  // Automatically switch bookingTime if the current selection is already booked or passed for this date
  useEffect(() => {
    const pool = timetable?.timeSlots && Array.isArray(timetable.timeSlots) && timetable.timeSlots.length > 0
      ? timetable.timeSlots.filter((s) => s.active !== false)
      : TIME_SLOTS_DATA

    const norm = normalizeTimeStr(bookingTime)
    const isBooked = bookedTimesOnSelectedDate.has(norm)
    const isPassed = isSlotPassed(bookingDate, bookingTime, currentRealTime)

    if (isBooked || isPassed) {
      const firstAvailable = pool.find(
        (s) => !bookedTimesOnSelectedDate.has(normalizeTimeStr(s.time)) && !isSlotPassed(bookingDate, s.time, currentRealTime)
      )
      if (firstAvailable) {
        setBookingTime(firstAvailable.time)
        setSlotConflictMsg(null)
      }
    }
  }, [bookedTimesOnSelectedDate, bookingDate, timetable, currentRealTime])

  const handleApplyCustomTime = () => {
    const timeStr = `${customHour}:${customMin} ${customAmpm}`
    if (isSlotPassed(bookingDate, timeStr, currentRealTime)) {
      setSlotConflictMsg(`Notice: The time ${timeStr} has already passed for today (${formattedSelectedDate}). Please select an upcoming time slot.`)
      return
    }
    if (bookedTimesOnSelectedDate.has(normalizeTimeStr(timeStr))) {
      setSlotConflictMsg(`Notice: The time slot ${timeStr} has already been reserved for this date. Please choose another time.`)
      return
    }
    setSlotConflictMsg(null)
    setBookingTime(timeStr)
  }

  // Filtered Time Slots from Timetable
  const displayedTimeSlots = useMemo(() => {
    const slots = timetable?.timeSlots && Array.isArray(timetable.timeSlots) && timetable.timeSlots.length > 0
      ? timetable.timeSlots.filter((s) => s.active !== false)
      : TIME_SLOTS_DATA
    if (timeFilter === 'all') return slots
    return slots.filter((s) => s.period === timeFilter)
  }, [timeFilter, timetable])

  // Formatted date string for estimate
  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = bookingDate.split('-')
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      }
    } catch {
      // fallback
    }
    return bookingDate
  }, [bookingDate])

  // Calculated End Time
  const calculatedEndTime = useMemo(() => {
    return calculateEndTime(bookingTime, selectedService?.duration || '60 min')
  }, [bookingTime, selectedService])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitErrorMsg(null)

    if (!guestName.trim()) {
      setSubmitErrorMsg('Please enter your full name.')
      return
    }

    if (!guestPhone.trim()) {
      setSubmitErrorMsg('Please provide a mobile phone number for appointment confirmation.')
      return
    }

    // 1. Strict real-time passed-time check
    if (isSlotPassed(bookingDate, bookingTime, currentRealTime)) {
      setSlotConflictMsg(`Notice: The ${bookingTime} time slot on ${formattedSelectedDate} has already passed. Please choose an upcoming time slot or another date.`)
      const el = document.querySelector('.sck-time-sets-card')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      return
    }

    // 2. Strict double-booking prevention check
    if (bookedTimesOnSelectedDate.has(normalizeTimeStr(bookingTime))) {
      setSlotConflictMsg(`Notice: The ${bookingTime} time slot on ${formattedSelectedDate} has already been reserved. Please choose an open slot.`)
      const el = document.querySelector('.sck-time-sets-card')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      return
    }

    setIsSubmitting(true)
    const bookingId = 'bk-' + Date.now()
    const code = generateUniqueBookingCode(guestName, guestPhone, '', allBookings, bookingId)
    setConfirmationCode(code)

    const newBooking = {
      id: bookingId,
      code: code,
      guestName: guestName.trim(),
      client_name: guestName.trim(),
      guestPhone: guestPhone.trim(),
      client_phone: guestPhone.trim(),
      guestNotes: guestNotes.trim(),
      notes: guestNotes.trim(),
      serviceName: selectedService?.name || 'Cut & Styling',
      service_name: selectedService?.name || 'Cut & Styling',
      servicePrice: formatPrice(selectedService?.price || 'Rs 150+'),
      service_price: formatPrice(selectedService?.price || 'Rs 150+'),
      stylist: 'Fifth Avenue Master Stylist',
      date: bookingDate,
      appointment_date: bookingDate,
      time: bookingTime,
      appointment_time: bookingTime,
      isQuietChair: isQuietChair,
      quiet_chair: isQuietChair,
      status: 'Confirmed',
      createdAt: getLocalDateStr(new Date()),
      created_at: new Date().toISOString()
    }

    try {
      // 3. Attempt sync to Supabase (detects remote database conflicts)
      const syncRes = await syncBookingToSupabase(newBooking)
      if (syncRes?.conflict) {
        setSlotConflictMsg(syncRes.error)
        setIsSubmitting(false)
        const el = document.querySelector('.sck-time-sets-card')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        fetchBookingsFromSupabase().then((data) => {
          if (data && data.length > 0) setCloudBookings(data)
        })
        return
      }

      // 4. Immediately lock slot into local cloud pool
      setCloudBookings((prev) => [newBooking, ...(prev || [])])

      // 5. Notify parent App state safely
      if (onBookSuccess) {
        try {
          onBookSuccess(newBooking)
        } catch (cbErr) {
          console.warn('onBookSuccess callback handled:', cbErr)
        }
      }

      // 6. Direct localStorage persistence fallback
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          parsed.bookings = [newBooking, ...(parsed.bookings || [])]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
      } catch {}

      setIsSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Reservation failed:', err)
      setSubmitErrorMsg('Unable to secure reservation. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadCalendarEvent = () => {
    const startDt = parseSlotDateTime(bookingDate, bookingTime)
    if (!startDt) return
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000)
    const pad = (n) => String(n).padStart(2, '0')
    const formatIcsTime = (d) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barber Hub//Appointment Reservation//EN',
      'BEGIN:VEVENT',
      `UID:${confirmationCode}@barberhub.com`,
      `DTSTAMP:${formatIcsTime(new Date())}`,
      `DTSTART:${formatIcsTime(startDt)}`,
      `DTEND:${formatIcsTime(endDt)}`,
      `SUMMARY:Barber Hub Appointment — ${selectedService?.name || 'Hair Service'}`,
      `DESCRIPTION:Confirmation Code: ${confirmationCode}\\nStylist: Fifth Avenue Master Stylist\\nClient: ${guestName}\\nPhone: ${guestPhone}`,
      'LOCATION:Barber Hub, 587 Fifth Avenue, New York, NY 10017',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `BarberHub-${confirmationCode}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(confirmationCode)
    }
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="sck-page sck-booking-page">
      {/* Photo Hero Centered */}
      <section
        className="sck-photo-hero sck-photo-hero-centered sck-booking-hero"
        style={{ backgroundImage: "url('/images/heroes/booking.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-center-box">
            <span className="sck-photo-hero-eyebrow">Online Reservation</span>
            <h1 className="sck-photo-hero-title">Reserve Your Private Chair</h1>
            <p className="sck-photo-hero-desc" style={{ margin: '0 auto', maxWidth: '560px' }}>
              Personal 1-on-1 diagnostic consultation included. Zero charge until service completion.
            </p>
          </div>
        </div>
      </section>

      {/* Main Booking Content */}
      <section className="sck-booking-page-section">
        <div className="sck-booking-container">
          {!isSubmitted ? (
            <div className="sck-booking-card-wrapper">
              <form onSubmit={handleSubmit} className="sck-booking-full-form">
                <div className="sck-booking-form-header">
                  <div className="sck-booking-header-top">
                    <img src="/logo.png" alt="Barber Hub" className="sck-booking-header-logo" />
                    <span className="sck-booking-badge">Barber Hub Concierge</span>
                  </div>
                  <h2 className="sck-booking-card-title">Schedule Your Fifth Avenue Appointment</h2>
                  <p className="sck-booking-card-subtitle">
                    Select your tailored treatment, date, and preferred time slot. Our team prepares bespoke formulations prior to your arrival.
                  </p>
                </div>

                {/* Step 1: Select Service */}
                <div className="booking-form-step">
                  <label className="form-label">
                    <span className="sck-step-num">1</span> Select Your Treatment
                  </label>
                  <div className="booking-service-options">
                    {services.map((srv) => {
                      const isSelected = selectedService?.id === srv.id
                      return (
                        <div
                          key={srv.id}
                          className={`service-radio-box ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedService(srv)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedService(srv)}
                        >
                          <div className="radio-service-left">
                            <span className="radio-service-name">{srv.name}</span>
                            {srv.desc && (
                              <p className="radio-service-desc">
                                {srv.desc.length > 90 ? srv.desc.slice(0, 90) + '…' : srv.desc}
                              </p>
                            )}
                          </div>
                          <div className="radio-service-meta">
                            <span className="radio-service-price">{formatPrice(srv.price)}</span>
                            <span className="radio-service-duration">{srv.duration}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Step 2: Interactive Calendar & Time Set Options */}
                <div className="booking-form-step">
                  <label className="form-label">
                    <span className="sck-step-num">2</span> Select Date &amp; Time Options
                  </label>

                  <div className="sck-calendar-time-layout">
                    {/* Interactive Custom Calendar */}
                    <div className="sck-calendar-card">
                      <div className="sck-cal-header">
                        <div className="sck-cal-title-wrap">
                          <span className="sck-cal-month-name">
                            {MONTH_NAMES[calMonth]} {calYear}
                          </span>
                          <span className="sck-cal-selected-sub">
                            Selected: <strong>{formattedSelectedDate}</strong>
                          </span>
                        </div>
                        <div className="sck-cal-nav-btns">
                          <button
                            type="button"
                            className="sck-cal-nav-btn"
                            onClick={handlePrevMonth}
                            aria-label="Previous Month"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            className="sck-cal-nav-btn"
                            onClick={handleNextMonth}
                            aria-label="Next Month"
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="sck-cal-presets">
                        {isTodayAvailable && (
                          <button
                            type="button"
                            className={`sck-cal-preset-btn ${bookingDate === todayStr ? 'is-active' : ''}`}
                            onClick={() => handleQuickPreset('today')}
                          >
                            Today
                          </button>
                        )}
                        <button
                          type="button"
                          className={`sck-cal-preset-btn ${bookingDate === tomorrowStr ? 'is-active' : ''}`}
                          onClick={() => handleQuickPreset('tomorrow')}
                        >
                          Tomorrow
                        </button>
                        <button
                          type="button"
                          className="sck-cal-preset-btn"
                          onClick={() => handleQuickPreset('in3days')}
                        >
                          In 3 Days
                        </button>
                        <button
                          type="button"
                          className="sck-cal-preset-btn"
                          onClick={() => handleQuickPreset('weekend')}
                        >
                          Weekend
                        </button>
                        <button
                          type="button"
                          className="sck-cal-preset-btn"
                          onClick={() => handleQuickPreset('nextweek')}
                        >
                          Next Week
                        </button>
                      </div>

                      {/* Weekday Labels */}
                      <div className="sck-cal-weekdays">
                        {DAY_NAMES.map((day) => (
                          <div key={day} className="sck-cal-weekday">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar Days Grid */}
                      <div className="sck-cal-days-grid">
                        {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                          <div key={`empty-${idx}`} className="sck-cal-day is-empty" />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, idx) => {
                          const dayNum = idx + 1
                          const checkDate = new Date(calYear, calMonth, dayNum)
                          // Check if day is before today
                          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                          const isPast = checkDate < todayMidnight
                          const isClosed = isDateClosed(calYear, calMonth, dayNum)

                          // Check if day is currently selected
                          const curTargetParts = bookingDate.split('-').map((p) => parseInt(p, 10))
                          const isSelected =
                            curTargetParts[0] === calYear &&
                            curTargetParts[1] === calMonth + 1 &&
                            curTargetParts[2] === dayNum

                          const isToday =
                            today.getFullYear() === calYear &&
                            today.getMonth() === calMonth &&
                            today.getDate() === dayNum

                          return (
                            <button
                              type="button"
                              key={`day-${dayNum}`}
                              className={`sck-cal-day ${isSelected ? 'is-selected' : ''} ${isPast ? 'is-past' : ''} ${isToday ? 'is-today' : ''} ${isClosed ? 'is-closed' : ''}`}
                              disabled={isPast || isClosed}
                              onClick={() => handleSelectDay(dayNum)}
                              title={isClosed ? 'Closed' : isPast ? 'Past date' : `Select day ${dayNum}`}
                            >
                              <span className="sck-cal-day-num">{dayNum}</span>
                              {isToday && <span className="sck-cal-today-dot" title="Today" />}
                              {isClosed && <span className="sck-cal-closed-indicator">✕</span>}
                            </button>
                          )
                        })}
                      </div>

                      <div className="sck-cal-footer-legend">
                        <span className="legend-item"><span className="legend-dot is-gold" /> Selected</span>
                        <span className="legend-item"><span className="legend-dot is-teal" /> Today</span>
                        <span className="legend-item"><span className="legend-dot is-muted" /> Available</span>
                        <span className="legend-item"><span className="legend-dot is-closed" /> Closed</span>
                      </div>
                    </div>

                    {/* Time Set Options Section */}
                    <div className="sck-time-sets-card">
                      <div className="sck-time-header">
                        <div className="sck-time-title-wrap">
                          <span className="sck-time-title">Time Set Options</span>
                          <span className="sck-time-sub">
                            {bookingTime} {calculatedEndTime ? `(until ~${calculatedEndTime})` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Conflict Notification Banner if slot is taken */}
                      {slotConflictMsg && (
                        <div className="sck-slot-conflict-alert" role="alert">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>{slotConflictMsg}</span>
                        </div>
                      )}

                      {/* Notice Banner if all slots on selected date are unavailable */}
                      {allSlotsUnavailable && (
                        <div className="sck-all-slots-passed-banner" role="alert">
                          <div className="sck-all-slots-passed-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <strong>All sessions for {formattedSelectedDate} are concluded or reserved.</strong>
                            <p>Please select an alternative date on the calendar or jump directly to tomorrow's open chairs.</p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-gold"
                            style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                            onClick={() => handleQuickPreset('tomorrow')}
                          >
                            View Tomorrow →
                          </button>
                        </div>
                      )}

                      {/* Time Set Filter Tabs */}
                      <div className="sck-time-filter-tabs">
                        <button
                          type="button"
                          className={`sck-time-tab ${timeFilter === 'all' ? 'is-active' : ''}`}
                          onClick={() => setTimeFilter('all')}
                        >
                          All Slots
                        </button>
                        <button
                          type="button"
                          className={`sck-time-tab ${timeFilter === 'morning' ? 'is-active' : ''}`}
                          onClick={() => setTimeFilter('morning')}
                        >
                          Morning
                        </button>
                        <button
                          type="button"
                          className={`sck-time-tab ${timeFilter === 'afternoon' ? 'is-active' : ''}`}
                          onClick={() => setTimeFilter('afternoon')}
                        >
                          Afternoon
                        </button>
                        <button
                          type="button"
                          className={`sck-time-tab ${timeFilter === 'evening' ? 'is-active' : ''}`}
                          onClick={() => setTimeFilter('evening')}
                        >
                          Evening
                        </button>
                        <button
                          type="button"
                          className={`sck-time-tab ${timeFilter === 'custom' ? 'is-active' : ''}`}
                          onClick={() => setTimeFilter('custom')}
                        >
                          Custom Time
                        </button>
                      </div>

                      {timeFilter !== 'custom' ? (
                        <div className="sck-time-slot-cards-grid">
                          {displayedTimeSlots.map((slot) => {
                            const normTime = normalizeTimeStr(slot.time)
                            const isBooked = bookedTimesOnSelectedDate.has(normTime)
                            const isPassed = isSlotPassed(bookingDate, slot.time, currentRealTime)
                            const isUnavailable = isBooked || isPassed
                            const isChosen = bookingTime === slot.time && !isUnavailable
                            const finish = calculateEndTime(slot.time, selectedService?.duration || '60 min')
                            return (
                              <div
                                key={slot.id}
                                className={`sck-time-slot-card ${isChosen ? 'is-chosen' : ''} ${isBooked ? 'is-booked' : isPassed ? 'is-passed' : ''}`}
                                onClick={() => {
                                  if (isBooked) {
                                    setSlotConflictMsg(`Notice: The ${slot.time} slot on ${formattedSelectedDate} has already been reserved. Please choose an open slot.`)
                                    return
                                  }
                                  if (isPassed) {
                                    setSlotConflictMsg(`Notice: The ${slot.time} slot has already passed for today (${formattedSelectedDate}). Please select an upcoming slot.`)
                                    return
                                  }
                                  setBookingTime(slot.time)
                                  setSlotConflictMsg(null)
                                }}
                                role="button"
                                aria-disabled={isUnavailable}
                                tabIndex={isUnavailable ? -1 : 0}
                                title={
                                  isBooked
                                    ? `Reserved: ${slot.time} on ${formattedSelectedDate} is already booked`
                                    : isPassed
                                    ? `Passed: ${slot.time} has already passed for today (${formattedSelectedDate})`
                                    : `Select ${slot.time}`
                                }
                                onKeyDown={(e) => {
                                  if (!isUnavailable && (e.key === 'Enter' || e.key === ' ')) {
                                    setBookingTime(slot.time)
                                    setSlotConflictMsg(null)
                                  }
                                }}
                              >
                                <div className="sck-time-slot-top">
                                  <span className="sck-time-val">{slot.time}</span>
                                  {isBooked ? (
                                    <span className="sck-time-badge is-booked">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: 4, display: 'inline-block', verticalAlign: '-1px'}}>
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                      </svg>
                                      Reserved
                                    </span>
                                  ) : isPassed ? (
                                    <span className="sck-time-badge is-booked is-passed-badge">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: 4, display: 'inline-block', verticalAlign: '-1px'}}>
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                      </svg>
                                      Passed
                                    </span>
                                  ) : (
                                    <span className={`sck-time-badge is-${slot.badge.toLowerCase().replace(/\s+/g, '-')}`}>
                                      {slot.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="sck-time-slot-bottom">
                                  <span className="sck-time-slot-label">
                                    {isBooked ? 'Slot Unavailable' : isPassed ? 'Time Passed' : slot.label}
                                  </span>
                                  {isBooked ? (
                                    <span className="sck-time-finish is-booked-sub">Already Reserved</span>
                                  ) : isPassed ? (
                                    <span className="sck-time-finish is-booked-sub">Passed for Today</span>
                                  ) : (
                                    finish && <span className="sck-time-finish">until {finish}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="sck-custom-time-picker">
                          <p className="sck-custom-time-desc">
                            Select a bespoke arrival time for your Fifth Avenue private appointment:
                          </p>
                          <div className="sck-custom-picker-row">
                            <div className="sck-picker-col">
                              <label className="picker-lbl">Hour</label>
                              <select
                                className="sck-custom-select"
                                value={customHour}
                                onChange={(e) => setCustomHour(e.target.value)}
                              >
                                {['09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'].map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>

                            <span className="sck-picker-colon">:</span>

                            <div className="sck-picker-col">
                              <label className="picker-lbl">Minute</label>
                              <select
                                className="sck-custom-select"
                                value={customMin}
                                onChange={(e) => setCustomMin(e.target.value)}
                              >
                                {['00', '15', '30', '45'].map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            <div className="sck-picker-col">
                              <label className="picker-lbl">Period</label>
                              <div className="sck-ampm-toggle">
                                <button
                                  type="button"
                                  className={`ampm-btn ${customAmpm === 'AM' ? 'is-active' : ''}`}
                                  onClick={() => setCustomAmpm('AM')}
                                >
                                  AM
                                </button>
                                <button
                                  type="button"
                                  className={`ampm-btn ${customAmpm === 'PM' ? 'is-active' : ''}`}
                                  onClick={() => setCustomAmpm('PM')}
                                >
                                  PM
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn btn-gold sck-apply-custom-btn"
                              onClick={handleApplyCustomTime}
                            >
                              Set Slot
                            </button>
                          </div>

                          <div className="sck-custom-time-preview">
                            Active Time: <strong>{bookingTime}</strong> {calculatedEndTime ? `· Session finishes approx ${calculatedEndTime}` : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 3: Guest Information & Preferences */}
                <div className="booking-form-step">
                  <label className="form-label">
                    <span className="sck-step-num">3</span> Guest Information &amp; Preferences
                  </label>
                  <div className="guest-info-grid">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="input-sublabel" htmlFor="guest-name-input">Full Name *</label>
                        <span className="sck-char-limit-badge">{guestName.length}/60</span>
                      </div>
                      <input
                        id="guest-name-input"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Eleanor Vance"
                        maxLength={60}
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="input-sublabel" htmlFor="guest-phone-input">Mobile Number (WhatsApp) *</label>
                        <span className="sck-char-limit-badge">{guestPhone.length}/18</span>
                      </div>
                      <input
                        id="guest-phone-input"
                        type="tel"
                        className="form-input"
                        placeholder="e.g. +1 (212) 555-0199"
                        maxLength={18}
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="input-sublabel" htmlFor="guest-notes-input">Special Requests / Hair Goals (Optional)</label>
                      <span className="sck-char-limit-badge">{guestNotes.length}/300</span>
                    </div>
                    <textarea
                      id="guest-notes-input"
                      className="form-input"
                      rows={3}
                      maxLength={300}
                      placeholder="Share existing color history, desired transformations, or stylist preferences..."
                      value={guestNotes}
                      onChange={(e) => setGuestNotes(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <label className="quiet-chair-toggle" style={{ marginTop: '16px' }}>
                    <input
                      type="checkbox"
                      checked={isQuietChair}
                      onChange={(e) => setIsQuietChair(e.target.checked)}
                      style={{ accentColor: 'var(--gold, #ff9000)', width: '18px', height: '18px' }}
                    />
                    <span>
                      Request a <strong>Silent Chair</strong> session (minimal dialogue for deep acoustic relaxation &amp; tranquility)
                    </span>
                  </label>
                </div>

                {/* Summary Box */}
                <div className="booking-summary-box">
                  <div>
                    <div className="summary-eyebrow">RESERVATION ESTIMATE</div>
                    <div className="summary-service-title">
                      {selectedService?.name || 'Cut & Styling'} · Dedicated Chair
                    </div>
                    <div className="summary-datetime">
                      {formattedSelectedDate} at {bookingTime} {calculatedEndTime ? `(until ${calculatedEndTime})` : ''} · Barber Hub, Fifth Avenue, NYC
                    </div>
                  </div>
                  <div className="booking-summary-total">
                    {formatPrice(selectedService?.price || 'Rs 150+')}
                  </div>
                </div>

                <div className="booking-actions-row">
                  {submitErrorMsg && (
                    <div className="sck-slot-conflict-alert" role="alert" style={{ width: '100%', marginBottom: '14px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{submitErrorMsg}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="btn btn-gold sck-submit-booking-btn"
                    disabled={allSlotsUnavailable || isSubmitting}
                  >
                    {isSubmitting ? '✦ Securing Your Private Chair...' : 'Confirm Chair Reservation'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="confirmation-card sck-booking-confirmation-full">
              <div className="confirmation-icon-svg">
                <CheckCircleIcon size={64} />
              </div>
              <h2 className="confirmation-title">Your Private Chair is Held</h2>
              <p className="confirmation-desc">
                A confirmation SMS and calendar invite has been reserved for{' '}
                <strong>{guestName || 'Valued Patron'}</strong>.
              </p>

              <div className="confirmation-code-bar">
                <span>CONFIRMATION REF: <strong>{confirmationCode}</strong></span>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={handleCopyCode}
                >
                  {copiedCode ? '✓ Copied' : 'Copy Code'}
                </button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', letterSpacing: '0.02em' }}>
                Unique Personal Reference &bull; Identifies <strong style={{ color: 'var(--sck-gold-primary, #d4af37)' }}>{guestName}</strong> ({guestPhone ? `Ref: ..${extractPhoneLast4(guestPhone)}` : 'In-Salon Pass'})
              </div>

              <div className="confirmation-details-box">
                <div className="conf-row">
                  <span className="conf-label">Treatment:</span>
                  <span className="conf-val">{selectedService?.name}</span>
                </div>
                <div className="conf-row">
                  <span className="conf-label">Estimated Investment:</span>
                  <span className="conf-val">{formatPrice(selectedService?.price)} · {selectedService?.duration}</span>
                </div>
                <div className="conf-row">
                  <span className="conf-label">Session:</span>
                  <span className="conf-val">Dedicated 1-on-1 Solo Atelier (Single Chair)</span>
                </div>
                <div className="conf-row">
                  <span className="conf-label">Schedule:</span>
                  <span className="conf-val">{formattedSelectedDate} at {bookingTime} {calculatedEndTime ? `(until ${calculatedEndTime})` : ''}</span>
                </div>
                <div className="conf-row">
                  <span className="conf-label">Location:</span>
                  <span className="conf-val">Fourth Floor, 587 Fifth Avenue, New York, NY 10017</span>
                </div>
                {isQuietChair && (
                  <div className="conf-silent-notice">
                    ✦ Silent Chair Protocol Confirmed (Deep Acoustic Tranquility)
                  </div>
                )}
              </div>

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={handleDownloadCalendarEvent}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Add to Calendar (.ics)
                </button>
                <button
                  type="button"
                  className="btn btn-outline-gold"
                  onClick={() => {
                    setIsSubmitted(false)
                    setGuestName('')
                    setGuestPhone('')
                    setGuestNotes('')
                  }}
                >
                  Book Another Appointment
                </button>
                <button
                  type="button"
                  className="btn-outline-gold"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('home')
                    } else {
                      window.location.href = '/'
                    }
                  }}
                >
                  Return to Home
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
