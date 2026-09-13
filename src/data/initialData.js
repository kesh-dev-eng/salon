/* ============================================================
   EMBER & RUE — INITIAL SALON DATA & LOCALSTORAGE STORE
   ============================================================ */

export const INITIAL_SERVICES = [
  {
    id: 's1',
    num: '01',
    category: 'cut',
    name: 'Cut & Styling',
    price: 'Rs 150+',
    priceNum: 150,
    duration: '60 min',
    tag: 'Hair',
    img: '/images/services/cut-styling.jpg',
    desc: 'From precision haircuts tailored to your individual look to polished blowouts and elegant updos, every cut and styling service is crafted to bring out the best in your hair.'
  },
  {
    id: 's2',
    num: '02',
    category: 'color',
    name: 'Color',
    price: 'Rs 220+',
    priceNum: 220,
    duration: '120 min',
    tag: 'Color',
    img: '/images/services/color.jpg',
    desc: 'From rich single-process color to expertly crafted balayage and highlights, our color services are tailored to complement your unique look by master colorists.'
  },
  {
    id: 's3',
    num: '03',
    category: 'treatments',
    name: 'Conditioning Hair Treatments',
    price: 'Rs 95+',
    priceNum: 95,
    duration: '45 min',
    tag: 'Care',
    img: '/images/services/conditioning.jpg',
    desc: 'Restore softness, strength, and luminosity with luxury formulas from Kérastase, Shu Uemura, and Olaplex, leaving you with a healthier, radiant result.'
  },
  {
    id: 's4',
    num: '04',
    category: 'makeup',
    name: 'Makeup',
    price: 'Rs 125+',
    priceNum: 125,
    duration: '60 min',
    tag: 'Beauty',
    img: '/images/services/makeup.jpg',
    desc: 'From custom blended makeup application and lash enhancements to eyebrow shaping and personalized lessons, designed to complement and elevate your full look.'
  },
  {
    id: 's5',
    num: '05',
    category: 'bridal',
    name: 'Bridal',
    price: 'Rs 350+',
    priceNum: 350,
    duration: '180 min',
    tag: 'Occasion',
    img: '/images/services/bridal.jpg',
    desc: 'From your bridal trial to the moment you walk down the aisle, offering both in-salon and on-location hair services tailored to your wedding vision.'
  },
  {
    id: 's6',
    num: '06',
    category: 'perms',
    name: 'Perms & Relaxer',
    price: 'Rs 200+',
    priceNum: 200,
    duration: '120 min',
    tag: 'Texture',
    img: '/images/services/perms-relaxer.jpg',
    desc: 'Whether you are looking to add lasting curl definition with a perm or achieve smooth, manageable results with a relaxer, tailored to your hair texture.'
  },
  {
    id: 's7',
    num: '07',
    category: 'nails',
    name: 'Nails',
    price: 'Rs 65+',
    priceNum: 65,
    duration: '50 min',
    tag: 'Nails',
    img: '/images/services/nails.jpg',
    desc: 'From a classic manicure to gel, Dazzle Dry, powder gel, and beyond, luxury nail services designed to leave your hands and feet looking polished and refined.'
  }
]

export const INITIAL_ARTISANS = [
  {
    id: 'artisan-1',
    name: 'Elena Vance',
    role: 'Creative Director & Colorist',
    chair: 'Chair 01',
    bio: '12 years atelier experience between London and Paris. Specialises in low-maintenance golden balayage.',
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=80'
  },
  {
    id: 'artisan-2',
    name: 'Marcus Thorne',
    role: 'Master Sculptor & Fade Specialist',
    chair: 'Chair 02',
    bio: 'Vidal Sassoon trained. Master of precision men\'s tapers, razor texturing, and sharp architectural crops.',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80'
  },
  {
    id: 'artisan-3',
    name: 'Mei-Ling Zhou',
    role: 'Holistic Head Spa Therapist',
    chair: 'Chair 03',
    bio: 'Tokyo certified head spa master. Integrates herbal botanical extracts with restorative shiatsu acupressure.',
    img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=80'
  }
]

