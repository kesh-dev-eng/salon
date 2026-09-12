import React, { useState } from 'react'

export default function AboutPage({ onBookClick, onNavigate }) {
  const [activePhoto, setActivePhoto] = useState(0)

  const salonPhotos = [
    {
      src: '/images/about-salon-1.jpg',
      title: 'Main Floor & Marble Island',
      caption: 'Basked in unfiltered Midtown daylight through expansive Fifth Avenue windows.'
    },
    {
      src: '/images/about-salon-2.jpg',
      title: 'Styling Stations & Product Bar',
      caption: 'Curated formulas from Kérastase, Olaplex, and Shu Uemura.'
    },
    {
      src: '/images/about-salon-3.jpg',
      title: 'Private Relaxation Shampoo Lounge',
      caption: 'Quiet, dimly lit sanctuary dedicated to deep scalp and hair conditioning rituals.'
    }
  ]

  return (
    <div className="sck-page sck-about-page">
      {/* Photo Hero Header */}
      <section
        className="sck-photo-hero"
        style={{ backgroundImage: "url('/images/heroes/about.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-left">
            <span className="sck-photo-hero-eyebrow">About Us</span>
            <h1 className="sck-photo-hero-title">
              Rooted In Craft.<br />Known For Care.
            </h1>
            <p className="sck-photo-hero-desc">
              Rooted in artisan craftsmanship and a genuine commitment to each guest, Barber Hub has built its reputation on Fifth Avenue by treating every appointment as a bespoke experience — never a routine one. Here, elevated technique and personalized care exist in equal measure, creating a space where expertise feels warm and luxury feels effortless.
            </p>
            <button
              type="button"
              className="sck-photo-hero-btn"
              onClick={onBookClick}
            >
              <span>Book Appointment</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Narrative & Values */}
      <section className="sck-about-main-block">
        <div className="sck-about-main-container">
          <div className="sck-about-lead-grid">
            <div className="sck-about-lead-copy">
              <span className="sck-gold-tag">OUR STORY &amp; PHILOSOPHY</span>
              <h2 className="sck-about-heading">A More Personal Kind of Luxury Salon</h2>
              <p className="sck-about-body-text">
                Barber Hub was founded on the conviction that luxury hair care and bespoke barbering should feel genuinely attentive rather than intimidating or transactional. Located at <strong>587 Fifth Avenue</strong>, our fourth-floor space provides a sunlit, peaceful escape from the hustle of Midtown Manhattan.
              </p>
              <p className="sck-about-body-text">
                From the moment you arrive, the focus is entirely on you — your lifestyle, your natural texture, and the bespoke aesthetic you wish to embody. Whether designing a lived-in balayage, carving a precision haircut, or administering botanical conditioning rituals, each service is treated as high-fashion artistry.
              </p>
              <div className="sck-about-stats-strip">
                <div className="sck-about-stat-box">
                  <span className="sck-stat-highlight">587</span>
                  <span className="sck-stat-sub">Fifth Avenue, 4th Floor NYC</span>
                </div>
                <div className="sck-about-stat-box">
                  <span className="sck-stat-highlight">10+</span>
                  <span className="sck-stat-sub">Years of Fifth Ave Excellence</span>
                </div>
                <div className="sck-about-stat-box">
                  <span className="sck-stat-highlight">4.9 ★</span>
                  <span className="sck-stat-sub">Over 500+ Verified 5-Star Reviews</span>
                </div>
              </div>
            </div>

            <div className="sck-about-lead-photo-wrap">
              <div className="sck-about-hero-img-box">
                <img
                  src={salonPhotos[activePhoto].src}
                  alt={salonPhotos[activePhoto].title}
                  className="sck-about-hero-img"
                />
                <div className="sck-hero-img-overlay">
                  <div className="sck-hero-img-title">{salonPhotos[activePhoto].title}</div>
                  <div className="sck-hero-img-desc">{salonPhotos[activePhoto].caption}</div>
                </div>
              </div>

              {/* Photo switcher */}
              <div className="sck-about-photo-thumbs">
                {salonPhotos.map((photo, i) => (
                  <button
                    key={photo.title}
                    type="button"
                    className={`sck-thumb-btn ${activePhoto === i ? 'is-active' : ''}`}
                    onClick={() => setActivePhoto(i)}
                  >
                    <img src={photo.src} alt={photo.title} />
                    <span>0{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 4 Pillars */}
      <section className="sck-pillars-section">
        <div className="sck-pillars-container">
          <div className="sck-section-title-center">
            <span className="sck-gold-tag">WHAT SETS US APART</span>
            <h2 className="sck-section-headline">The Barber Hub Standard</h2>
          </div>

          <div className="sck-pillars-grid">
            <div className="sck-pillar-card">
              <div className="sck-pillar-num">01</div>
              <h3 className="sck-pillar-title">Unfiltered Natural Daylight</h3>
              <p className="sck-pillar-text">
                Expansive Fifth Avenue windows illuminate every station, allowing our colorists to formulate and evaluate shades in true daylight — preventing artificial salon light distortions.
              </p>
            </div>

            <div className="sck-pillar-card">
              <div className="sck-pillar-num">02</div>
              <h3 className="sck-pillar-title">Artisan Customization</h3>
              <p className="sck-pillar-text">
                Every service begins with an individualized consultation. We never use cookie-cutter formulas or rushed procedures. Every section is hand-painted and tailored to you.
              </p>
            </div>

            <div className="sck-pillar-card">
              <div className="sck-pillar-num">03</div>
              <h3 className="sck-pillar-title">World-Class Formulations</h3>
              <p className="sck-pillar-text">
                We partner exclusively with luxury hair brands including Kérastase, Olaplex, and Shu Uemura, protecting disulfide bonds and restoring maximum silkiness.
              </p>
            </div>

            <div className="sck-pillar-card">
              <div className="sck-pillar-num">04</div>
              <h3 className="sck-pillar-title">Renowned Master Artists</h3>
              <p className="sck-pillar-text">
                Our stylists and colorists are sought-after editorial contributors to Allure, Glamour, and Marie Claire, bringing couture precision directly to your chair.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="sck-about-cta-bar">
            <button type="button" className="sck-btn-teal" onClick={onBookClick}>
              Book Your Appointment
            </button>
            <button
              type="button"
              className="sck-btn-outline"
              onClick={() => onNavigate('team')}
            >
              Meet Our Team →
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
