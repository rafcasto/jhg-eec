"use client";

import { useState } from "react";

/** Swap a raster path (.png/.jpg/.webp) to the matching .svg fallback. */
function deriveFallback(src: string): string {
  if (/\.(png|jpe?g|webp)$/i.test(src)) {
    return src.replace(/\.(png|jpe?g|webp)$/i, ".svg");
  }
  return "/assets/book-cover.svg";
}

/**
 * Renders the book cover image. If the primary source fails to load (e.g. a
 * real PNG hasn't been added yet), it automatically falls back to the matching
 * SVG so the page never shows a broken image.
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
