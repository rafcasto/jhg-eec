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
  heroTitle: string;
  heroSubtitle: string;
  ctaButton: string;
  emailPlaceholder: string;
  createdBy: string;

  // Stats band
  statsHeadline: string;
  stats: Stat[];
  statsCtaHeadline: string;
  statsCtaSubhead: string;

  // Curriculum (dark) section
  curriculumEyebrow: string;
  curriculumHeadline: string;
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
