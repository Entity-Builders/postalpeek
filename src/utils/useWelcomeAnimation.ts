import { useState, useEffect } from 'react';

/**
 * Reliable image-loaded detection using `new Image()`.
 * Handles both browser cache hits (`img.complete`) and cold loads.
 */
function useImageLoaded(src: string): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) { setLoaded(false); return; }
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
 * Returns a step-by-step animation config keyed by element name.
 * Each step is { initial, animate, transition } ready to spread on a motion element.
 *
 * The timeline (in seconds):
 *
 *   0.2s  "Entity Builders presents"
 *   0.7s  "Kyle Walker"
 *   1.2s  Subtitle
 *   1.8s  Body paragraph
 *   2.4s  Divider line
 *   2.8s  "These postcards are for you."
 *   3.4s  Scroll hint
 *   ---   Postcards: appear when hero image loads (independent)
 */
export function useWelcomeAnimation(heroImageUrl: string) {
  const heroLoaded = useImageLoaded(heroImageUrl);

  return {
    heroLoaded,
    sway,

    /* ─── Postcard stack entrance ─── */
    postcards: {
      initial: { opacity: 0, scale: 2.8, y: 60 },
      animate: heroLoaded
        ? { opacity: 0.85, scale: 1, y: 0 }
        : { opacity: 0, scale: 2.8, y: 60 },
      transition: { duration: 1.4, ease, delay: 0.1 },
    },

    /* ─── Text elements (always animate from second 0) ─── */
    presents: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.7, ease, delay: 0.2 },
    },
    title: {
      initial: { opacity: 0, y: 16, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.9, ease, delay: 0.7 },
    },
    subtitle: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.7, ease, delay: 1.2 },
    },
    body: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.8, ease, delay: 1.8 },
    },
    divider: {
      initial: { opacity: 0, scaleX: 0 },
      animate: { opacity: 1, scaleX: 1 },
      transition: { duration: 0.6, ease, delay: 2.4 },
    },
    tagline: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.8, ease, delay: 2.8 },
    },
    scrollHint: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { delay: 3.4, duration: 0.8 },
    },
  };
}