export const INITIAL_GALLERY = [
  {
    id: 1,
    category: 'cuts',
    tag: "Men's Fade",
    title: 'Textured Crop & Low Skin Taper',
    desc: 'Precision scissor carving with razor-sharp temple contours.',
    img: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80'
  },
  {
    id: 2,
    category: 'cuts',
    tag: 'Precision Cut',
    title: 'Architectural French Bob',
    desc: 'Clean jawline bevel with textured curtain fringe.',
    img: 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=800&q=80'
  },
  {
    id: 3,
    category: 'balayage',
    tag: 'Colour',
    title: 'Champagne Nordic Melt',
    desc: 'Ultra-fine baby lights blended into platinum tips.',
    img: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80'
  },
  {
    id: 4,
    category: 'bridal',
    tag: 'Bridal',
    title: 'The Riviera Chignon',
    desc: 'Relaxed low bun with soft framing tendrils and pearl pins.',
    img: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80'
  },
  {
    id: 5,
    category: 'styling',
    tag: 'Styling',
    title: 'Venetian Velvet Blowout',
    desc: 'High-volume polished waves with high-gloss mirror glaze.',
    img: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80'
  },
  {
    id: 6,
    category: 'cuts',
    tag: "Men's Styling",
    title: 'Sculpted Pompadour & Beard Blend',
    desc: 'Matte pomade texture with seamless cheekbone graduation.',
    img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80'
  }
]

export const INITIAL_REVIEWS = [
  {
    id: 'rev-1',
    stars: '★★★★★',
    quote: "I have been a client of Barber Hub since they opened. They are the best. I won't go anywhere else. My hair is curly and they do an amazing job. Always have",
    author: 'Carolyn Pianin',
    service: 'Cut & Styling'
  },
  {
    id: 'rev-2',
    stars: '★★★★★',
    quote: "I had my hair cut by Carmel and it was such a great experience 10/10 recommend. She asked all the right questions to really understand what I was looking for. My hair came out fabulous!!",
    author: 'Sofia Appel',
    service: 'Cut & Styling'
  },
  {
    id: 'rev-3',
    stars: '★★★★★',
    quote: "I hadn't had my naturally very dark hair colored in a very long time, but I took the plunge with Kelly at Barber Hub and it was the best decision! Kelly gave me a thorough consultation and along with Devin they made sure my cut and color work in perfect harmony.",
    author: 'Vanessa Moreno',
    service: 'Color'
  },
  {
    id: 'rev-4',
    stars: '★★★★★',
    quote: "I never write google reviews but the blowout that Rene just gave me deserves a review. It was a simple walk in and I’m leaving with the best blow out I have ever gotten.",
    author: 'Daniela Silva',
    service: 'Blow Dry'
  },
  {
    id: 'rev-5',
    stars: '★★★★★',
    quote: "Barber Hub is such a wonderful experience! The atelier is beautiful, exquisitely clean, and packed with highly talented artists! Clint does my cut..a perfectionist! Kelly does my color…very natural!",
    author: 'Donna Mazur',
    service: 'Cut & Color'
  },
  {
    id: 'rev-6',
    stars: '★★★★★',
    quote: "I can’t say enough good things about this salon! Mark is a true artist with color — my color has never looked better. And Clint gives the best cuts; he really knows how to shape and style for your face and hair type.",
    author: 'M Bailey',
    service: 'Color & Cut'
  }
]

