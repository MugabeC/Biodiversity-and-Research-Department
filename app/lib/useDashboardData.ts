'use client';

import { useEffect, useState } from 'react';
import { fetchLiveDashboardFiles, loadDashboardFromBundle, type LoadedDashboard } from '@/app/lib/dashboardData';

/**
 * Dashboard data. The files that ship with the site load at once; if a newer set has been published from the
 * Update page, it replaces them a moment later.
 */
export function useDashboardData(): { data: LoadedDashboard | null; error: string | null; source: 'bundled' | 'published'; publishedAt: string | null } {
  const [state, setState] = useState<{ data: LoadedDashboard | null; error: string | null; source: 'bundled' | 'published'; publishedAt: string | null }>({
    data: null, error: null, source: 'bundled', publishedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    try {
      setState({ data: loadDashboardFromBundle(), error: null, source: 'bundled', publishedAt: null });
    } catch {
      setState({ data: null, error: 'Could not load dashboard data. Refresh the page, or contact the Biodiversity and Research Department.', source: 'bundled', publishedAt: null });
      return;
    }
    fetchLiveDashboardFiles().then(live => {
      if (cancelled || !live) return;
      try {
        setState({ data: loadDashboardFromBundle(live.files), error: null, source: 'published', publishedAt: live.createdAt });
      } catch {
        /* keep the bundled data if the published set cannot be read */
      }
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}
