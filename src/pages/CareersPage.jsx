import React, { useState } from 'react'

export default function CareersPage() {
  const [submitted, setSubmitted] = useState(false)
  const [careerForm, setCareerForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Hair Stylist',
    instagram: '',
    message: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const positions = [
    {
      title: 'Master Hair Stylist & Cutter',
      type: 'Full Time / Part Time',
      desc: 'Seeking accomplished stylists with a strong passion for precision cutting, editorial trends, and bespoke client consultations on Fifth Avenue.'
    },
    {
      title: 'Senior Hair Colorist',
      type: 'Full Time',
      desc: 'Specialist in French balayage, high-lift blonding, and glossing protocols with deep knowledge of bond repair systems.'
    },
    {
      title: 'Salon Apprentice / Color Assistant',
      type: 'Full Time',
      desc: 'Motivated licensed cosmetologist eager to train under world-class editorial stylists and master high-end salon operations.'
    }
  ]

  return (
    <div className="sck-page sck-careers-page">
      {/* Photo Hero Header */}
      <section
        className="sck-photo-hero"
        style={{ backgroundImage: "url('/images/heroes/careers.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-left">
            <span className="sck-photo-hero-eyebrow">Join Our Team</span>
            <h1 className="sck-photo-hero-title">
              Join The Salon HUB<br />Atelier
            </h1>
            <p className="sck-photo-hero-desc">
              We are always seeking passionate, world-class hair artists, apprentices, and guest experience coordinators who take pride in artisan technique and attentive care.
            </p>
            <a href="#openings" className="sck-photo-hero-btn">
              <span>Explore Positions</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </section>

      <section id="openings" className="sck-careers-grid-section">
        <div className="sck-careers-container">
          <div className="sck-careers-roles-list">
            <h2 className="sck-roles-heading">Current Opportunities</h2>
            {positions.map((pos, idx) => (
              <div key={idx} className="sck-role-card">
                <div className="sck-role-header">
                  <h3 className="sck-role-title">{pos.title}</h3>
                  <span className="sck-role-type">{pos.type}</span>
                </div>
                <p className="sck-role-desc">{pos.desc}</p>
              </div>
            ))}
          </div>

          <div className="sck-career-apply-card">
            <h2 className="sck-contact-card-title">Apply to Salon HUB</h2>
            <p className="sck-form-subtitle">
              Submit your portfolio and details below or email your resume directly to <a href="mailto:careers@salonhub.com">careers@salonhub.com</a>.
            </p>

            {submitted ? (
              <div className="sck-form-success-box">
                <div className="sck-success-check">✓</div>
                <h3>Application Received</h3>
                <p>Thank you for your interest in Salon HUB. Our management team will review your credentials and contact you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="sck-contact-form">
                <div className="sck-form-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="applicant-name">Full Name *</label>
                    <span className="sck-char-limit-badge">{careerForm.name.length}/60</span>
                  </div>
                  <input
                    id="applicant-name"
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Your Name"
                    value={careerForm.name}
                    onChange={(e) => setCareerForm({ ...careerForm, name: e.target.value })}
                  />
                </div>
                <div className="sck-form-row">
                  <div className="sck-form-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="applicant-email">Email Address *</label>
                      <span className="sck-char-limit-badge">{careerForm.email.length}/80</span>
                    </div>
                    <input
                      id="applicant-email"
                      type="email"
                      required
                      maxLength={80}
                      placeholder="you@domain.com"
                      value={careerForm.email}
                      onChange={(e) => setCareerForm({ ...careerForm, email: e.target.value })}
                    />
                  </div>
                  <div className="sck-form-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="applicant-phone">Phone Number *</label>
                      <span className="sck-char-limit-badge">{careerForm.phone.length}/18</span>
                    </div>
                    <input
                      id="applicant-phone"
                      type="tel"
                      required
                      maxLength={18}
                      placeholder="(212) 000-0000"
                      value={careerForm.phone}
                      onChange={(e) => setCareerForm({ ...careerForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="sck-form-row">
                  <div className="sck-form-field">
                    <label htmlFor="applicant-role">Position Desired</label>
                    <select
                      id="applicant-role"
                      value={careerForm.role}
                      onChange={(e) => setCareerForm({ ...careerForm, role: e.target.value })}
                    >
                      <option value="Hair Stylist">Hair Stylist &amp; Cutter</option>
                      <option value="Colorist">Hair Colorist</option>
                      <option value="Apprentice">Salon Apprentice / Assistant</option>
                      <option value="Concierge">Front Desk Concierge</option>
                    </select>
                  </div>
                  <div className="sck-form-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="applicant-ig">Instagram / Portfolio URL</label>
                      <span className="sck-char-limit-badge">{careerForm.instagram.length}/120</span>
                    </div>
                    <input
                      id="applicant-ig"
                      type="text"
                      maxLength={120}
                      placeholder="@yourhandle or URL"
                      value={careerForm.instagram}
                      onChange={(e) => setCareerForm({ ...careerForm, instagram: e.target.value })}
                    />
                  </div>
                </div>

                <div className="sck-form-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="applicant-msg">Experience &amp; Background</label>
                    <span className="sck-char-limit-badge">{careerForm.message.length}/600</span>
                  </div>
                  <textarea
                    id="applicant-msg"
                    rows="3"
                    maxLength={600}
                    placeholder="Brief summary of your cosmetology background, years in salon, and career goals..."
                    value={careerForm.message}
                    onChange={(e) => setCareerForm({ ...careerForm, message: e.target.value })}
                  />
                </div>

                <button type="submit" className="sck-btn-teal sck-full-btn">
                  Submit Application
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
