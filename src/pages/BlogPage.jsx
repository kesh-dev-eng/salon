import React, { useState } from 'react'
import { BLOG_POSTS } from '../data/pagesData'

export default function BlogPage({ onBookClick }) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPost, setSelectedPost] = useState(null)

  const categories = ['all', 'Haircare & Tools', 'Treatments & Science', 'Cuts & Trends', 'Bridal Artistry', 'Color & Technique', 'Editorial Trends']

  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesCat = activeCategory === 'all' || post.category === activeCategory
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.publication.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="sck-page sck-blog-page">
      {/* Photo Hero Header */}
      <section
        className="sck-photo-hero"
        style={{ backgroundImage: "url('/images/heroes/blog.jpg')" }}
      >
        <div className="sck-photo-hero-overlay" />
        <div className="sck-photo-hero-content">
          <div className="sck-photo-hero-left">
            <span className="sck-photo-hero-eyebrow">The Editorial Journal</span>
            <h1 className="sck-photo-hero-title">
              The Journal Of Salon<br />HUB
            </h1>
            <p className="sck-photo-hero-desc">
              From artisan color techniques to bridal hair inspiration for NYC brides, Salon HUB shares NYC hair styling tips and the expertise that shapes every chair on Fifth Avenue. Real insights, refined perspective, and the beauty knowledge New York deserves.
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

      {/* Filter Controls */}
      <section className="sck-catalog-controls">
        <div className="sck-catalog-controls-inner">
          <div className="sck-cat-pills" role="tablist">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`sck-cat-pill ${activeCategory === cat ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'All Articles' : cat}
              </button>
            ))}
          </div>

          <div className="sck-search-wrap">
            <input
              type="text"
              placeholder="Search articles & press..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sck-search-input"
              aria-label="Search blog articles"
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

      {/* Blog Cards Grid */}
      <section className="sck-blog-grid-wrap">
        <div className="sck-blog-grid">
          {filteredPosts.map((post) => (
            <article key={post.id} className="sck-blog-card">
              <div className="sck-blog-card-top">
                <div className="sck-blog-pub-badge">{post.publication}</div>
                <div className="sck-blog-meta">
                  <span>{post.date}</span>
                  <span className="sck-bullet">•</span>
                  <span>{post.readTime}</span>
                </div>
              </div>
              <h2 className="sck-blog-card-title">{post.title}</h2>
              <p className="sck-blog-card-excerpt">{post.excerpt}</p>
              <div className="sck-blog-card-bottom">
                <span className="sck-blog-tag">{post.category}</span>
                <button
                  type="button"
                  className="sck-blog-read-btn"
                  onClick={() => setSelectedPost(post)}
                >
                  Read Article →
                </button>
              </div>
            </article>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="sck-no-results">
            <p>No articles match "{searchQuery}".</p>
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

      {/* Article Detail Modal */}
      {selectedPost && (
        <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
          <div
            className="sck-article-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-article-title"
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedPost(null)}
              aria-label="Close article"
            >
              ✕
            </button>
            <div className="sck-article-modal-header">
              <span className="sck-blog-pub-badge">{selectedPost.publication}</span>
              <span className="sck-blog-tag">{selectedPost.category}</span>
              <span className="sck-article-date">{selectedPost.date} · {selectedPost.readTime}</span>
            </div>
            <h2 id="modal-article-title" className="sck-article-modal-title">
              {selectedPost.title}
            </h2>
            <div className="sck-article-modal-body">
              {selectedPost.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
            <div className="sck-article-modal-footer">
              <button
                type="button"
                className="sck-btn-teal"
                onClick={() => {
                  setSelectedPost(null)
                  onBookClick()
                }}
              >
                Book An Appointment
              </button>
              <button
                type="button"
                className="sck-btn-outline"
                onClick={() => setSelectedPost(null)}
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
