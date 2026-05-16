export type SpeciesImageEntry = { url: string; source: 'wikipedia' | 'inaturalist' } | null;

export type SpeciesImageCacheFile = {
  generatedAt: string | null;
  stats?: { total: number; withImage: number; missing: number };
  images: Record<string, SpeciesImageEntry>;
};

let loadPromise: Promise<SpeciesImageCacheFile | null> | null = null;
let cached: SpeciesImageCacheFile | null = null;

export function loadSpeciesImageCache(): Promise<SpeciesImageCacheFile | null> {
  if (cached) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/data/species/image-urls.json', { cache: 'force-cache' })
    .then(res => {
      if (!res.ok) return null;
      return res.json() as Promise<SpeciesImageCacheFile>;
    })
    .then(data => {
      cached = data;
      return data;
    })
    .catch(() => null);

  return loadPromise;
}

export function getCachedSpeciesImage(
  cache: SpeciesImageCacheFile | null,
  uid: string
): SpeciesImageEntry | undefined {
  if (!cache?.images) return undefined;
  return cache.images[uid];
}
