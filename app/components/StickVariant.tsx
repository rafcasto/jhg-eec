"use client";

import { useEffect } from "react";

/**
 * Persists the server-assigned A/B variant into a cookie so the visitor sees
 * the same version on every subsequent visit. The variant is decided
 * server-side and rendered into the page; this only makes it sticky.
 */
export default function StickVariant({ variant }: { variant: "A" | "B" }) {
  useEffect(() => {
    const maxAge = 60 * 60 * 24 * 90; // 90 days
    document.cookie = `jhg_eec_variant=${variant}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [variant]);
  return null;
}
