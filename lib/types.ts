export type SequenceKey = "kickstarter" | "repairkit";
export type VariantKey = "A" | "B";

export interface CurriculumItem {
  label: string; // e.g. "DAY 1" or "MISTAKE #1"
  title: string;
  desc: string;
}

export interface Stat {
  value: string;
  label: string;
}

/** All editable copy for one landing-page variant. */
export interface VariantContent {
  // Hero
  bookTitle: string;
  bookSubtitle: string;
  /** Book cover image shown in the authors section (path under /public). */
  bookImage: string;
  bookImageAlt: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaButton: string;
  emailPlaceholder: string;
  createdBy: string;
  /** Social-proof line under the hero form. */
  heroSocialProof: string;

  // Authors section (part 2)
  authorsHeadline: string;
  authorsBullets: string[];

  // Stats band
  statsHeadline: string;
  stats: Stat[];
  statsCtaHeadline: string;
  statsCtaSubhead: string;

  // Curriculum (checklist) section
  curriculumEyebrow: string;
  curriculumHeadline: string;
  /** Intro line above the curriculum checklist. */
  curriculumIntro: string;
  curriculum: CurriculumItem[];

  // Final CTA
  finalCtaHeadline: string;

  // Thank-you / success
  successHeadline: string;
  successBody: string;
}

export interface Variant {
  key: VariantKey;
  /** Internal display name for the admin. */
  name: string;
  /** Resend sequence this variant enrolls signups into. */
  sequence: SequenceKey;
  /** Short name used in the lead tag, e.g. KICKSTARTER / REPAIRKIT. */
  eecName: string;
  /** Version label used in the lead tag, e.g. v4 / v3. */
  versionLabel: string;
  /** Whether this variant participates in traffic. */
  enabled: boolean;
  /** Relative traffic weight among enabled variants. */
  weight: number;
  content: VariantContent;
}

export interface ABConfig {
  variants: Record<VariantKey, Variant>;
  updatedAt: string;
}
