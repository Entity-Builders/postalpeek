import { useState, useEffect } from 'react';

/**
 * Reliable image-loaded detection using `new Image()`.
 * Handles both browser cache hits (`img.complete`) and cold loads.
 */
function useImageLoaded(src: string): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    if (img.complete) { setLoaded(true); return; }
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    return () => { img.onload = null; img.onerror = null; };
  }, [src]);

  return loaded;
}

/* ─── Shared easing ─── */
const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Sway loops for back postcards ─── */
const sway = {
  /** Card 3 (back): slow 6s breathing cycle */
  back: {
    animate: { rotate: [7, 9, 6, 7], x: [12, 14, 10, 12], y: [-4, -2, -6, -4] },
    transition: { duration: 6, ease: 'easeInOut' as const, repeat: Infinity },
  },
  /** Card 2 (middle): slightly faster 5s cycle (desynchronized) */
  middle: {
    animate: { rotate: [-5, -3, -7, -5], x: [-12, -10, -14, -12], y: [4, 6, 2, 4] },
    transition: { duration: 5, ease: 'easeInOut' as const, repeat: Infinity },
  },
};

/**
 * Cinematic welcome animation timeline.
 *
 * TIMELINE (seconds):
 *
 *   0.0s  "Entity Builders presents" — fade in immediately
 *   0.4s  "Kyle Walker" — dramatic entrance
 *   0.9s  Subtitle
 *   1.4s  Body paragraph
 *   2.0s  Divider line
 *   2.4s  "These postcards are for you."
 *   3.0s  Scroll hint
 *   ---   Postcards: drop from above when hero image loads (independent)
 */
export function useWelcomeAnimation(heroImageUrl: string) {
  const heroLoaded = useImageLoaded(heroImageUrl);

  return {
    heroLoaded,
    sway,

    /* ─── Postcard stack: drops from above the screen ─── */
    postcards: {
      initial: { opacity: 0, y: -200, scale: 1.1 },
      animate: heroLoaded
        ? { opacity: 0.9, y: 0, scale: 1 }
        : { opacity: 0, y: -200, scale: 1.1 },
      transition: { duration: 1.2, ease, delay: 0.2 },
    },

    /* ─── Text elements: start from second 0, no waiting ─── */
    presents: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.8, ease, delay: 0 },
    },
    title: {
      initial: { opacity: 0, y: 16, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.9, ease, delay: 0.4 },
    },
    subtitle: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.7, ease, delay: 0.9 },
    },
    body: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.8, ease, delay: 1.4 },
    },
    divider: {
      initial: { opacity: 0, scaleX: 0 },
      animate: { opacity: 1, scaleX: 1 },
      transition: { duration: 0.6, ease, delay: 2.0 },
    },
    tagline: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.8, ease, delay: 2.4 },
    },
    scrollHint: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { delay: 3.0, duration: 0.8 },
    },
  };
}
