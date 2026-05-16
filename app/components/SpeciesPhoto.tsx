'use client';

import { useEffect, useRef, useState } from 'react';
import TaxaIcon from './TaxaIcon';
import { useSpeciesImageUrl } from './SpeciesImageCacheProvider';
import { getCachedSpeciesImage, loadSpeciesImageCache } from '../lib/speciesImageCache';

const memoryCache = new Map<string, string | null>();

async function fetchImageUrlFromApi(
  uid: string,
  scientific: string,
  common?: string
): Promise<string | null> {
  if (memoryCache.has(uid)) return memoryCache.get(uid) ?? null;

  const params = new URLSearchParams({ scientific });
  if (common?.trim()) params.set('common', common.trim());

  try {
    const res = await fetch(`/api/species-image?${params}`);
    const data = await res.json();
    const url = data?.url ?? null;
    memoryCache.set(uid, url);
    return url;
  } catch {
    memoryCache.set(uid, null);
    return null;
  }
}

type SpeciesPhotoProps = {
  uid: string;
  scientificName: string;
  commonName?: string;
  taxa: string;
  alt: string;
  /** Pre-resolved URL from parent (fastest path on Species Explorer grid). */
  imageUrl?: string | null;
  height?: number | string;
  objectFit?: 'cover' | 'contain';
  showPlaceholderIcon?: boolean;
  priority?: boolean;
};

export default function SpeciesPhoto({
  uid,
  scientificName,
  commonName,
  taxa,
  alt,
  imageUrl: imageUrlProp,
  height = 160,
  objectFit = 'cover',
  showPlaceholderIcon = true,
  priority = false,
}: SpeciesPhotoProps) {
  const cachedFromContext = useSpeciesImageUrl(uid);
  const resolvedCacheUrl = imageUrlProp !== undefined ? imageUrlProp : cachedFromContext;

  const hasCachedUrl = typeof resolvedCacheUrl === 'string' && resolvedCacheUrl.length > 0;
  const cacheSaysMissing = resolvedCacheUrl === null;

  const [src, setSrc] = useState<string | null>(() =>
    hasCachedUrl ? (resolvedCacheUrl as string) : null
  );
  const [loading, setLoading] = useState(false);
  const [knownMissing, setKnownMissing] = useState(cacheSaysMissing);

  const [inView, setInView] = useState(priority || hasCachedUrl);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasCachedUrl) {
      setSrc(resolvedCacheUrl as string);
      setKnownMissing(false);
      return;
    }
    if (cacheSaysMissing) {
      setSrc(null);
      setKnownMissing(true);
    }
  }, [hasCachedUrl, cacheSaysMissing, resolvedCacheUrl]);

  useEffect(() => {
    if (priority || inView || hasCachedUrl) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, inView, hasCachedUrl]);

  useEffect(() => {
    if (hasCachedUrl || cacheSaysMissing) return;
    if (!inView || !scientificName?.trim()) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      let url: string | null = null;

      if (memoryCache.has(uid)) {
        url = memoryCache.get(uid) ?? null;
      } else {
        const fileCache = await loadSpeciesImageCache();
        const entry = getCachedSpeciesImage(fileCache, uid);
        if (entry !== undefined) {
          url = entry?.url ?? null;
          memoryCache.set(uid, url);
        } else {
          url = await fetchImageUrlFromApi(uid, scientificName, commonName);
        }
      }

      if (!cancelled) {
        setSrc(url);
        setKnownMissing(url === null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [inView, uid, scientificName, commonName, hasCachedUrl, cacheSaysMissing]);

  const showPlaceholder = !src && showPlaceholderIcon && (knownMissing || cacheSaysMissing || !loading);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'var(--species-photo-bg, linear-gradient(135deg, #e8f5e9, #c8e6c9))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit,
            objectPosition: 'center',
          }}
          onError={() => {
            setSrc(null);
            setKnownMissing(true);
          }}
        />
      ) : showPlaceholder ? (
        <TaxaIcon
          taxa={taxa}
          size={typeof height === 'number' ? Math.min(64, height * 0.4) : 64}
          opacity={loading ? 0.35 : 0.55}
        />
      ) : null}
    </div>
  );
}

