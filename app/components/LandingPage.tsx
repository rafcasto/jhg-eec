import type { Variant } from "@/lib/types";
import SignupForm from "./SignupForm";
import BookCover from "./BookCover";

function Check() {
  return (
    <span className="chk" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function LandingPage({
  variant,
  showBadge,
}: {
  variant: Variant;
  showBadge?: boolean;
}) {
  const c = variant.content;
  const formProps = {
    variant: variant.key,
    ctaButton: c.ctaButton,
    emailPlaceholder: c.emailPlaceholder,
  };

  return (
    <main className="eec-page">
      {/* ============ PART 1 — HERO ============ */}
      <section className="eec-hero">
        <div className="eec-hero__inner">
          {c.heroEyebrow && (
            <div className="eec-hero__eyebrow">{c.heroEyebrow}</div>
          )}
          <h1>{c.heroTitle}</h1>
          <p className="eec-hero__sub">{c.heroSubtitle}</p>

          <SignupForm {...formProps} formId="hero" />

          <p className="eec-hero__proof">{c.heroSocialProof}</p>
        </div>
      </section>

      {/* ============ PART 2 — AUTHORS + BOOK ============ */}
      <section className="eec-authors">
        <div className="eec-authors__inner">
          <div className="eec-authors__copy">
            <h2>{c.authorsHeadline}</h2>

            <ul className="eec-authors__list">
              {c.authorsBullets.map((b, i) => (
                <li key={i}>
                  <Check />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="eec-authors__stats">
              {c.stats.map((s, i) => (
                <div className="stat-chip" key={i}>
                  <span className="stat-chip__value">{s.value}</span>
                  <span className="stat-chip__label">{s.label}</span>
                </div>
              ))}
            </div>

            <SignupForm {...formProps} formId="authors" />
          </div>

          <div className="eec-authors__book">
            <div className="book-frame">
              <BookCover src={c.bookImage} alt={c.bookImageAlt} />
            </div>
            <p className="eec-authors__created">{c.createdBy}</p>
          </div>
        </div>
      </section>

      {/* ============ PART 3 — CURRICULUM CHECKLIST ============ */}
      <section className="eec-curric">
        <div className="eec-curric__inner">
          <div className="eec-curric__eyebrow">{c.curriculumEyebrow}</div>
          <h2 className="eec-curric__headline">{c.curriculumHeadline}</h2>
          <p className="eec-curric__intro">{c.curriculumIntro}</p>

          <ul className="eec-curric__list">
            {c.curriculum.map((item, i) => (
              <li className="curric-item" key={i}>
                <Check />
                <span className="curric-item__text">
                  <b className="curric-item__label">{item.label}.</b>{" "}
                  <b className="curric-item__title">{item.title}</b>
                  <span className="curric-item__desc"> — {item.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <h3 className="eec-curric__cta-head">{c.finalCtaHeadline}</h3>
          <div className="eec-curric__form">
            <SignupForm {...formProps} formId="final" />
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="eec-footer">
        <div>
          <img src="/assets/logo-jobhackers.png" alt="Job Hackers Global" />
        </div>
        <div>
          © {new Date().getFullYear()} Job Hackers Global. All rights reserved.
        </div>
      </footer>

      {showBadge && (
        <div className="variant-badge">
          variant {variant.key} · {variant.sequence}
        </div>
      )}
    </main>
  );
}
