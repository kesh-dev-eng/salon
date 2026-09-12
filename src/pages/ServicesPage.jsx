import React, { useState, useEffect } from 'react'
import { formatPrice } from '../data/initialData'

export default function ServicesPage({
  services,
  onBookService,
  activeCategory = 'all',
  onSelectCategory
}) {
  const [currentCategory, setCurrentCategory] = useState(activeCategory)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (activeCategory) {
      setCurrentCategory(activeCategory)
    }
  }, [activeCategory])

  const categories = [
    { id: 'all', label: 'All Services' },
    { id: 'Cut & Styling', label: 'Cut & Styling' },
    { id: 'Color', label: 'Color' },
    { id: 'Conditioning Hair Treatments', label: 'Conditioning Hair Treatments' },
    { id: 'Makeup', label: 'Makeup' },
    { id: 'Bridal', label: 'Bridal' },
    { id: 'Perms & Relaxer', label: 'Perms & Relaxer' },
    { id: 'Nails', label: 'Nails' }
  ]

  const handleSelectCat = (catId) => {
    setCurrentCategory(catId)
    if (onSelectCategory) {
      onSelectCategory(catId)
    }
  }

  const filtered = services.filter((srv) => {
    const matchesCat = currentCategory === 'all' || srv.category === currentCategory
    const matchesSearch = srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.desc.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="sck-page sck-services-page">
      {/* Photo Hero Header */}
      <section
        className="sck-photo-hero"
        style={{ backgroundImage: "url('/images/heroes/services.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-left">
            <span className="sck-photo-hero-eyebrow">Hair &amp; Color Atelier</span>
            <h1 className="sck-photo-hero-title">
              Bespoke Hair Services<br />In The Heart Of Fifth<br />Avenue
            </h1>
            <p className="sck-photo-hero-desc">
              Bespoke color, precision cuts, and luxury treatments by Kérastase and Olaplex, crafted for you on Fifth Avenue. From everyday elegance to bridal hair and makeup for New York brides, every service reflects your personal style.
            </p>
            <button
              type="button"
              className="sck-photo-hero-btn"
              onClick={() => onBookService && onBookService(services && services[0])}
            >
              <span>Book Appointment</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Filter Toolbar */}
      <section id="services-catalog" className="sck-catalog-controls">
        <div className="sck-catalog-controls-inner">
          <div className="sck-cat-pills" role="tablist">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={currentCategory === cat.id}
                className={`sck-cat-pill ${currentCategory === cat.id ? 'is-active' : ''}`}
                onClick={() => handleSelectCat(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="sck-search-wrap">
            <input
              type="text"
              placeholder="Search services..."
              maxLength={50}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sck-search-input"
              aria-label="Search services"
            />
            {searchQuery && (
              <button
                type="button"
                className="sck-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="sck-catalog-grid-wrap">
        <div className="sck-catalog-grid">
          {filtered.map((service) => (
            <article key={service.id} className="sck-service-card card">
              {/* First Content — Default Front View */}
              <div className="first-content">
                <div className="sck-service-img-wrap">
                  <img
                    src={service.img}
                    alt={service.name}
                    className="sck-service-img"
                    loading="lazy"
                  />
                  <span className="sck-service-badge">{service.category}</span>
                </div>
                <div className="sck-service-card-body">
                  <div className="sck-service-meta-row">
                    <h2 className="sck-service-card-name">{service.name}</h2>
                    <div className="sck-service-card-price">{formatPrice(service.price)}</div>
                  </div>
                  <p className="sck-service-card-desc">{service.desc}</p>
                  <div className="sck-service-card-footer">
                    <span className="sck-service-duration">{service.duration}</span>
                    <div className="sck-service-card-book-btn">
                      Book Now →
                    </div>
                  </div>
                </div>
              </div>

              {/* Second Content — Hover Flip & Reveal View */}
              <div className="second-content">
                <span className="sck-second-tag">{service.category}</span>
                <h3 className="sck-second-title">{service.name}</h3>
                <div className="sck-second-price">{formatPrice(service.price)}</div>
                <div className="sck-second-divider" />
                <p className="sck-second-desc">{service.desc}</p>
                <div className="sck-second-duration-badge">
                  <span>Duration: {service.duration}</span>
                </div>
                <button
                  type="button"
                  className="sck-second-book-btn"
                  onClick={() => onBookService(service)}
                >
                  <span>Book Appointment</span>
                  <span className="sck-service-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="sck-no-results">
            <p>No services match "{searchQuery}".</p>
            <button
              type="button"
              className="sck-btn-teal"
              onClick={() => {
                setActiveCategory('all')
                setSearchQuery('')
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
