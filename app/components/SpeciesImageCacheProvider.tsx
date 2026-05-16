'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCachedSpeciesImage,
  loadSpeciesImageCache,
  type SpeciesImageCacheFile,
} from '../lib/speciesImageCache';

type SpeciesImageCacheContextValue = {
  ready: boolean;
  getUrl: (uid: string) => string | null | undefined;
};

const SpeciesImageCacheContext = createContext<SpeciesImageCacheContextValue>({
  ready: false,
  getUrl: () => undefined,
});

export function useSpeciesImageUrl(uid: string): string | null | undefined {
  const { ready, getUrl } = useContext(SpeciesImageCacheContext);
  if (!ready) return undefined;
  return getUrl(uid);
}

export default function SpeciesImageCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<SpeciesImageCacheFile | null>(null);

  useEffect(() => {
    loadSpeciesImageCache().then(setCache);
  }, []);

  const value = useMemo<SpeciesImageCacheContextValue>(() => ({
    ready: cache !== null,
    getUrl: (uid: string) => {
      if (!cache) return undefined;
      const entry = getCachedSpeciesImage(cache, uid);
      if (entry === undefined) return undefined;
      return entry?.url ?? null;
    },
  }), [cache]);

  return (
    <SpeciesImageCacheContext.Provider value={value}>
      {children}
    </SpeciesImageCacheContext.Provider>
  );
}
