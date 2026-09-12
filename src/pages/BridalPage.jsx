import React from 'react'
import { BRIDAL_PACKAGES } from '../data/pagesData'
import { formatPrice } from '../data/initialData'

export default function BridalPage({ onBookClick }) {
  return (
    <div className="sck-page sck-bridal-page">
      {/* Photo Hero Centered */}
      <section
        className="sck-photo-hero sck-photo-hero-centered"
        style={{ backgroundImage: "url('/images/heroes/bridal.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-center-box">
            <span className="sck-photo-hero-eyebrow">Bespoke Weddings</span>
            <h1 className="sck-photo-hero-title">Bridal Atelier</h1>
            <p className="sck-photo-hero-desc" style={{ margin: '0 auto', maxWidth: '560px' }}>
              Exquisite bridal hair &amp; makeup artistry tailored for your most memorable celebration.
            </p>
          </div>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="sck-bridal-packages-section">
        <div className="sck-bridal-container">
          <div className="sck-section-title-center">
            <span className="sck-gold-tag">BESPOKE BRIDAL EXPERIENCES</span>
            <h2 className="sck-section-headline">Bridal Hair &amp; Makeup Packages</h2>
          </div>

          <div className="sck-bridal-grid">
            {BRIDAL_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="sck-bridal-card">
                <div className="sck-bridal-card-header">
                  <h3 className="sck-bridal-card-title">{pkg.title}</h3>
                  <div className="sck-bridal-price-tag">
                    <span className="sck-pkg-price">{formatPrice(pkg.price)}</span>
                    <span className="sck-pkg-duration">{pkg.duration}</span>
                  </div>
                </div>
                <p className="sck-bridal-desc">{pkg.desc}</p>

                <div className="sck-bridal-includes">
                  <span className="sck-includes-label">Package Inclusions:</span>
                  <ul>
                    {pkg.includes.map((inc, i) => (
                      <li key={i}>{inc}</li>
                    ))}
                  </ul>
                </div>

                <div className="sck-bridal-card-footer">
                  <button
                    type="button"
                    className="sck-btn-teal sck-full-btn"
                    onClick={onBookClick}
                  >
                    Inquire / Reserve
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="sck-bridal-info-banner">
            <div className="sck-bridal-banner-text">
              <h3>Planning a Destination or Tri-State Wedding?</h3>
              <p>
                Our Fifth Avenue bridal team travels directly to venues across New York, the Hamptons, Connecticut, and beyond. Inquire early to secure your wedding date on our master artists’ calendar.
              </p>
            </div>
            <button type="button" className="sck-btn-outline" onClick={onBookClick}>
              Contact Bridal Coordinator →
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
