import React, { useState } from 'react'
import { SALON_INFO } from '../data/pagesData'
import { syncContactToSupabase } from '../supabase'

export default function ContactPage({ onBookClick }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceInterest: 'Cut & Styling',
    message: ''
  })
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsSubmitted(true)
    syncContactToSupabase({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      service: formData.serviceInterest,
      message: formData.message
    })
  }

  return (
    <div className="sck-page sck-contact-page">
      {/* Photo Hero Header */}
      <section
        className="sck-photo-hero"
        style={{ backgroundImage: "url('/images/heroes/contact.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-left">
            <span className="sck-photo-hero-eyebrow">Concierge &amp; Location</span>
            <h1 className="sck-photo-hero-title">
              Visit Our Fifth Avenue<br />Salon
            </h1>
            <p className="sck-photo-hero-desc">
              Located at 587 Fifth Avenue in Midtown Manhattan, Barber Hub is your private haven for bespoke color, precision cuts, and bridal artistry.
            </p>
            <button
              type="button"
              className="sck-photo-hero-btn"
              onClick={onBookClick}
            >
              <span>Book An Appointment</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <section className="sck-contact-grid-wrap">
        <div className="sck-contact-container">
          <div className="sck-contact-grid">
            {/* Left: Contact Info & Hours */}
            <div className="sck-contact-info-col">
              <div className="sck-contact-info-card">
                <h2 className="sck-contact-card-title">Barber Hub Location</h2>
                <div className="sck-info-item">
                  <div className="sck-info-icon">📍</div>
                  <div className="sck-info-content">
                    <span className="sck-info-label">Address</span>
                    <p className="sck-info-val">587 5th Avenue #Fourth Floor<br />New York, NY 10017</p>
                    <span className="sck-info-note">Between 47th &amp; 48th Streets</span>
                  </div>
                </div>

                <div className="sck-info-item">
                  <div className="sck-info-icon">📞</div>
                  <div className="sck-info-content">
                    <span className="sck-info-label">Phone</span>
                    <a href="tel:2122651700" className="sck-info-link">(212) 265-1700</a>
                  </div>
                </div>

                <div className="sck-info-item">
                  <div className="sck-info-icon">✉️</div>
                  <div className="sck-info-content">
                    <span className="sck-info-label">Email</span>
                    <a href="mailto:info@barberhub.com" className="sck-info-link">info@barberhub.com</a>
                  </div>
                </div>

                <div className="sck-transit-box">
                  <span className="sck-transit-title">Subway Access</span>
                  <p className="sck-transit-desc">
                    • <strong>47-50 Sts Rockefeller Ctr</strong>: B, D, F, M trains<br />
                    • <strong>5 Av / 53 St</strong>: E, M trains<br />
                    • <strong>Grand Central Terminal</strong>: 4, 5, 6, 7, S trains (6 min walk)
                  </p>
                </div>
              </div>

              {/* Operating Hours Card */}
              <div className="sck-contact-hours-card">
                <h3 className="sck-hours-title">Hours of Operation</h3>
                <div className="sck-hours-list">
                  {SALON_INFO.hours.map((h) => (
                    <div key={h.day} className={`sck-hour-row ${h.time === 'Closed' ? 'is-closed' : ''}`}>
                      <span className="sck-day-name">{h.day}</span>
                      <span className="sck-time-range">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Message Form */}
            <div className="sck-contact-form-col">
              <div className="sck-contact-form-card">
                <h2 className="sck-contact-card-title">Send a Message</h2>
                <p className="sck-form-subtitle">
                  Fill out the form below and our Fifth Avenue concierge team will respond promptly. For immediate reservations, call <a href="tel:2122651700">(212) 265-1700</a>.
                </p>

                {isSubmitted ? (
                  <div className="sck-form-success-box">
                    <div className="sck-success-check">✓</div>
                    <h3>Thank You for Contacting Barber Hub</h3>
                    <p>
                      We have received your message. A member of our Fifth Avenue team will reach out to you within one business day.
                    </p>
                    <button
                      type="button"
                      className="sck-btn-teal"
                      onClick={() => {
                        setIsSubmitted(false)
                        setFormData({ name: '', email: '', phone: '', serviceInterest: 'Cut & Styling', message: '' })
                      }}
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="sck-contact-form">
                    <div className="sck-form-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label htmlFor="contact-name">Your Full Name *</label>
                        <span className="sck-char-limit-badge">{formData.name.length}/60</span>
                      </div>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        maxLength={60}
                        placeholder="e.g. Eleanor Vance"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="sck-form-row">
                      <div className="sck-form-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label htmlFor="contact-email">Email Address *</label>
                          <span className="sck-char-limit-badge">{formData.email.length}/80</span>
                        </div>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          maxLength={80}
                          placeholder="you@domain.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="sck-form-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label htmlFor="contact-phone">Phone Number</label>
                          <span className="sck-char-limit-badge">{formData.phone.length}/18</span>
                        </div>
                        <input
                          id="contact-phone"
                          type="tel"
                          maxLength={18}
                          placeholder="(212) 000-0000"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="sck-form-field">
                      <label htmlFor="contact-service">Service of Interest</label>
                      <select
                        id="contact-service"
                        value={formData.serviceInterest}
                        onChange={(e) => setFormData({ ...formData, serviceInterest: e.target.value })}
                      >
                        <option value="Cut & Styling">Cut &amp; Styling</option>
                        <option value="Color">Bespoke Color / Balayage</option>
                        <option value="Conditioning Hair Treatments">Conditioning Treatments (Kérastase / Olaplex)</option>
                        <option value="Bridal">Bridal Hair &amp; Makeup</option>
                        <option value="Makeup">Custom Blended Makeup</option>
                        <option value="Perms & Relaxer">Perms &amp; Relaxer</option>
                        <option value="Nails">Manicure / Nails</option>
                        <option value="Other">General Question</option>
                      </select>
                    </div>

                    <div className="sck-form-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label htmlFor="contact-msg">How Can We Help You? *</label>
                        <span className="sck-char-limit-badge">{formData.message.length}/500</span>
                      </div>
                      <textarea
                        id="contact-msg"
                        rows="4"
                        required
                        maxLength={500}
                        placeholder="Share details about your hair goals, preferred stylist, or question..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      />
                    </div>

                    <div className="sck-form-submit-row">
                      <button type="submit" className="sck-btn-teal sck-full-btn">
                        Submit Message
                      </button>
                      <button
                        type="button"
                        className="sck-btn-outline"
                        onClick={onBookClick}
                      >
                        Book Appointment Online →
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
