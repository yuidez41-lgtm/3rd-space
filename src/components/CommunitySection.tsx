"use client";

import Link from "next/link";

const SITE_PADDING = "clamp(1.5rem, 5vw, 4rem)";

const stats = [
  { num: "500+", label: "Members" },
  { num: "8mths", label: "Running" },
  { num: "50+", label: "Events Held" },
];

export default function CommunitySection() {
  return (
    <>
      <style>{`
        /* ─── Community Section ─────────────────────────────────── */

        .comm-section {
          width: 100%;
          background-color: #152015;
          position: relative;
          overflow: hidden;
          padding: clamp(4rem, 8vw, 7rem) 0;
        }

        /* Decorative right-side background */
        .comm-deco-bg {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 45%;
          pointer-events: none;
          overflow: hidden;
        }

        .comm-deco-svg {
          position: absolute;
          right: clamp(2rem, 6vw, 5rem);
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.08;
          width: clamp(120px, 18vw, 260px);
          height: clamp(120px, 18vw, 260px);
        }

        .comm-deco-card-1 {
          position: absolute;
          right: clamp(3rem, 8vw, 6rem);
          bottom: clamp(2rem, 5vw, 4rem);
          width: clamp(60px, 7vw, 96px);
          height: clamp(80px, 9vw, 128px);
          background: rgba(232, 213, 163, 0.04);
          border: 1px solid rgba(232, 213, 163, 0.08);
          border-radius: 4px;
          transform: rotate(6deg);
        }

        .comm-deco-card-2 {
          position: absolute;
          right: clamp(6rem, 13vw, 10rem);
          bottom: clamp(3rem, 7vw, 6rem);
          width: clamp(50px, 6vw, 80px);
          height: clamp(70px, 8vw, 112px);
          background: rgba(212, 168, 67, 0.04);
          border: 1px solid rgba(212, 168, 67, 0.08);
          border-radius: 4px;
          transform: rotate(-3deg);
        }

        /* Inner wrapper */
        .comm-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 clamp(1.5rem, 5vw, 4rem);
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: clamp(2.5rem, 5vw, 4rem);
        }

        /* Two-col grid */
        .comm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
          gap: clamp(2.5rem, 6vw, 5rem);
          align-items: center;
        }

        /* Decorative left column */
        .comm-deco-col {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: clamp(180px, 28vw, 420px);
          position: relative;
          /* Default order: deco first on desktop (natural) */
          order: 0;
        }

        .comm-join-text {
          font-family: 'Yanone Kaffeesatz', sans-serif;
          font-weight: 700;
          font-size: clamp(5rem, 16vw, 22rem);
          line-height: 1;
          color: rgba(232, 213, 163, 0.04);
          user-select: none;
          letter-spacing: -0.02em;
          position: absolute;
          white-space: nowrap;
        }

        .comm-icon-cluster {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .comm-icon-ring {
          width: clamp(56px, 7.5vw, 100px);
          height: clamp(56px, 7.5vw, 100px);
          border-radius: 50%;
          border: 1px solid rgba(232, 213, 163, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .comm-icon-ring svg {
          width: 40%;
          height: 40%;
          color: #d4a843;
        }

        .comm-icon-dots {
          display: flex;
          gap: 0.5rem;
        }

        /* Right col — text content */
        .comm-text-col {
          display: flex;
          flex-direction: column;
          order: 1;
        }

        .comm-eyebrow {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(232, 213, 163, 0.4);
          font-size: 0.65rem;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          margin-bottom: 0.875rem;
          font-family: 'Yanone Kaffeesatz', sans-serif;
        }

        .comm-eyebrow-line {
          width: 32px;
          height: 1px;
          background: rgba(232, 213, 163, 0.3);
          display: inline-block;
          flex-shrink: 0;
        }

        .comm-heading {
          font-family: 'Yanone Kaffeesatz', sans-serif;
          font-weight: 700;
          color: #e8d5a3;
          font-size: clamp(2.2rem, 5.5vw, 5rem);
          line-height: 0.95;
          letter-spacing: 0.02em;
          margin: 0 0 clamp(1rem, 2vw, 1.5rem);
          text-transform: uppercase;
        }

        .comm-body-primary {
          color: rgba(232, 213, 163, 0.55);
          font-size: clamp(0.8rem, 1.2vw, 0.9rem);
          line-height: 1.7;
          margin-bottom: 0.75rem;
          max-width: 380px;
        }

        .comm-body-secondary {
          color: rgba(232, 213, 163, 0.35);
          font-size: clamp(0.7rem, 1vw, 0.8rem);
          line-height: 1.7;
          margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
          max-width: 380px;
        }

        .comm-cta {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: #e8d5a3;
          color: #0f1a0f;
          font-family: 'Yanone Kaffeesatz', sans-serif;
          font-size: clamp(0.85rem, 1.2vw, 1rem);
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          padding: clamp(0.75rem, 1.2vw, 0.875rem) clamp(1.5rem, 3vw, 2rem);
          text-decoration: none;
          transition: background 0.3s;
          /* Ensure 44px minimum tap target height */
          min-height: 44px;
        }

        .comm-cta:hover {
          background: #d4a843;
        }

        /* Stats row */
        .comm-stats {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(1rem, 3.5vw, 2.5rem);
          margin-top: clamp(2rem, 4vw, 3.5rem);
          padding-top: clamp(1.5rem, 3vw, 2.5rem);
          border-top: 1px solid rgba(232, 213, 163, 0.1);
        }

        .comm-stat-num {
          font-family: 'Yanone Kaffeesatz', sans-serif;
          font-weight: 700;
          color: #d4a843;
          font-size: clamp(1.2rem, 2.5vw, 2rem);
          margin: 0;
          line-height: 1;
        }

        .comm-stat-label {
          color: rgba(232, 213, 163, 0.4);
          font-size: clamp(0.55rem, 0.9vw, 0.7rem);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-top: 0.35rem;
          font-family: 'Yanone Kaffeesatz', sans-serif;
        }

        /* ─── MOBILE PORTRAIT (≤640px) ─────────────────────────── */
        @media (max-width: 640px) {
          .comm-grid {
            gap: 1.5rem;
          }

          /* Content first on mobile */
          .comm-deco-col {
            order: 1;
            min-height: clamp(120px, 35vw, 220px);
          }

          .comm-text-col {
            order: 0;
          }

          .comm-body-primary,
          .comm-body-secondary {
            max-width: 100%;
          }

          /* Full-width CTA tap target */
          .comm-cta {
            align-self: stretch;
            justify-content: center;
          }
        }

        /* ─── VERY SMALL PHONES (≤380px / iPhone SE) ───────────── */
        @media (max-width: 380px) {
          .comm-section {
            padding: 2.5rem 0;
          }

          .comm-heading {
            font-size: 2rem;
          }

          /* Stats wrap tightly — each item a flex item so they wrap cleanly */
          .comm-stats {
            gap: 0.875rem 1.25rem;
          }

          .comm-stat-num {
            font-size: 1.15rem;
          }

          .comm-stat-label {
            font-size: 0.5rem;
          }
        }

        /* ─── LANDSCAPE PHONES (short viewport) ─────────────────── */
        @media (orientation: landscape) and (max-height: 600px) {
          .comm-section {
            padding: clamp(1.5rem, 4vw, 3rem) 0;
          }

          .comm-grid {
            gap: clamp(1.5rem, 4vw, 3rem);
          }

          /* Hide decorative column entirely on landscape phones — saves vertical space */
          .comm-deco-col {
            display: none;
          }

          .comm-text-col {
            order: 0;
          }

          /* Use two-col when there's horizontal room (landscape phones typically ≥667px wide) */
          @media (min-width: 560px) {
            .comm-grid {
              grid-template-columns: 1fr 1fr;
            }
          }

          .comm-heading {
            font-size: clamp(1.8rem, 6vw, 3.2rem);
            margin-bottom: 0.75rem;
          }

          .comm-body-primary {
            margin-bottom: 0.5rem;
          }

          .comm-body-secondary {
            margin-bottom: 1rem;
          }

          .comm-stats {
            margin-top: 1rem;
            padding-top: 1rem;
          }
        }

        /* ─── TABLETS PORTRAIT (641px–1024px) ───────────────────── */
        @media (min-width: 641px) and (max-width: 1024px) and (orientation: portrait) {
          .comm-grid {
            grid-template-columns: 1fr 1.4fr;
            gap: clamp(2rem, 4vw, 3.5rem);
          }

          .comm-deco-col {
            min-height: clamp(200px, 28vw, 320px);
          }

          .comm-heading {
            font-size: clamp(2.8rem, 5vw, 4.2rem);
          }
        }

        /* ─── TABLETS LANDSCAPE (641px–1366px landscape) ─────────── */
        @media (min-width: 641px) and (max-width: 1366px) and (orientation: landscape) {
          .comm-section {
            padding: clamp(3rem, 6vw, 5rem) 0;
          }

          .comm-grid {
            grid-template-columns: 1fr 1.5fr;
            gap: clamp(2rem, 4vw, 4rem);
          }

          .comm-deco-col {
            /* Show but keep compact */
            display: flex;
            min-height: clamp(160px, 22vw, 300px);
          }

          .comm-heading {
            font-size: clamp(2.5rem, 4.5vw, 4.5rem);
          }
        }

        /* ─── NEST HUB / SMALL ANDROID LANDSCAPE ────────────────── */
        /* ~1024×600 — right at our landscape boundary */
        @media (min-width: 900px) and (max-width: 1100px) and (max-height: 680px) {
          .comm-deco-col {
            min-height: 160px;
          }

          .comm-heading {
            font-size: clamp(2.2rem, 4vw, 3.5rem);
          }

          .comm-stats {
            margin-top: 1.25rem;
            padding-top: 1.25rem;
          }
        }
      `}</style>

      <section className="comm-section">
        {/* Decorative background — right side */}
        <div aria-hidden className="comm-deco-bg">
          <svg className="comm-deco-svg" viewBox="0 0 200 200" fill="none">
            <path
              d="M40 160 C40 120, 80 100, 80 60 C80 20, 40 0, 40 0"
              stroke="#e8d5a3"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M80 160 C80 120, 120 100, 120 60 C120 20, 80 0, 80 0"
              stroke="#e8d5a3"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M120 160 C120 120, 160 100, 160 60 C160 20, 120 0, 120 0"
              stroke="#e8d5a3"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <div className="comm-deco-card-1" />
          <div className="comm-deco-card-2" />
        </div>

        <div className="comm-inner">
          <div className="comm-grid">
            {/* Left col — decorative (reordered to after content on mobile) */}
            <div className="comm-deco-col" aria-hidden>
              <span className="comm-join-text">JOIN</span>
              <div className="comm-icon-cluster">
                <div className="comm-icon-ring">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="comm-icon-dots">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: "clamp(26px, 3.2vw, 44px)",
                        height: "clamp(26px, 3.2vw, 44px)",
                        borderRadius: "50%",
                        backgroundColor:
                          i === 1
                            ? "rgba(212,168,67,0.15)"
                            : "rgba(232,213,163,0.07)",
                        border: `1px solid ${i === 1 ? "rgba(212,168,67,0.3)" : "rgba(232,213,163,0.1)"}`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right col — text content */}
            <div className="comm-text-col">
              <span className="comm-eyebrow">
                <span className="comm-eyebrow-line" />
                Connect With Us
              </span>

              <h2 className="comm-heading">
                3RD SPACE
                <br />
                <span style={{ fontStyle: "italic", color: "#d4a843" }}>
                  COMMUNITY
                </span>
              </h2>

              <p className="comm-body-primary">
                More than a café — it&apos;s a place where creatives,
                entrepreneurs, and wanderers find their people.
              </p>
              <p className="comm-body-secondary">
                Join events, get early access to vouchers, and be part of
                something that feels like home.
              </p>

              <Link
                href="https://m.me/cm/AbaNlABBaredyAjJ/?send_source=cm:direct_invite_group"
                target="_blank"
                rel="noopener noreferrer"
                className="comm-cta"
              >
                JOIN NOW
                <svg
                  style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>

              {/* Stats */}
              <div className="comm-stats">
                {stats.map((s) => (
                  <div key={s.label}>
                    <p className="comm-stat-num">{s.num}</p>
                    <p className="comm-stat-label">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
