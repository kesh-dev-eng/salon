import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { loadAtelierData, saveAtelierData, resetAtelierData, formatPrice } from './data/initialData'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import BlogPage from './pages/BlogPage'
import TeamPage from './pages/TeamPage'
import ContactPage from './pages/ContactPage'
import BridalPage from './pages/BridalPage'
import PolicyPage from './pages/PolicyPage'
import CareersPage from './pages/CareersPage'
import BookingPage from './pages/BookingPage'
import AdminPage from './pages/AdminPage'
import Loader from './components/Loader'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

const IMG = {
  mensHairBg: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1800&q=90',
  arc: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1400&q=90'
}

/* ─── Bespoke Luxury SVG Icons & Helpers ─── */
function StarIcon({ filled = true, size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'var(--gold)' : 'none'}
      stroke={filled ? 'var(--gold)' : 'rgba(247, 242, 234, 0.22)'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="star-svg-icon"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}


function CheckCircleIcon({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  )
}

function CloseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SparkleIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--gold)" aria-hidden="true">
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  )
}

/* ─── Available Time Slots ─── */
const TIME_SLOTS = ['10:00 AM', '11:30 AM', '01:30 PM', '03:00 PM', '04:30 PM', '06:00 PM']

/* ─── Salon HUB Authentic Interior Views ─── */
const ABOUT_PHOTOS = [
  {
    id: 'floor',
    src: '/images/about-salon-1.jpg',
    title: 'Main Styling Floor & Marble Island',
    subtitle: 'Sunlit Fourth-Floor Sanctuary Bathed in Natural Manhattan Daylight',
    tag: 'Fifth Ave Sanctuary'
  },
  {
    id: 'stations',
    src: '/images/about-salon-2.jpg',
    title: 'Styling Stations & Product Bar',
    subtitle: 'Curated Formulations from Kérastase, Olaplex & Shu Uemura',
    tag: 'Bespoke Craft'
  },
  {
    id: 'shampoo',
    src: '/images/about-salon-3.jpg',
    title: 'Private Relaxation Shampoo Lounge',
    subtitle: 'Restorative Hair & Scalp Conditioning Rituals',
    tag: 'Relaxation Lounge'
  }
]