export const INITIAL_BOOKINGS = [
  {
    id: 'bk-1',
    code: 'ER-839210',
    guestName: 'Julian Morris',
    guestPhone: '+65 9123 4567',
    guestEmail: 'julian.morris@atelier.patron',
    userEmail: 'julian.morris@atelier.patron',
    serviceName: 'Architectural Cut & Taper Fade',
    servicePrice: 'Rs 85',
    stylist: 'Solo Master Artist',
    date: '2026-09-13',
    time: '11:30 AM',
    isQuietChair: true,
    status: 'Confirmed',
    createdAt: '2026-09-11'
  },
  {
    id: 'bk-0',
    code: 'ER-721094',
    guestName: 'Julian Morris',
    guestPhone: '+65 9123 4567',
    guestEmail: 'julian.morris@atelier.patron',
    userEmail: 'julian.morris@atelier.patron',
    serviceName: 'High-Gloss Glaze & Tone Reset',
    servicePrice: 'Rs 95',
    stylist: 'Solo Master Artist',
    date: '2026-08-10',
    time: '03:00 PM',
    isQuietChair: false,
    status: 'Completed',
    createdAt: '2026-08-05'
  },
  {
    id: 'bk-2',
    code: 'ER-549102',
    guestName: 'Sophia Laurent',
    guestPhone: '+65 8234 5678',
    guestEmail: 'sophia@laurent.studio',
    userEmail: 'sophia@laurent.studio',
    serviceName: 'French Balayage & Contour',
    servicePrice: 'Rs 230',
    stylist: 'Solo Master Artist',
    date: '2026-09-14',
    time: '01:30 PM',
    isQuietChair: false,
    status: 'Confirmed',
    createdAt: '2026-09-11'
  },
  {
    id: 'bk-3',
    code: 'ER-129481',
    guestName: 'Daniel Tan',
    guestPhone: '+65 9345 6789',
    guestEmail: 'daniel.tan@singapore.sg',
    userEmail: 'daniel.tan@singapore.sg',
    serviceName: 'Japanese Head Spa & Scalp Ritual',
    servicePrice: 'Rs 140',
    stylist: 'Solo Master Artist',
    date: '2026-09-14',
    time: '04:30 PM',
    isQuietChair: true,
    status: 'Pending',
    createdAt: '2026-09-12'
  }
]

export function formatPrice(price) {
  if (price === null || price === undefined || price === '') return 'Rs 0'
  let str = String(price).trim()
  // Replace any $ sign with Rs
  str = str.replaceAll('$', 'Rs ')
  // Clean up any double "Rs Rs"
  str = str.replace(/Rs\s*Rs/gi, 'Rs ')
  // Fix spacing: "Rs150" -> "Rs 150"
  str = str.replace(/^Rs([0-9])/i, 'Rs $1')
  // Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim()
  return str
}

export const INITIAL_TIMETABLE = {
  workingDays: [
    { day: 'Mon', name: 'Monday', isOpen: false, openTime: '10:00 AM', closeTime: '07:00 PM' },
    { day: 'Tue', name: 'Tuesday', isOpen: true, openTime: '10:00 AM', closeTime: '07:00 PM' },
    { day: 'Wed', name: 'Wednesday', isOpen: true, openTime: '09:00 AM', closeTime: '07:30 PM' },
    { day: 'Thu', name: 'Thursday', isOpen: true, openTime: '09:00 AM', closeTime: '07:30 PM' },
    { day: 'Fri', name: 'Friday', isOpen: true, openTime: '09:00 AM', closeTime: '07:30 PM' },
    { day: 'Sat', name: 'Saturday', isOpen: true, openTime: '09:00 AM', closeTime: '06:00 PM' },
    { day: 'Sun', name: 'Sunday', isOpen: true, openTime: '10:30 AM', closeTime: '06:00 PM' },
  ],
  timeSlots: [
    { id: 't1', time: '09:30 AM', period: 'morning', label: 'Morning Light', badge: 'Available', active: true },
    { id: 't2', time: '10:30 AM', period: 'morning', label: 'Morning High', badge: 'Popular', active: true },
    { id: 't3', time: '11:30 AM', period: 'morning', label: 'Midday Prime', badge: 'Prime', active: true },
    { id: 't4', time: '01:00 PM', period: 'afternoon', label: 'Early Afternoon', badge: 'Available', active: true },
    { id: 't5', time: '02:15 PM', period: 'afternoon', label: 'Mid Afternoon', badge: 'Popular', active: true },
    { id: 't6', time: '03:30 PM', period: 'afternoon', label: 'Late Afternoon', badge: 'Available', active: true },
    { id: 't7', time: '04:30 PM', period: 'afternoon', label: 'Sunset Glow', badge: 'Prime', active: true },
    { id: 't8', time: '05:30 PM', period: 'evening', label: 'Fifth Ave Twilight', badge: 'Available', active: true },
    { id: 't9', time: '06:30 PM', period: 'evening', label: 'Evening Couture', badge: 'Peak Slot', active: true },
    { id: 't10', time: '07:15 PM', period: 'evening', label: 'Late Salon Session', badge: 'VIP Evening', active: true },
  ],
  notice: 'Mon – Sun: 9:00 AM – 7:00 PM · Private 1-on-1 chair sessions'
}

