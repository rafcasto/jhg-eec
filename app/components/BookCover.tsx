"use client";

import { useState } from "react";

/** Pick a safe fallback for a cover source. */
function deriveFallback(src: string): string {
  // Absolute URLs (e.g. Supabase Storage) — fall back to the bundled SVG.
  if (/^https?:\/\//i.test(src)) return "/assets/book-cover.svg";
  // Local raster path — try the matching .svg next to it.
  if (/\.(png|jpe?g|webp)$/i.test(src)) {
    return src.replace(/\.(png|jpe?g|webp)$/i, ".svg");
  }
  return "/assets/book-cover.svg";
}

/**
 * Renders the book cover image. If the primary source fails to load, it
 * automatically falls back to a bundled SVG so the page never shows a broken
 * image.
 */
export default function BookCover({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback?: string;
}) {
  const fb = fallback ?? deriveFallback(src);
  const [current, setCurrent] = useState(src);

  return (
    <img
      src={current}
      alt={alt}
      onError={() => {
        if (current !== fb) setCurrent(fb);
      }}
    />
  );
}
