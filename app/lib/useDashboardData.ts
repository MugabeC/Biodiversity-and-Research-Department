'use client';

import { useEffect, useState } from 'react';
import { fetchLiveDashboardFiles, loadDashboardFromBundle, type LoadedDashboard } from '@/app/lib/dashboardData';
import { fetchEntries } from '@/app/lib/entries';

type State = { data: LoadedDashboard | null; error: string | null; source: 'bundled' | 'published'; publishedAt: string | null };

/**
 * Dashboard data. The files that ship with the site load at once. A moment later the newest published workbook set (if
 * there is one) and the entries saved from the staff forms are added, and the dashboard updates itself.
 */
export function useDashboardData(): State {
  const [state, setState] = useState<State>({ data: null, error: null, source: 'bundled', publishedAt: null });

  useEffect(() => {
    let cancelled = false;
    try {
      setState({ data: loadDashboardFromBundle(), error: null, source: 'bundled', publishedAt: null });
    } catch {
      setState({ data: null, error: 'Could not load dashboard data. Refresh the page, or contact the Biodiversity and Research Department.', source: 'bundled', publishedAt: null });
      return;
    }
    Promise.all([fetchLiveDashboardFiles(), fetchEntries().catch(() => [])]).then(([live, entries]) => {
      if (cancelled || (!live && entries.length === 0)) return;
      try {
        setState({ data: loadDashboardFromBundle(live?.files, entries), error: null, source: live ? 'published' : 'bundled', publishedAt: live?.createdAt ?? null });
      } catch {
        /* keep the bundled data if the combined set cannot be read */
      }
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}