export const STORAGE_KEY = 'salon_hub_store_v1'

export function loadAtelierData() {
  try {
    // Purge legacy storage keys so no previous cached values persist in user's browser
    const legacyKeys = ['salon_sck_store', 'salon_sck_store_v1', 'salon_sck_store_v2', 'salon_sck_store_v3', 'salon_sck_store_v4', 'salon_sck_store_v5']
    legacyKeys.forEach((k) => {
      try { localStorage.removeItem(k) } catch {}
    })

    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // Unconditionally eradicate any $ in raw string
      const sanitizedRaw = raw.replaceAll('$', 'Rs ')
      const parsed = JSON.parse(sanitizedRaw)
      return {
        services: (parsed.services || INITIAL_SERVICES).map((s) => ({
          ...s,
          price: formatPrice(s.price)
        })),
        artisans: parsed.artisans || INITIAL_ARTISANS,
        gallery: parsed.gallery || INITIAL_GALLERY,
        reviews: parsed.reviews || INITIAL_REVIEWS,
        bookings: (parsed.bookings || INITIAL_BOOKINGS).map((b) => ({
          ...b,
          servicePrice: formatPrice(b.servicePrice)
        })),
        timetable: parsed.timetable || INITIAL_TIMETABLE,
      }
    }
  } catch (err) {
    console.error('Failed to load atelier data from localStorage:', err)
  }
  return {
    services: INITIAL_SERVICES.map((s) => ({ ...s, price: formatPrice(s.price) })),
    artisans: INITIAL_ARTISANS,
    gallery: INITIAL_GALLERY,
    reviews: INITIAL_REVIEWS,
    bookings: INITIAL_BOOKINGS.map((b) => ({ ...b, servicePrice: formatPrice(b.servicePrice) })),
    timetable: INITIAL_TIMETABLE,
  }
}

export function saveAtelierData(data) {
  try {
    const sanitized = {
      ...data,
      services: data.services ? data.services.map((s) => ({ ...s, price: formatPrice(s.price) })) : data.services,
      bookings: data.bookings ? data.bookings.map((b) => ({ ...b, servicePrice: formatPrice(b.servicePrice) })) : data.bookings,
      timetable: data.timetable || INITIAL_TIMETABLE,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  } catch (err) {
    console.error('Failed to save atelier data to localStorage:', err)
  }
}

export function resetAtelierData() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('Failed to reset atelier data:', err)
  }
  return {
    services: INITIAL_SERVICES.map((s) => ({ ...s, price: formatPrice(s.price) })),
    artisans: INITIAL_ARTISANS,
    gallery: INITIAL_GALLERY,
    reviews: INITIAL_REVIEWS,
    bookings: INITIAL_BOOKINGS.map((b) => ({ ...b, servicePrice: formatPrice(b.servicePrice) })),
    timetable: INITIAL_TIMETABLE,
  }
}
