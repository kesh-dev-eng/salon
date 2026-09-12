import React, { useState } from 'react'
import { TEAM_DATA } from '../data/pagesData'

export default function TeamPage({ onBookWithStylist }) {
  const [activeGroup, setActiveGroup] = useState('all')

  const allMembers = [
    ...TEAM_DATA.founders.map((m) => ({ ...m, group: 'founders', groupLabel: 'Co-Founder' })),
    ...TEAM_DATA.stylists.map((m) => ({ ...m, group: 'stylists', groupLabel: 'Hair Stylist' })),
    ...TEAM_DATA.colorists.map((m) => ({ ...m, group: 'colorists', groupLabel: 'Hair Colorist' }))
  ]

  const filteredMembers = activeGroup === 'all'
    ? allMembers
    : allMembers.filter((m) => m.group === activeGroup)

  return (
    <div className="sck-page sck-team-page">
      {/* Photo Hero Header */}
      <section
        className="sck-photo-hero"
        style={{ backgroundImage: "url('/images/heroes/team.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-left">
            <span className="sck-photo-hero-eyebrow">Artisans of Beauty</span>
            <h1 className="sck-photo-hero-title">
              The Artisans Of<br />Fifth Avenue
            </h1>
            <p className="sck-photo-hero-desc">
              Every stylist, colorist, and extension specialist at Salon HUB brings international editorial training, genuine warmth, and a commitment to bespoke hair artistry.
            </p>
            <button
              type="button"
              className="sck-photo-hero-btn"
              onClick={() => onBookWithStylist && onBookWithStylist(null)}
            >
              <span>Book With A Stylist</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="sck-catalog-controls">
        <div className="sck-catalog-controls-inner">
          <div className="sck-cat-pills" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === 'all'}
              className={`sck-cat-pill ${activeGroup === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveGroup('all')}
            >
              Full Team ({allMembers.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === 'founders'}
              className={`sck-cat-pill ${activeGroup === 'founders' ? 'is-active' : ''}`}
              onClick={() => setActiveGroup('founders')}
            >
              Co-Founders (3)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === 'stylists'}
              className={`sck-cat-pill ${activeGroup === 'stylists' ? 'is-active' : ''}`}
              onClick={() => setActiveGroup('stylists')}
            >
              Hair Stylists ({TEAM_DATA.stylists.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === 'colorists'}
              className={`sck-cat-pill ${activeGroup === 'colorists' ? 'is-active' : ''}`}
              onClick={() => setActiveGroup('colorists')}
            >
              Hair Colorists ({TEAM_DATA.colorists.length})
            </button>
          </div>
        </div>
      </section>

      {/* Team Cards Grid */}
      <section className="sck-team-grid-wrap">
        <div className="sck-team-grid">
          {filteredMembers.map((member) => (
            <div key={member.id} className="sck-team-card">
              <div className="sck-team-avatar-box">
                <div className="sck-avatar-initials">
                  {member.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <span className="sck-team-group-badge">{member.groupLabel}</span>
              </div>

              <div className="sck-team-card-content">
                <div className="sck-team-header-row">
                  <h2 className="sck-team-name">{member.name}</h2>
                  <span className="sck-team-exp">{member.experience}</span>
                </div>
                <div className="sck-team-role">{member.role}</div>
                <p className="sck-team-bio">{member.bio}</p>

                <div className="sck-team-specialties">
                  <span className="sck-spec-label">Specialties:</span>
                  <div className="sck-spec-tags">
                    {member.specialties.map((spec) => (
                      <span key={spec} className="sck-spec-tag">{spec}</span>
                    ))}
                  </div>
                </div>

                <div className="sck-team-card-footer">
                  <button
                    type="button"
                    className="sck-team-book-btn"
                    onClick={() => onBookWithStylist(member.name)}
                  >
                    Book with {member.name.split(' ')[0]} →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
