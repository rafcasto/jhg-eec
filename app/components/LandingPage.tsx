import type { Variant } from "@/lib/types";
import SignupForm from "./SignupForm";

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
    successHeadline: c.successHeadline,
    successBody: c.successBody,
  };

  return (
    <main className="eec-page">
      {/* HERO */}
      <section className="eec-hero">
        <div className="eec-hero__inner">
          <h1>{c.heroTitle}</h1>

          <div className="book" aria-hidden="true">
            <img className="book__hand" src="/assets/logo-hand.png" alt="" />
            <div className="book__title">{c.bookTitle}</div>
            <div className="book__sub">{c.bookSubtitle}</div>
            <div className="book__brand">Job Hackers Global</div>
          </div>

          <p className="eec-hero__sub">{c.heroSubtitle}</p>

          <SignupForm {...formProps} formId="hero" />

          <p className="eec-hero__created">{c.createdBy}</p>
        </div>
      </section>

      {/* STATS BAND */}
      <section className="eec-stats">
        <div className="eec-stats__inner">
          <p className="eec-stats__headline">{c.statsHeadline}</p>

          <div className="eec-stats__grid">
            {c.stats.map((s, i) => (
              <div className="stat-card" key={i}>
                <div className="stat-card__value">{s.value}</div>
                <div className="stat-card__label">{s.label}</div>
              </div>
            ))}
          </div>

          <h2 className="eec-stats__cta-head">{c.statsCtaHeadline}</h2>
          <p className="eec-stats__cta-sub">{c.statsCtaSubhead}</p>
          <SignupForm {...formProps} formId="stats" />
        </div>
      </section>

      {/* CURRICULUM (dark) */}
      <section className="eec-curric">
        <div className="eec-curric__inner">
          <div className="eec-curric__eyebrow">{c.curriculumEyebrow}</div>
          <h2 className="eec-curric__headline">{c.curriculumHeadline}</h2>
          <div>
            {c.curriculum.map((item, i) => (
              <div className="curric-item" key={i}>
                <div className="curric-item__label">{item.label}</div>
                <h3 className="curric-item__title">{item.title}</h3>
                <p className="curric-item__desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="eec-final">
        <h2>{c.finalCtaHeadline}</h2>
        <SignupForm {...formProps} formId="final" />
      </section>

      {/* FOOTER */}
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
