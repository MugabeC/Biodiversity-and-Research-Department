export type SpeciesImageEntry = {
  url: string;
  source: 'inaturalist' | 'wikipedia' | 'iucn';
} | null;

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

  loadPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch('/data/species/image-urls.json', {
        cache: 'force-cache',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const data = (await res.json()) as SpeciesImageCacheFile;
      cached = data;
      return data;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}

export function getCachedSpeciesImage(
  cache: SpeciesImageCacheFile | null,
  uid: string
): SpeciesImageEntry | undefined {
  if (!cache?.images) return undefined;
  return cache.images[uid];
}
