import { useState, useEffect } from 'react';
import { cdnImage, cdnUrl, cdnSrcSet, imageSignerEvents } from './imageUtils';

interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'scale-down' | 'crop' | 'pad';
  format?: 'auto' | 'avif' | 'webp' | 'json';
}

/**
 * A React hook that returns a Cloudflare transformed image URL.
 * If the URL requires cryptographic signing, it initially returns the unsigned
 * (or previously cached) URL, so React can render immediately.
 *
 * It listens to the `imageSignerEvents` and automatically triggers a
 * re-render with the fully signed URL once the background crypto worker finishes.
 */
export function useSignedImage(
  url: string | undefined | null,
  opts: TransformOptions = {},
) {
  // Compute the initial URL (might be unsigned if preSignUrls is still running)
  const [signedUrl, setSignedUrl] = useState(() =>
    url ? cdnImage(url, opts) : '',
  );

  // stringify object safely to avoid infinite re-renders while satisfying hooks rules
  const optsString = JSON.stringify(opts);

  useEffect(() => {
    if (!url) {
      setSignedUrl('');
      return;
    }

    // Always ensure we have the latest synchronously available version on mount/url change
    // We parse the string back strictly inside the effect
    const currentOpts = JSON.parse(optsString);
    setSignedUrl(cdnImage(url, currentOpts));

    // The event detail contains the raw object path (e.g. 'illustrations/abc.webp')
    const handleUrlSigned = ((e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const signedPath = customEvent.detail;

      // Check if the newly signed path belongs to our requested URL
      if (url.includes(signedPath)) {
        // Re-calculate the cdnImage which will now pick up the signature from the store
        setSignedUrl(cdnImage(url, currentOpts));
      }
    }) as EventListener;

    imageSignerEvents.addEventListener('url_signed', handleUrlSigned);

    return () => {
      imageSignerEvents.removeEventListener('url_signed', handleUrlSigned);
    };
  }, [url, optsString]);

  return signedUrl;
}

/**
 * A React hook that returns a Cloudflare transformed image srcSet string.
 */
export function useSignedSrcSet(
  url: string | undefined | null,
  widths: number[],
) {
  const [srcSet, setSrcSet] = useState(() =>
    url ? cdnSrcSet(url, widths) : '',
  );
  const widthsString = widths.join(',');

  useEffect(() => {
    if (!url) {
      setSrcSet('');
      return;
    }

    const currentWidths = widthsString.split(',').map(Number);
    setSrcSet(cdnSrcSet(url, currentWidths));

    const handleUrlSigned = ((e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const signedPath = customEvent.detail;

      if (url.includes(signedPath)) {
        setSrcSet(cdnSrcSet(url, currentWidths));
      }
    }) as EventListener;

    imageSignerEvents.addEventListener('url_signed', handleUrlSigned);

    return () => {
      imageSignerEvents.removeEventListener('url_signed', handleUrlSigned);
    };
  }, [url, widthsString]);

  return srcSet;
}

/**
 * A React hook that returns a raw Cloudflare CDN URL (no image transformation applied).
 * Safely awaits Cryptography worker signatures.
 */
export function useRawSignedImage(url: string | undefined | null) {
  const [signedUrl, setSignedUrl] = useState(() => (url ? cdnUrl(url) : ''));

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignedUrl('');
      return;
    }

    setSignedUrl(cdnUrl(url));

    const handleUrlSigned = ((e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const signedPath = customEvent.detail;

      if (url.includes(signedPath)) {
        setSignedUrl(cdnUrl(url));
      }
    }) as EventListener;

    imageSignerEvents.addEventListener('url_signed', handleUrlSigned);

    return () => {
      imageSignerEvents.removeEventListener('url_signed', handleUrlSigned);
    };
  }, [url]);

  return signedUrl;
}
