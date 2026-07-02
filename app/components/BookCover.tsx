"use client";

import { useState } from "react";

/**
 * Renders the book cover image. Uses the primary source (the real PNG) and
 * automatically falls back to the SVG recreation if the PNG isn't present yet,
 * so the page never shows a broken image.
 */
export default function BookCover({
  src,
  alt,
  fallback = "/assets/book-cover.svg",
}: {
  src: string;
  alt: string;
  fallback?: string;
}) {
  const [current, setCurrent] = useState(src);

  return (
    <img
      src={current}
      alt={alt}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
