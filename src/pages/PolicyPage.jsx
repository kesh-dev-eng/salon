import React from 'react'
import { SALON_POLICIES } from '../data/pagesData'

export default function PolicyPage({ onBookClick }) {
  return (
    <div className="sck-page sck-policy-page">
      {/* Photo Hero Centered */}
      <section
        className="sck-photo-hero sck-photo-hero-centered"
        style={{ backgroundImage: "url('/images/heroes/policy.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-center-box">
            <span className="sck-photo-hero-eyebrow">Guest Guidelines</span>
            <h1 className="sck-photo-hero-title">Cancellation Policy</h1>
            <p className="sck-photo-hero-desc" style={{ margin: '0 auto', maxWidth: '560px' }}>
              Please review our reservation policies to ensure a seamless experience on Fifth Avenue.
            </p>
          </div>
        </div>
      </section>

      <section className="sck-policy-content-section">
        <div className="sck-policy-container">
          <div className="sck-policy-list">
            {SALON_POLICIES.map((policy, idx) => (
              <div key={idx} className="sck-policy-item">
                <h2 className="sck-policy-title">
                  <span className="sck-policy-num">0{idx + 1}.</span> {policy.title}
                </h2>
                <p className="sck-policy-text">{policy.desc}</p>
              </div>
            ))}
          </div>

          <div className="sck-policy-footer-note">
            <p>
              Have a question about our policies or need to modify an existing reservation? Please call our concierge desk directly at <a href="tel:2122651700">(212) 265-1700</a>.
            </p>
            <button type="button" className="sck-btn-teal" onClick={onBookClick}>
              Book An Appointment
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