export default function App() {
  const root = useRef(null)
  const canvasRef = useRef(null)

  // Local Atelier State (Services, Gallery, Reviews, Bookings)
  const [atelierState, setAtelierState] = useState(() => loadAtelierData())
  const { services = [], reviews = [], bookings = [] } = atelierState

  const setServices = (newServices) => {
    setAtelierState((prev) => {
      const updated = { ...prev, services: typeof newServices === 'function' ? newServices(prev.services) : newServices }
      saveAtelierData(updated)
      return updated
    })
  }

  const setReviews = (newReviews) => {
    setAtelierState((prev) => {
      const updated = { ...prev, reviews: typeof newReviews === 'function' ? newReviews(prev.reviews) : newReviews }
      saveAtelierData(updated)
      return updated
    })
  }

  const setBookings = (newBookings) => {
    setAtelierState((prev) => {
      const updated = { ...prev, bookings: typeof newBookings === 'function' ? newBookings(prev.bookings) : newBookings }
      saveAtelierData(updated)
      return updated
    })
  }

  const handleResetData = () => {
    const reset = resetAtelierData()
    setAtelierState(reset)
  }

  // Navigation & Page Routing States
  const [currentPage, setCurrentPage] = useState(() => {
    const p = window.location.pathname.replace(/^\//, '').toLowerCase()
    if (['services', 'about', 'blog', 'team', 'contact', 'bridal', 'policy', 'careers', 'booking', 'book', 'admin'].includes(p)) {
      return p === 'book' ? 'booking' : p
    }
    return 'home'
  })

  const [bookingPreselectedService, setBookingPreselectedService] = useState(null)

  // Navigate to booking page smoothly in the same tab, with optional preselected service
  const openBookingTab = (serviceName = null) => {
    setBookingPreselectedService(serviceName || null)
    navigateTo('booking')
    if (serviceName) {
      window.history.pushState(null, '', `/booking?service=${encodeURIComponent(serviceName)}`)
    }
  }
  const [activeServiceCategory, setActiveServiceCategory] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('category') || 'all'
    } catch {
      return 'all'
    }
  })
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [aboutPhotoIdx, setAboutPhotoIdx] = useState(0)
  const [activeLightbox, setActiveLightbox] = useState(null)

  // Site Preloader State
  const [isSiteLoading, setIsSiteLoading] = useState(true)
  const [isLoaderFading, setIsLoaderFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsLoaderFading(true)
    }, 1800)

    const removeTimer = setTimeout(() => {
      setIsSiteLoading(false)
    }, 2400)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  // Navigation Dropdown state ('services' | 'about' | null)
  const [navDropdown, setNavDropdown] = useState(null)
  const dropdownTimeoutRef = useRef(null)

  const openDropdown = (menuName) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    setNavDropdown(menuName)
  }

  const closeDropdownWithDelay = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
    }
    dropdownTimeoutRef.current = setTimeout(() => {
      setNavDropdown(null)
    }, 320)
  }

  const closeDropdownImmediately = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    setNavDropdown(null)
  }

  const navigateTo = (page, category = 'all') => {
    const targetPage = page === 'book' ? 'booking' : page
    setCurrentPage(targetPage)
    setActiveServiceCategory(category || 'all')
    closeDropdownImmediately()
    setIsMobileNavOpen(false)
    let newPath = targetPage === 'home' ? '/' : `/${targetPage}`
    if (targetPage === 'services' && category && category !== 'all') {
      newPath += `?category=${encodeURIComponent(category)}`
    }
    window.history.pushState(null, '', newPath)

    if (targetPage === 'services' && category && category !== 'all') {
      setTimeout(() => {
        const el = document.getElementById('services-catalog') || document.querySelector('.sck-catalog-controls')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/^\//, '').toLowerCase()
      if (['services', 'about', 'blog', 'team', 'contact', 'bridal', 'policy', 'careers', 'booking', 'book', 'admin'].includes(p)) {
        setCurrentPage(p === 'book' ? 'booking' : p)
      } else {
        setCurrentPage('home')
      }
      try {
        const params = new URLSearchParams(window.location.search)
        setActiveServiceCategory(params.get('category') || 'all')
      } catch {
        setActiveServiceCategory('all')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Close nav dropdowns on outside click or escape, and handle secret admin hotkey
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.sck-header')) {
        closeDropdownImmediately()
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeDropdownImmediately()
      // Secret Admin shortcut: Ctrl + Shift + A
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        navigateTo('admin')
      }
    }
    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
    }
  }, [])

  // Client Review Submission States
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewAuthor, setReviewAuthor] = useState('')
  const [reviewService, setReviewService] = useState(() => services[0]?.name || 'Cut & Styling')
  const [reviewStars, setReviewStars] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [activeReviewIdx, setActiveReviewIdx] = useState(0)

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsReviewModalOpen(false)
        setActiveLightbox(null)
        setIsMobileNavOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /* ─────────────────────────────────────────────────────────────
     BEHIND ANIMATION: THREE.JS 3D MEN'S HAIR WAVE DISPLACEMENT
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 24)

    const ambLight = new THREE.AmbientLight(0x201205, 1.4)
    scene.add(ambLight)

    const hairSpotLight = new THREE.PointLight(0xffaa33, 2.8, 65, 1.5)
    hairSpotLight.position.set(0, 6, 12)
    scene.add(hairSpotLight)

    const textureLoader = new THREE.TextureLoader()
    textureLoader.crossOrigin = 'anonymous'
    const hairTexture = textureLoader.load(IMG.mensHairBg)

    const hairGeo = new THREE.PlaneGeometry(34, 22, 54, 54)
    const hairMat = new THREE.MeshStandardMaterial({
      map: hairTexture,
      roughness: 0.4,
      metalness: 0.25,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide
    })
    const hairMesh = new THREE.Mesh(hairGeo, hairMat)
    hairMesh.position.set(0, 0, -3)
    scene.add(hairMesh)

    const posAttribute = hairGeo.attributes.position
    const origPositions = posAttribute.array.slice()

    const particleCount = window.innerWidth < 768 ? 140 : 280
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 5
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0xff9000,
      size: 0.26,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 4
      mouseY = (e.clientY / window.innerHeight - 0.5) * 4
      hairSpotLight.position.x = (e.clientX / window.innerWidth - 0.5) * 20
      hairSpotLight.position.y = -(e.clientY / window.innerHeight - 0.5) * 16 + 2
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    const clock = new THREE.Clock()
    let rafId

    const animate = () => {
      const elapsedTime = clock.getElapsedTime()
      targetX += (mouseX - targetX) * 0.04
      targetY += (mouseY - targetY) * 0.04

      camera.position.x = targetX * 0.8
      camera.position.y = -targetY * 0.8

      const currentPos = posAttribute.array
      for (let i = 0; i < posAttribute.count; i++) {
        const u = origPositions[i * 3]
        const v = origPositions[i * 3 + 1]
        const wave = Math.sin(u * 0.22 + elapsedTime * 1.3) * Math.cos(v * 0.22 + elapsedTime * 1.1) * 0.85
                   + Math.sin(u * 0.45 - elapsedTime * 1.8) * 0.35
        currentPos[i * 3 + 2] = origPositions[i * 3 + 2] + wave
      }
      posAttribute.needsUpdate = true

      hairMesh.rotation.y = targetX * 0.04
      hairMesh.rotation.x = -targetY * 0.03

      particles.rotation.y += 0.0003
      particles.rotation.x += 0.00015

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      ScrollTrigger.refresh()
    }
    window.addEventListener('resize', onResize)

    const ctx = gsap.context(() => {
      if (reduced) return

      gsap.utils.toArray('.gsap-reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none'
            }
          }
        )
      })

      gsap.to(hairMesh.position, {
        z: -1,
        y: 2,
        ease: 'none',
        scrollTrigger: {
          trigger: 'body',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5
        }
      })
      // 3D Card Tilt & Specular Spotlight
      const tiltCards = document.querySelectorAll('.service-card, .testimonial-card')
      tiltCards.forEach((card) => {
        const glare = card.querySelector('.card-specular-glare')
        const handleCardMove = (e) => {
          const rect = card.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const centerX = rect.width / 2
          const centerY = rect.height / 2
          const rotateX = ((y - centerY) / centerY) * -7
          const rotateY = ((x - centerX) / centerX) * 7

          gsap.to(card, {
            rotationX: rotateX,
            rotationY: rotateY,
            z: 8,
            duration: 0.25,
            ease: 'power1.out',
            transformPerspective: 900
          })

          if (glare) {
            glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 144, 0, 0.26) 0%, transparent 65%)`
          }
        }
        const handleCardLeave = () => {
          gsap.to(card, { rotationX: 0, rotationY: 0, z: 0, duration: 0.5, ease: 'power2.out' })
        }
        card.addEventListener('mousemove', handleCardMove)
        card.addEventListener('mouseleave', handleCardLeave)
      })

      // Magnetic Buttons
      const magneticBtns = document.querySelectorAll('.btn-gold')
      magneticBtns.forEach((btn) => {
        const handleBtnMove = (e) => {
          const rect = btn.getBoundingClientRect()
          const x = e.clientX - (rect.left + rect.width / 2)
          const y = e.clientY - (rect.top + rect.height / 2)
          gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.25, ease: 'power1.out' })
        }
        const handleBtnLeave = () => {
          gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
        }
        btn.addEventListener('mousemove', handleBtnMove)
        btn.addEventListener('mouseleave', handleBtnLeave)
      })

    }, root)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      ctx.revert()
      hairGeo.dispose()
      hairMat.dispose()
      particleGeo.dispose()
      particleMat.dispose()
      renderer.dispose()
    }
  }, [])


  // Handle Client Review Submission (Saved locally)
  const handleReviewSubmit = (e) => {
    e.preventDefault()
    if (!reviewAuthor.trim() || !reviewComment.trim()) return

    const starsString = '★'.repeat(reviewStars) + '☆'.repeat(5 - reviewStars)
    const newReviewItem = {
      id: 'rev-' + Date.now(),
      author: reviewAuthor.trim(),
      service: reviewService || services[0]?.name || 'Architectural Cut & Taper Fade',
      stars: starsString,
      quote: reviewComment.trim(),
      createdAt: new Date().toISOString().split('T')[0]
    }

    setReviews((prev) => [newReviewItem, ...prev])
    setReviewSubmitted(true)
    setTimeout(() => {
      setIsReviewModalOpen(false)
      setReviewSubmitted(false)
      setReviewAuthor('')
      setReviewComment('')
    }, 2400)
  }


  return (
    <div ref={root}>
      {isSiteLoading && (
        <div
          className={`sck-preloader-screen ${isLoaderFading ? 'is-fading' : ''}`}
          role="status"
          aria-label="Loading Salon HUB"
        >
          <Loader />
        </div>
      )}

      {/* ─── BEHIND ANIMATION: MEN'S HAIR BACKGROUND LAYERS ─── */}
      <div className="bg-hair-layer" aria-hidden="true" />
      <canvas id="webgl" ref={canvasRef} />
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      {/* HUB Luxury Navigation Header */}
      {currentPage !== 'admin' && (
        <header className="sck-header">
        <nav className="sck-nav" aria-label="Main Navigation">
          {/* Square HUB Logo */}
          <a
            href="/"
            className="sck-logo-box"
            aria-label="Salon HUB Home"
            onClick={(e) => {
              e.preventDefault()
              navigateTo('home')
            }}
          >
            <span className="sck-logo-italic">salon</span>
            <span className="sck-logo-bold">HUB</span>
          </a>

          {/* Desktop Nav Links */}
          <div className="sck-nav-links">
            <a
              href="/"
              className={`sck-nav-link ${currentPage === 'home' ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                navigateTo('home')
              }}
            >
              Home
            </a>

            {/* Services Dropdown & Mega-Menu Trigger */}
            <div
              className="sck-dropdown-anchor"
              onMouseEnter={() => openDropdown('services')}
              onMouseLeave={closeDropdownWithDelay}
            >
              <button
                type="button"
                className={`sck-nav-link ${currentPage === 'services' ? 'is-active' : ''} ${navDropdown === 'services' ? 'is-open' : ''}`}
                onClick={() => {
                  navigateTo('services')
                }}
                onMouseEnter={() => openDropdown('services')}
                aria-expanded={navDropdown === 'services'}
              >
                <span>Services</span>
              </button>
            </div>

            {/* About Dropdown Trigger */}
            <div
              className="sck-dropdown-anchor"
              onMouseEnter={() => openDropdown('about')}
              onMouseLeave={closeDropdownWithDelay}
            >
              <button
                type="button"
                className={`sck-nav-link ${currentPage === 'about' || currentPage === 'bridal' || currentPage === 'policy' ? 'is-active' : ''} ${navDropdown === 'about' ? 'is-open' : ''}`}
                onClick={() => {
                  navigateTo('about')
                }}
                onMouseEnter={() => openDropdown('about')}
                aria-expanded={navDropdown === 'about'}
              >
                <span>About</span>
              </button>
              {navDropdown === 'about' && (
                <div
                  className="sck-dropdown-menu sck-about-dropdown"
                  role="menu"
                  onMouseEnter={() => openDropdown('about')}
                  onMouseLeave={closeDropdownWithDelay}
                >
                  <button
                    type="button"
                    className={`sck-dropdown-item ${currentPage === 'about' ? 'is-highlighted' : ''}`}
                    onClick={() => {
                      navigateTo('about')
                    }}
                  >
                    <span className="sck-underlined-text">About Us</span>
                  </button>
                  <button
                    type="button"
                    className={`sck-dropdown-item ${currentPage === 'bridal' ? 'is-highlighted' : ''}`}
                    onClick={() => {
                      navigateTo('bridal')
                    }}
                  >
                    Bridal
                  </button>
                  <button
                    type="button"
                    className={`sck-dropdown-item ${currentPage === 'policy' ? 'is-highlighted' : ''}`}
                    onClick={() => {
                      navigateTo('policy')
                    }}
                  >
                    Policy
                  </button>
                </div>
              )}
            </div>

            <a
              href="/blog"
              className={`sck-nav-link ${currentPage === 'blog' ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                navigateTo('blog')
              }}
            >
              Blog
            </a>

            <a
              href="/contact"
              className={`sck-nav-link ${currentPage === 'contact' ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                navigateTo('contact')
              }}
            >
              Contact
            </a>
          </div>

          {/* Right Action Buttons */}
          <div className="sck-actions">
            {/* Book Now Button */}
            <a
              href="/booking"
              className="sck-btn-teal sck-book-btn"
              style={{ textDecoration: 'none' }}
              onClick={(e) => {
                e.preventDefault()
                openBookingTab()
              }}
            >
              Book Now
            </a>

            {/* Mobile Hamburger */}
            <button
              className={`nav__hamburger ${isMobileNavOpen ? 'is-active' : ''}`}
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              aria-label="Toggle navigation menu"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </nav>

        {/* SERVICES MEGA-MENU */}
        {navDropdown === 'services' && (
          <div
            className="sck-mega-menu"
            role="region"
            aria-label="Services Menu"
            onMouseEnter={() => openDropdown('services')}
            onMouseLeave={closeDropdownWithDelay}
          >
            <div className="sck-mega-menu-inner">
              {/* Column 1: Cut & Styling, Makeup, Nails */}
              <div className="sck-mega-col">
                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Cut & Styling')
                    setNavDropdown(null)
                  }}
                >
                  <span>Cut &amp; Styling</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>

                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Makeup')
                    setNavDropdown(null)
                  }}
                >
                  <span>Makeup</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>

                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Nails')
                    setNavDropdown(null)
                  }}
                >
                  <span>Nails</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>
              </div>

              {/* Column 2: Color, Bridal */}
              <div className="sck-mega-col">
                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Color')
                    setNavDropdown(null)
                  }}
                >
                  <span>Color</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>

                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Bridal')
                    setNavDropdown(null)
                  }}
                >
                  <span>Bridal</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>
              </div>

              {/* Column 3: Conditioning Hair Treatments, Perms & Relaxer */}
              <div className="sck-mega-col">
                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Conditioning Hair Treatments')
                    setNavDropdown(null)
                  }}
                >
                  <span>Conditioning Hair Treatments</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>

                <button
                  type="button"
                  className="sck-mega-row"
                  onClick={() => {
                    navigateTo('services', 'Perms & Relaxer')
                    setNavDropdown(null)
                  }}
                >
                  <span>Perms &amp; Relaxer</span>
                  <span className="sck-mega-arrow">&gt;</span>
                </button>
              </div>
            </div>
          </div>
        )}
        </header>
      )}

      {/* Mobile Drawer */}
      {currentPage !== 'admin' && (
        <div
          className={`mobile-drawer ${isMobileNavOpen ? 'is-open' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileNavOpen(false)
          }}
        >
        <button
          className="modal-close-btn"
          onClick={() => setIsMobileNavOpen(false)}
          aria-label="Close navigation menu"
        >
          <CloseIcon size={18} />
        </button>

        <div className="mobile-drawer-links">
          <a
            href="/"
            className={currentPage === 'home' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('home')
            }}
          >
            Home
          </a>
          <a
            href="/services"
            className={currentPage === 'services' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('services')
            }}
          >
            Services
          </a>
          <a
            href="/about"
            className={currentPage === 'about' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('about')
            }}
          >
            About Us
          </a>
          <a
            href="/bridal"
            className={currentPage === 'bridal' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('bridal')
            }}
          >
            Bridal
          </a>
          <a
            href="/policy"
            className={currentPage === 'policy' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('policy')
            }}
          >
            Policy
          </a>
          <a
            href="/blog"
            className={currentPage === 'blog' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('blog')
            }}
          >
            Blog
          </a>
          <a
            href="/careers"
            className={currentPage === 'careers' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('careers')
            }}
          >
            Careers
          </a>
          <a
            href="/contact"
            className={currentPage === 'contact' ? 'is-active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('contact')
            }}
          >
            Contact
          </a>
        </div>

        <div className="mobile-drawer-actions">
          <a
            href="/booking"
            onClick={(e) => {
              e.preventDefault()
              setIsMobileNavOpen(false)
              openBookingTab()
            }}
            className="sck-btn-teal"
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '14px', textAlign: 'center', textDecoration: 'none' }}
          >
            Book Now
          </a>
        </div>
      </div>
      )}

      <main>
        {currentPage === 'home' && (
          <>
            {/* HERO SECTION — SALON HUB */}
        <section className="sck-hero" id="home">
          <div className="sck-hero-bg" aria-hidden="true">
            <img
              src="/images/hero-blonde.jpg"
              alt="Salon HUB Luxury Blonde Hairstyle"
              className="sck-hero-image"
            />
            <div className="sck-hero-overlay" />
          </div>

          <div className="sck-hero-content gsap-reveal">
            <h1 className="sck-hero-title">Salon HUB</h1>
            <p className="sck-hero-subtitle">
              <em>Luxury Hair Salon located on Fifth Avenue</em>
            </p>
            <button
              type="button"
              onClick={() => openBookingTab()}
              className="sck-hero-btn"
            >
              Book Now
            </button>
          </div>
        </section>

        {/* OUR SERVICES SECTION (7 Main Topics from Salon HUB) */}
        <section id="services" className="sck-services-section">
          <div className="sck-section-header gsap-reveal">
            <h2 className="sck-section-title">Our Services</h2>
            <p className="sck-section-subtitle">
              We customize an individual look for each client using Balayage, Highlights, Color and Precision Cuts. Salon HUB also offers Blow Dries, Hair Extensions, Smoothing Treatments, Custom Blended Makeup, Manicure and Pedicure.
            </p>
          </div>

          <div className="sck-services-grid">
            {services.map((service) => (
              <article
                key={service.id}
                className="sck-service-card card gsap-reveal"
                onClick={() => navigateTo('services', service.category)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigateTo('services', service.category)}
                aria-label={`View ${service.name} – click to see all services`}
              >
                {/* First Content — Default Front View */}
                <div className="first-content">
                  <div className="sck-service-img-wrapper">
                    <img
                      src={service.img}
                      alt={service.name}
                      className="sck-service-img"
                      loading="lazy"
                    />
                    <div className="sck-service-overlay" />
                    <span className="sck-service-tag">{service.tag}</span>
                  </div>
                  <div className="sck-service-body">
                    <div className="sck-service-top">
                      <h3 className="sck-service-name">{service.name}</h3>
                      <span className="sck-service-price">{formatPrice(service.price)}</span>
                    </div>
                    <p className="sck-service-desc">{service.desc}</p>
                    <div className="sck-service-book-btn">
                      <span>Reserve Session</span>
                      <span className="sck-service-arrow" aria-hidden="true">→</span>
                    </div>
                  </div>
                </div>

                {/* Second Content — Hover Flip & Reveal View */}
                <div className="second-content">
                  <span className="sck-second-tag">{service.tag}</span>
                  <h3 className="sck-second-title">{service.name}</h3>
                  <div className="sck-second-price">{formatPrice(service.price)}</div>
                  <div className="sck-second-divider" />
                  <p className="sck-second-desc">{service.desc}</p>
                  <div className="sck-second-highlights">
                    <div className="sck-second-highlight-item">
                      <span className="sck-second-check">✦</span>
                      <span>Master Stylist Consultation</span>
                    </div>
                    <div className="sck-second-highlight-item">
                      <span className="sck-second-check">✦</span>
                      <span>Kérastase & Olaplex Luxury Formulations</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openBookingTab(service.name)
                    }}
                    className="sck-second-book-btn"
                  >
                    <span>Reserve Session</span>
                    <span className="sck-service-arrow" aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

        </section>

        {/* ABOUT US SECTION — Clean split layout matching reference */}
        <section id="about" className="sck-about-section">
          <div className="sck-about-split">
            {/* LEFT: Text column */}
            <div className="sck-about-text-col gsap-reveal">
              <span className="sck-about-label">About Us</span>
              <h2 className="sck-about-title">Crafted Beauty, Centered Around You</h2>
              <p className="sck-about-body">
                Salon HUB is a luxury hair salon on Fifth Avenue in the heart of New York City, where artisan craftsmanship and genuine personalization define every visit. From signature balayage and precision cuts to transformative color and conditioning treatments by Kérastase, Olaplex, and Shu Uemura, each service is designed around you — not a template.
              </p>
              <p className="sck-about-body">
                What sets this salon apart is the seamless blend of elevated technique and warm, attentive care. Whether you are seeking a bespoke color transformation, a polished blowout, or a full bridal experience, the team approaches every appointment with the same level of precision and artistry. This is beauty on your terms, crafted with intention.
              </p>
              <button
                type="button"
                className="sck-about-cta-btn"
                onClick={() => navigateTo('about')}
              >
                Learn More About Us
              </button>
            </div>

            {/* RIGHT: Photo with prev/next arrows */}
            <div className="sck-about-photo-col gsap-reveal">
              <div className="sck-about-photo-frame">
                <img
                  key={ABOUT_PHOTOS[aboutPhotoIdx].id}
                  src={ABOUT_PHOTOS[aboutPhotoIdx].src}
                  alt={ABOUT_PHOTOS[aboutPhotoIdx].title}
                  className="sck-about-split-img"
                />
                {/* Prev arrow */}
                <button
                  type="button"
                  className="sck-about-arrow sck-about-arrow-prev"
                  aria-label="Previous photo"
                  onClick={() => setAboutPhotoIdx((aboutPhotoIdx - 1 + ABOUT_PHOTOS.length) % ABOUT_PHOTOS.length)}
                >
                  ←
                </button>
                {/* Next arrow */}
                <button
                  type="button"
                  className="sck-about-arrow sck-about-arrow-next"
                  aria-label="Next photo"
                  onClick={() => setAboutPhotoIdx((aboutPhotoIdx + 1) % ABOUT_PHOTOS.length)}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* NOTES FROM OUR CLIENTS */}
        <section id="reviews" className="sck-notes-section">
          <div className="sck-notes-content gsap-reveal">
            <h2 className="sck-notes-title">Notes From Our Clients</h2>

            <div className="sck-notes-carousel-container">
              <button
                type="button"
                className="sck-notes-nav-btn sck-notes-prev"
                onClick={() => setActiveReviewIdx((prev) => (prev === 0 ? reviews.length - 1 : prev - 1))}
                aria-label="Previous review"
              >
                <span aria-hidden="true">←</span>
              </button>

              <div className="sck-notes-quote-box">
                <p className="sck-notes-quote-text">
                  {reviews[activeReviewIdx]?.quote || "I have been a client of SKC since they opened. They are the best. I won't go anywhere else. My hair is curly and they do an amazing job. Always have"}
                </p>
                <div className="sck-notes-author">
                  {reviews[activeReviewIdx]?.author || 'Carolyn Pianin'}
                </div>
              </div>

              <button
                type="button"
                className="sck-notes-nav-btn sck-notes-next"
                onClick={() => setActiveReviewIdx((prev) => (prev === reviews.length - 1 ? 0 : prev + 1))}
                aria-label="Next review"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <div className="sck-notes-action-wrap">
              <button
                type="button"
                className="sck-notes-submit-btn"
                onClick={() => {
                  setReviewSubmitted(false)
                  setIsReviewModalOpen(true)
                }}
              >
                Submit Review
              </button>
            </div>
          </div>
        </section>
          </>
        )}

        {currentPage === 'services' && (
          <ServicesPage
            services={services}
            activeCategory={activeServiceCategory}
            onSelectCategory={setActiveServiceCategory}
            onBookService={(srv) => openBookingTab(srv.name)}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            onBookClick={() => openBookingTab()}
            onNavigate={navigateTo}
          />
        )}

        {currentPage === 'blog' && (
          <BlogPage
            onBookClick={() => openBookingTab()}
          />
        )}

        {currentPage === 'team' && (
          <TeamPage
            onBookWithStylist={(member) => {
              const matchedCategory = member?.role?.toLowerCase().includes('color') ? 'Color' : 'Cut & Styling'
              openBookingTab(matchedCategory)
            }}
          />
        )}

        {currentPage === 'contact' && (
          <ContactPage
            onBookClick={() => openBookingTab()}
          />
        )}

        {currentPage === 'bridal' && (
          <BridalPage
            onBookClick={() => openBookingTab('Bridal')}
          />
        )}

        {currentPage === 'policy' && (
          <PolicyPage
            onBookClick={() => openBookingTab()}
          />
        )}

        {currentPage === 'careers' && (
          <CareersPage />
        )}

        {currentPage === 'booking' && (
          <BookingPage
            services={services}
            bookings={bookings}
            preselectedService={bookingPreselectedService}
            onBookSuccess={(newBooking) => {
              setBookings((prev) => [newBooking, ...prev])
            }}
            onNavigate={navigateTo}
          />
        )}

        {currentPage === 'admin' && (
          <AdminPage
            services={services}
            setServices={setServices}
            bookings={bookings}
            setBookings={setBookings}
            reviews={reviews}
            setReviews={setReviews}
            onResetData={handleResetData}
            onNavigate={navigateTo}
          />
        )}
      </main>

      {/* FOOTER & FLOATING ACTION */}
      {currentPage !== 'admin' && (
        <>
          <footer className="footer" id="footer">
            <div className="footer-content-grid">
              <div className="footer-col-brand">
                <div className="footer-brand-title">Salon HUB</div>
                <div className="footer-brand-sub">Luxury Hair Salon located on Fifth Avenue</div>
                <p className="footer-brand-desc">
                  Bespoke haircuts, dimensional balayage, custom color, and couture styling in the heart of Midtown Manhattan.
                </p>
              </div>

              <div className="footer-col-links">
                <div className="footer-col-title">Salon HUB</div>
                <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('home') }}>Home</a>
                <a href="/services" onClick={(e) => { e.preventDefault(); navigateTo('services') }}>Our Services</a>
                <a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('about') }}>About Us</a>
                <a href="/bridal" onClick={(e) => { e.preventDefault(); navigateTo('bridal') }}>Bridal Packages</a>
                <a href="/team" onClick={(e) => { e.preventDefault(); navigateTo('team') }}>Meet Our Team</a>
                <a href="/blog" onClick={(e) => { e.preventDefault(); navigateTo('blog') }}>Blog &amp; Press</a>
                <a href="/contact" onClick={(e) => { e.preventDefault(); navigateTo('contact') }}>Contact &amp; Hours</a>
                <a href="/policy" onClick={(e) => { e.preventDefault(); navigateTo('policy') }}>Salon Policy</a>
                <a href="/careers" onClick={(e) => { e.preventDefault(); navigateTo('careers') }}>Careers</a>
                <a href="/booking" onClick={(e) => { e.preventDefault(); openBookingTab() }} style={{ color: 'var(--gold)' }}>Book Online</a>
              </div>

              <div className="footer-col-info">
                <div className="footer-col-title">Visit Salon HUB</div>
                <p>Fifth Avenue, Midtown Manhattan, New York, NY</p>
                <p>Tue – Sat: 9:00 AM – 7:00 PM</p>
                <a href="mailto:info@salonhub.com" className="footer-email-link">info@salonhub.com</a>
              </div>
            </div>

            <div className="footer-bottom-bar">
              <p>© 2025 Salon HUB · Fifth Avenue, New York · All rights reserved.</p>
              <span className="footer-disclaimer">Luxury Hair Salon Experience</span>
            </div>
          </footer>

          {/* FLOATING MOBILE BOOKING BUTTON */}
          <a
            href="/booking"
            onClick={(e) => {
              e.preventDefault()
              openBookingTab()
            }}
            className="floating-mobile-book"
            aria-label="Book Chair"
            style={{ textDecoration: 'none' }}
          >
            <span>Reserve Chair</span>
          </a>
        </>
      )}

      {/* LIGHTBOX MODAL */}
      {activeLightbox && (
        <div
          className="lightbox-modal"
          onClick={() => setActiveLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-close"
              onClick={() => setActiveLightbox(null)}
              aria-label="Close image lightbox"
            >
              <CloseIcon size={18} />
            </button>
            <div className="lightbox-img-wrap">
              <img
                src={activeLightbox.img}
                alt={activeLightbox.title}
                className="lightbox-img"
              />
            </div>
            <div className="lightbox-details">
              <h3 className="lightbox-title">
                {activeLightbox.title}
              </h3>
              <p className="lightbox-desc">
                {activeLightbox.desc}
              </p>
              <div className="lightbox-pairing-note">
                <SparkleIcon size={12} />
                <span>Recommended Treatment: Precision Architectural Cut or French Balayage</span>
              </div>
              <button
                onClick={() => {
                  setActiveLightbox(null)
                  openBookingTab()
                }}
                className="btn btn-gold"
              >
                Request This Look
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT REVIEW SUBMISSION MODAL */}
      {isReviewModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsReviewModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="booking-modal-card sck-review-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setIsReviewModalOpen(false)}
              aria-label="Close review modal"
            >
              <CloseIcon size={18} />
            </button>

            {!reviewSubmitted ? (
              <form onSubmit={handleReviewSubmit}>
                <div className="sck-review-header">
                  <div className="sck-review-eyebrow">SALON HUB • FIFTH AVENUE NYC</div>
                  <h2 className="sck-review-title">Leave a Client Note</h2>
                  <p className="sck-review-desc">
                    Your testimonial will appear directly in our Notes From Our Clients section and helps shape our bespoke craft.
                  </p>
                </div>

                {/* Rating Picker */}
                <div className="sck-form-group">
                  <label className="sck-form-label">1. Rate Your Experience</label>
                  <div className="sck-star-picker-box">
                    <div className="sck-stars-row">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          className={`sck-star-btn ${star <= reviewStars ? 'is-active' : ''}`}
                          onClick={() => setReviewStars(star)}
                          aria-label={`${star} star`}
                        >
                          <StarIcon filled={star <= reviewStars} size={28} />
                        </button>
                      ))}
                    </div>
                    <span className="sck-star-badge">
                      {reviewStars === 5
                        ? 'Exceptional · 5/5'
                        : reviewStars === 4
                        ? 'Very Good · 4/5'
                        : reviewStars === 3
                        ? 'Good · 3/5'
                        : `${reviewStars}/5 Stars`}
                    </span>
                  </div>
                </div>

                {/* Service Received */}
                <div className="sck-form-group">
                  <label className="sck-form-label">2. Service Received</label>
                  <select
                    className="sck-form-select"
                    value={reviewService}
                    onChange={(e) => setReviewService(e.target.value)}
                  >
                    <option value="Cut & Styling">Cut &amp; Styling</option>
                    <option value="Balayage & Dimensional Color">Balayage &amp; Dimensional Color</option>
                    <option value="Conditioning Hair Treatments">Conditioning Hair Treatments</option>
                    <option value="Bridal Artistry">Bridal Artistry</option>
                    <option value="Makeup">Makeup Application</option>
                    <option value="Perms & Relaxer">Perms &amp; Relaxer</option>
                    <option value="Nails">Nails &amp; Manicure</option>
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.name}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Author Name */}
                <div className="sck-form-group">
                  <label className="sck-form-label">3. Your Full Name</label>
                  <input
                    type="text"
                    className="sck-form-input"
                    placeholder="e.g. Carolyn Pianin"
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    required
                  />
                </div>

                {/* Comment Textarea */}
                <div className="sck-form-group">
                  <label className="sck-form-label">4. Your Comments / Review</label>
                  <textarea
                    className="sck-form-textarea"
                    rows="4"
                    placeholder="Describe your session with our Fifth Avenue stylists, your haircut, balayage, or overall salon experience..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="sck-submit-review-btn">
                  Submit Client Note
                </button>
              </form>
            ) : (
              <div className="sck-review-success">
                <div className="sck-success-icon">
                  <CheckCircleIcon size={50} />
                </div>
                <h2 className="sck-success-title">Thank You For Sharing</h2>
                <p className="sck-success-desc">
                  Your testimonial has been published directly into the Notes From Our Clients collection.
                </p>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  )
}
