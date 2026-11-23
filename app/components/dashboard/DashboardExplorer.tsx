'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
  ComposedChart, ReferenceLine, Line, LabelList,
} from 'recharts';
import TaxaIcon from '../TaxaIcon';
import {
  flattenBiodiversityExplore,
  flattenWasacExplore,
  filterWaterExploreRows,
} from '@/app/lib/exploreWaterQuality';
import {
  type LoadedDashboard,
  type CommunityRow,
  type DashboardSummary,
  type ConflictRow,
  type PassesData,
  type ResearchRow,
  type SchoolVisitsData,
  type WasteFile,
} from '@/app/lib/dashboardData';
import {
  TAXA_META,
  monthSortKey,
  sortByMonth,
  withShortMonths,
  aggregateStudentsByQuarter,
} from '@/app/lib/dashboardUtils';
import { useChartColors } from './chartTheme';
import { useDashboardData } from '@/app/lib/useDashboardData';
import { normalizeWasteData } from './WasteDashboardCharts';
import { SURVIVAL_TARGET } from '@/app/lib/restoration';
import { CountUp, Sparkline, Ring, SegmentBar, GRADIENT_DEFS, SlickTooltip, StatRow, GrowthRows, Waffle, RankRows } from './minimal';

const BiodiversityWaterCompliance = dynamic(() => import('./BiodiversityWaterCompliance'), { ssr: false });
const BiodiversityWaterExplorer = dynamic(() => import('./BiodiversityWaterExplorer'), { ssr: false });
const WasacWaterPanel = dynamic(() => import('./WasacWaterPanel'), { ssr: false });
const WasteDashboardCharts = dynamic(() => import('./WasteDashboardCharts'), { ssr: false });

type Summary = DashboardSummary;
type SchoolVisits = SchoolVisitsData;

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'biodiversity', label: 'Biodiversity' },
  { id: 'education', label: 'Education' },
  { id: 'community', label: 'Community' },
  { id: 'research', label: 'Research' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'waste', label: 'Waste' },
  { id: 'water', label: 'Water quality' },
  { id: 'restoration', label: 'Restoration' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row)?.trim() || 'Unspecified';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function researchMonthLabel(label: string): string {
  const trimmed = label.trim();
  if (/\b20\d{2}\b/.test(trimmed)) return trimmed;
  const twoDigitYear = trimmed.match(/^(.+?)\s+(\d{2})$/);
  if (twoDigitYear) return `${twoDigitYear[1]} 20${twoDigitYear[2]}`;
  return `${trimmed} 2025`;
}

function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="dash-sec-head">
      <h2>{children}</h2>
      {note && <p>{note}</p>}
    </div>
  );
}

function peakOf<T extends { month: string }>(rows: T[], pick: (r: T) => number): { month: string; value: number } | null {
  let best: { month: string; value: number } | null = null;
  for (const r of rows) {
    const v = pick(r);
    if (!best || v > best.value) best = { month: r.month, value: v };
  }
  return best;
}

function Tile({
  title, value, unit, viz, note, onOpen, delay,
}: {
  title: string; value: React.ReactNode; unit: string; viz: React.ReactNode; note: React.ReactNode;
  onOpen: () => void; delay: number;
}) {
  return (
    <button type="button" className="dash-tile" onClick={onOpen} style={{ animationDelay: `${delay}ms` }}>
      <span className="dash-tile-title">{title}<i aria-hidden>→</i></span>
      <span className="dash-tile-value">{value}</span>
      <span className="dash-tile-unit">{unit}</span>
      <span className="dash-tile-viz">{viz}</span>
      <span className="dash-tile-note">{note}</span>
    </button>
  );
}

function ExploreResultCell({ result }: { result: string }) {
  const normalized = result.trim().toUpperCase();
  const variant =
    normalized === 'PASS' ? 'pass' : normalized === 'FAIL' ? 'fail' : 'neutral';
  return (
    <td className={`data-table-result data-table-result--${variant}`}>
      <span className={`data-table-result-label data-table-result-label--${variant}`}>
        {result}
      </span>
    </td>
  );
}

function ChartCard({
  title,
  description,
  children,
  tall,
  content,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tall?: boolean;
  content?: boolean;
}) {
  return (
    <div className="chart-card chart-plain">
      <h3 className="dash-chart-title">{title}</h3>
      {description && <p className="chart-card-desc">{description}</p>}
      {content ? (
        <div className="chart-card-body">{children}</div>
      ) : (
        <div className={`chart-card-inner${tall ? ' chart-card-inner--tall' : ''}`}>{children}</div>
      )}
    </div>
  );
}

export default function DashboardExplorer() {
  const [section, setSection] = useState<SectionId>('overview');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [schools, setSchools] = useState<SchoolVisits | null>(null);
  const [community, setCommunity] = useState<CommunityRow[]>([]);
  const [passes, setPasses] = useState<PassesData | null>(null);
  const [wasteData, setWasteData] = useState<WasteFile>([]);
  const [research, setResearch] = useState<ResearchRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [internships, setInternships] = useState<LoadedDashboard['internships']>([]);
  const [pipeline, setPipeline] = useState<LoadedDashboard['internshipPipeline'] | null>(null);
  const waste = useMemo(() => normalizeWasteData(wasteData), [wasteData]);
  const [bioWater, setBioWater] = useState<LoadedDashboard['bioWater']>(null);
  const [wasacParams, setWasacParams] = useState<LoadedDashboard['wasacParams']>([]);
  const [wasacSiteLabels, setWasacSiteLabels] = useState<string[]>([]);
  const [exploreTab, setExploreTab] = useState('schools');
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const c = useChartColors();
  useEffect(() => { setSearch(''); }, [section]);
  const studentTarget = summary?.studentTargetPerQuarter ?? 500;

  const { data: loaded, error: dataError } = useDashboardData();
  const waterTests = loaded?.waterTests ?? [];
  const waterOverall = loaded?.waterOverall ?? null;
  const restoration = loaded?.restoration ?? null;
  useEffect(() => {
    if (dataError) { setLoadError(dataError); setLoading(false); return; }
    if (!loaded) return;
    setSummary(loaded.summary);
    setSchools(loaded.schools);
    setCommunity(loaded.community);
    setPasses(loaded.passes);
    setWasteData(loaded.waste);
    setResearch(loaded.research);
    setConflicts(loaded.conflicts);
    setInternships(loaded.internships);
    setPipeline(loaded.internshipPipeline);
    setBioWater(loaded.bioWater);
    setWasacParams(loaded.wasacParams);
    setWasacSiteLabels(loaded.wasacSiteLabels);
    setLoadError(null);
    setLoading(false);
  }, [loaded, dataError]);

  const taxaCards = useMemo(() => {
    if (!summary?.taxa) return [];
    return TAXA_META.map(({ key, iconLabel }) => {
      const t = summary.taxa[key];
      if (!t) return null;
      const growth = t.count2025 - t.count2023;
      const pct = t.count2023 > 0 ? Math.round((growth / t.count2023) * 100) : 0;
      return {
        taxa: iconLabel,
        count: t.count2025,
        badge: growth === 0 ? 'stable' : `▲ +${pct}%`,
        stable: growth === 0,
      };
    }).filter(Boolean) as { taxa: string; count: number; badge: string; stable: boolean }[];
  }, [summary]);

  const barBiodiversity = useMemo(() => {
    if (!summary?.taxa) return [];
    return TAXA_META.map(({ key, label }) => ({
      taxa: label.replace('Amphibians & Reptiles', 'Amph.&Rept.').replace('Aquatic Inverts', 'Aq. Inverts'),
      '2023': summary.taxa[key]?.count2023 ?? 0,
      '2025': summary.taxa[key]?.count2025 ?? 0,
    }));
  }, [summary]);

  const donutBiodiversity = useMemo(() => {
    if (!summary?.taxa) return [];
    return TAXA_META.map(({ key, label, color }) => ({
      taxa: label,
      count: summary.taxa[key]?.count2025 ?? 0,
      color,
    }));
  }, [summary]);

  const schoolMonthlyRows = useMemo(() => {
    if (!schools) return [];
    return sortByMonth(
      schools.monthlyTotals
        .filter(m => m.totalStudents != null)
        .map(m => ({ month: m.month, students: m.totalStudents as number }))
    );
  }, [schools]);

  const schoolQuarterly = useMemo(
    () => aggregateStudentsByQuarter(schoolMonthlyRows),
    [schoolMonthlyRows]
  );

  const communityByMonth = useMemo(() => {
    const map = new Map<string, { month: string; activities: number; participants: number }>();
    for (const row of community) {
      const cur = map.get(row.month) ?? { month: row.month, activities: 0, participants: 0 };
      cur.activities += 1;
      cur.participants += row.participants ?? 0;
      map.set(row.month, cur);
    }
    return withShortMonths(sortByMonth(Array.from(map.values())));
  }, [community]);

  const passesMonthly = useMemo(() => {
    if (!passes) return [];
    return withShortMonths(sortByMonth(passes.monthlyTotals));
  }, [passes]);

  const complementaryPassByGroup = useMemo(() => {
    if (!passes) return [];
    const map = new Map<string, number>();
    for (const d of passes.detail) {
      map.set(d.group, (map.get(d.group) ?? 0) + d.passes);
    }
    return Array.from(map.entries())
      .map(([group, count]) => ({ group, complementaryPasses: count }))
      .sort((a, b) => b.complementaryPasses - a.complementaryPasses);
  }, [passes]);

  const wasteMonthly = useMemo(() => {
    return withShortMonths(
      sortByMonth(
        waste.filter(w => w.kg != null).map(w => ({ month: w.month, kg: w.kg as number }))
      )
    );
  }, [waste]);

  const researchByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of research) {
      const month = researchMonthLabel(row.month);
      map.set(month, (map.get(month) ?? 0) + 1);
    }
    return withShortMonths(
      Array.from(map.entries())
        .map(([month, requests]) => ({ month, requests }))
        .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month))
    );
  }, [research]);

  const researchByAction = useMemo(
    () => countBy(research, row => row.status).slice(0, 8),
    [research]
  );

  const internshipByMonth = useMemo(
    () => withShortMonths(sortByMonth(internships.map(row => ({ ...row })))),
    [internships]
  );

  const conflictsByStatus = useMemo(() => countBy(conflicts, row => row.status), [conflicts]);
  const conflictsByType = useMemo(() => countBy(conflicts, row => row.issueType).slice(0, 8), [conflicts]);

  const kpis = useMemo(() => {
    const totalStudents = schoolMonthlyRows.reduce((s, m) => s + m.students, 0);
    const totalWaste = wasteMonthly.reduce((s, m) => s + m.kg, 0);
    return {
      species: summary?.totalSpecies ?? 870,
      students: totalStudents,
      activities: community.length,
      researchRequests: research.length,
      openConflicts: conflicts.filter(row => row.status?.toLowerCase() === 'open').length,
      waterCompliance: waterOverall != null ? `${waterOverall.rate}%` : '—',
      wasteKg: Math.round(totalWaste),
      visits: (() => {
        const groups = (schools?.monthlyTotals ?? []).reduce((s, m) => s + (m.schoolGroups ?? 0), 0);
        return groups > 0 ? groups : schools?.individualVisits?.length ?? 0;
      })(),
    };
  }, [summary, schoolMonthlyRows, wasteMonthly, community, schools, waterOverall, research, conflicts]);

  const filteredSchoolVisits = useMemo(() => {
    if (!schools) return [];
    if (!search.trim()) return schools.individualVisits.slice(0, 100);
    const q = search.toLowerCase();
    return schools.individualVisits.filter(
      v =>
        v.school?.toLowerCase().includes(q) ||
        v.month?.toLowerCase().includes(q) ||
        v.programme?.toLowerCase().includes(q) ||
        v.notes?.toLowerCase().includes(q)
    );
  }, [schools, search]);

  const filteredCommunity = useMemo(() => {
    if (!search.trim()) return community;
    const q = search.toLowerCase();
    return community.filter(
      v =>
        v.activity.toLowerCase().includes(q) ||
        v.month.toLowerCase().includes(q) ||
        v.participantGroup?.toLowerCase().includes(q) ||
        String(v.participants ?? '').includes(q)
    );
  }, [community, search]);

  const filteredResearch = useMemo(() => {
    if (!search.trim()) return research;
    const q = search.toLowerCase();
    return research.filter(row =>
      row.month.toLowerCase().includes(q) ||
      row.names.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q) ||
      row.institution?.toLowerCase().includes(q) ||
      row.topic?.toLowerCase().includes(q) ||
      row.requestedActivities?.toLowerCase().includes(q) ||
      row.status?.toLowerCase().includes(q)
    );
  }, [research, search]);

  const filteredConflicts = useMemo(() => {
    if (!search.trim()) return conflicts;
    const q = search.toLowerCase();
    return conflicts.filter(row =>
      row.date?.toLowerCase().includes(q) ||
      row.location?.toLowerCase().includes(q) ||
      row.issueType?.toLowerCase().includes(q) ||
      row.description?.toLowerCase().includes(q) ||
      row.status?.toLowerCase().includes(q) ||
      row.areaType?.toLowerCase().includes(q) ||
      row.actionTaken?.toLowerCase().includes(q)
    );
  }, [conflicts, search]);

  const bioWaterExplore = useMemo(() => {
    if (!bioWater) return [];
    return flattenBiodiversityExplore(bioWater);
  }, [bioWater]);

  const wasacWaterExplore = useMemo(() => {
    return flattenWasacExplore(wasacParams, wasacSiteLabels);
  }, [wasacParams, wasacSiteLabels]);

  const filteredBioWaterExplore = useMemo(
    () => filterWaterExploreRows(bioWaterExplore, search),
    [bioWaterExplore, search],
  );

  const filteredWasacWaterExplore = useMemo(
    () => filterWaterExploreRows(wasacWaterExplore, search),
    [wasacWaterExplore, search],
  );

  const latestMonth = useMemo(() => {
    const all = [
      ...schoolMonthlyRows, ...wasteMonthly, ...passesMonthly, ...communityByMonth, ...researchByMonth,
    ].map(r => r.month);
    return all.sort((x, y) => monthSortKey(x) - monthSortKey(y)).pop() ?? '';
  }, [schoolMonthlyRows, wasteMonthly, passesMonthly, communityByMonth, researchByMonth]);

  const insights = useMemo(() => {
    const sortedTaxa = [...donutBiodiversity].sort((x, y) => x.count === y.count ? 0 : y.count - x.count);
    const totalSpecies = summary?.totalSpecies ?? 870;
    const bestQuarter = schoolQuarterly.reduce<{ quarter: string; students: number } | null>(
      (best, q) => (!best || q.students > best.students ? q : best), null);
    const completedQuarters = schoolQuarterly.slice(0, -1); // the latest quarter is still in progress
    const belowTarget = completedQuarters.filter(q => q.students < studentTarget).length;
    const participants = communityByMonth.reduce((t, m) => t + m.participants, 0);
    const cumulativeWaste = (() => {
      let sum = 0;
      return wasteMonthly.map(m => (sum += m.kg));
    })();
    const inProgress = conflicts.filter(r => /progress/i.test(r.status ?? '')).length;
    const resolved = conflicts.filter(r => /resolved/i.test(r.status ?? '')).length;
    return {
      sortedTaxa,
      totalSpecies,
      topShare: sortedTaxa[0] ? Math.round((sortedTaxa[0].count / totalSpecies) * 100) : 0,
      bestQuarter,
      belowTarget,
      completedCount: completedQuarters.length,
      participants,
      peakActivity: peakOf(communityByMonth, r => r.activities),
      peakResearch: peakOf(researchByMonth, r => r.requests),
      peakWaste: peakOf(wasteMonthly, r => r.kg),
      avgWaste: wasteMonthly.length ? Math.round(kpis.wasteKg / wasteMonthly.length) : 0,
      cumulativeWaste,
      inProgress,
      resolved,
    };
  }, [donutBiodiversity, summary, schoolQuarterly, studentTarget, communityByMonth, wasteMonthly, conflicts, researchByMonth, kpis.wasteKg]);

  const go = (id: SectionId) => {
    setSection(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        Loading dashboard data…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', maxWidth: 520, margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem' }}>{loadError}</p>
        <button type="button" className="doc-action-btn doc-action-btn--primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  const RECORD_SETS: Record<string, { id: string; label: string }[]> = {
    biodiversity: [{ id: 'taxa', label: `Species by group (${barBiodiversity.length})` }],
    education: [{ id: 'schools', label: `School visits (${schools?.individualVisits.length ?? 0})` }],
    community: [
      { id: 'community', label: `Activities (${community.length})` },
      { id: 'passes', label: `Complementary pass (${passes?.detail.length ?? 0})` },
      { id: 'pass-groups', label: `Pass groups (${complementaryPassByGroup.length})` },
    ],
    research: [
      { id: 'research', label: `Requests (${research.length})` },
      { id: 'research-status', label: `Status (${researchByAction.length})` },
      { id: 'internships', label: `Internships (${internships.reduce((t, r) => t + r.total, 0)})` },
      { id: 'internship-pipeline', label: `Applications since ${pipeline?.since ?? 'July'} (${pipeline?.total ?? 0})` },
    ],
    conflicts: [
      { id: 'conflicts', label: `Cases (${conflicts.length})` },
      { id: 'conflict-types', label: `Issue types (${conflictsByType.length})` },
    ],
    waste: [{ id: 'waste', label: `Monthly records (${waste.length})` }],
    water: [
      { id: 'water-bio', label: `Park survey (${bioWaterExplore.length})` },
      { id: 'water-wasac', label: `WASAC (${wasacWaterExplore.length})` },
    ],
  };
  const recIds = RECORD_SETS[section] ?? [];
  const tab = recIds.some(r => r.id === exploreTab) ? exploreTab : recIds[0]?.id;
  const recordsPanel = recIds.length > 0 ? (
    <div className="dash-records">
      <SectionTitle note="Search and browse the underlying records.">Records</SectionTitle>
      <input
        type="search"
        className="species-search"
        placeholder="Search these records…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '1rem' }}
      />
      {recIds.length > 1 && (
        <div className="dash-chips">
          {recIds.map(t => (
            <button
              key={t.id}
              type="button"
              className={`dash-chip${tab === t.id ? ' dash-chip--active' : ''}`}
              onClick={() => setExploreTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
            <div className="glass-card data-table-wrap" role="region" aria-label="Records">
              {tab === 'taxa' && (
                <table className="data-table">
                  <thead>
                    <tr><th>Group</th><th>2023</th><th>2025</th><th>Change</th></tr>
                  </thead>
                  <tbody>
                    {barBiodiversity
                      .filter(r => !search.trim() || r.taxa.toLowerCase().includes(search.toLowerCase()))
                      .map(r => (
                        <tr key={r.taxa}>
                          <td>{r.taxa}</td>
                          <td>{r['2023']}</td>
                          <td>{r['2025']}</td>
                          <td>{r['2025'] - r['2023'] > 0 ? `+${r['2025'] - r['2023']}` : '0'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'schools' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>School / group</th>
                      <th>Groups</th>
                      <th>Students</th>
                      <th>Teachers</th>
                      <th>Other adults</th>
                      <th>Complimentary</th>
                      <th>Programme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchoolVisits.map((row, i) => (
                      <tr key={i}>
                        <td>{row.month}</td>
                        <td>{row.school}</td>
                        <td>{row.schoolGroups ?? '—'}</td>
                        <td>{row.students ?? '—'}</td>
                        <td>{row.teachers ?? '—'}</td>
                        <td>{row.otherAdults ?? '—'}</td>
                        <td>{row.complimentary ?? '—'}</td>
                        <td>{row.programme ? `${row.programme}${row.programmePupils != null ? ` (${row.programmePupils} pupils)` : ''}` : (row.notes ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'community' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Activity</th>
                      <th>Participant group</th>
                      <th>Participants</th>
                      <th>Women</th>
                      <th>Men</th>
                      <th>Institutions</th>
                      <th>Complimentary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommunity.map((row, i) => (
                      <tr key={i}>
                        <td>{row.month}</td>
                        <td>{row.activity}</td>
                        <td>{row.participantGroup ?? '—'}</td>
                        <td>{row.participants ?? '—'}</td>
                        <td>{row.women ?? '—'}</td>
                        <td>{row.men ?? '—'}</td>
                        <td>{row.institutions ?? '—'}</td>
                        <td>{row.complimentary ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'research' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Date received</th>
                      <th>Researcher(s)</th>
                      <th>Institution</th>
                      <th>Category</th>
                      <th>Topic</th>
                      <th>Requested activity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResearch.map((row, i) => (
                      <tr key={`${row.names}-${i}`}>
                        <td>{row.month}</td>
                        <td>{row.dateReceived ?? '—'}</td>
                        <td>{row.names}</td>
                        <td>{row.institution ?? '—'}</td>
                        <td>{row.category}</td>
                        <td>{row.topic ?? '—'}</td>
                        <td>{row.requestedActivities ?? '—'}</td>
                        <td>{row.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'research-status' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchByAction
                      .filter(row => !search.trim() || row.name.toLowerCase().includes(search.toLowerCase()))
                      .map(row => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'conflicts' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Issue type</th>
                      <th>Area</th>
                      <th>Location</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Action taken</th>
                      <th>Follow-up needed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConflicts.map((row, i) => (
                      <tr key={`${row.id ?? i}-${row.date ?? i}`}>
                        <td>{row.date ?? '—'}</td>
                        <td>{row.issueType ?? '—'}</td>
                        <td>{row.areaType ?? '—'}</td>
                        <td>{row.location ?? '—'}</td>
                        <td>{row.description ?? '—'}</td>
                        <td>{row.status ?? '—'}</td>
                        <td>{row.actionTaken ?? '—'}</td>
                        <td>{row.followUpRequired ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'conflict-types' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Issue type</th>
                      <th>Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflictsByType
                      .filter(row => !search.trim() || row.name.toLowerCase().includes(search.toLowerCase()))
                      .map(row => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'pass-groups' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Complementary pass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complementaryPassByGroup
                      .filter(row => !search.trim() || row.group.toLowerCase().includes(search.toLowerCase()))
                      .map((row, i) => (
                        <tr key={`${row.group}-${i}`}>
                          <td>{row.group}</td>
                          <td>{row.complementaryPasses}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'internships' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Academic</th>
                      <th>Professional</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internships
                      .filter(row => !search.trim() || row.month.toLowerCase().includes(search.toLowerCase()))
                      .map((row, i) => (
                        <tr key={`${row.month}-${i}`}>
                          <td>{row.month}</td>
                          <td>{row.academic}</td>
                          <td>{row.professional}</td>
                          <td>{row.total}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'internship-pipeline' && pipeline && (
                <table className="data-table">
                  <thead>
                    <tr><th>Stage</th><th>Academic</th><th>Professional</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {pipeline.stages
                      .filter(r => !search.trim() || r.stage.toLowerCase().includes(search.toLowerCase()))
                      .map(r => (
                        <tr key={r.stage}>
                          <td>{r.stage}</td>
                          <td>{r.academic}</td>
                          <td>{r.professional}</td>
                          <td>{r.academic + r.professional}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'passes' && passes && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Group</th>
                      <th>Complementary pass</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passes.detail
                      .filter(d => !search.trim() || d.group.toLowerCase().includes(search.toLowerCase()) || d.month.toLowerCase().includes(search.toLowerCase()))
                      .map((row, i) => (
                        <tr key={i}>
                          <td>{row.month}</td>
                          <td>{row.group}</td>
                          <td>{row.passes}</td>
                          <td>{row.notes ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {tab === 'waste' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Total (kg)</th>
                      <th>Biodegradable (kg)</th>
                      <th>Non-biodegradable (kg)</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waste.map((row, i) => {
                      const bio = row.biodegradableKg ?? (row.kg != null ? Math.round(row.kg * 0.7) : null);
                      const nonBio = row.nonBiodegradableKg ?? (row.kg != null && bio != null ? row.kg - bio : null);
                      return (
                        <tr key={i}>
                          <td>{row.month}</td>
                          <td>{row.kg ?? '—'}</td>
                          <td>{bio ?? '—'}</td>
                          <td>{nonBio ?? '—'}</td>
                          <td>{row.note ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {tab === 'water-bio' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Sampling point</th>
                      <th>Value</th>
                      <th>Unit</th>
                      <th>Limit</th>
                      <th>Result</th>
                      <th>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBioWaterExplore.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>
                          {bioWaterExplore.length === 0
                            ? 'No biodiversity survey water data loaded.'
                            : 'No rows match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredBioWaterExplore.map((row, i) => (
                        <tr key={`${row.parameter}-${row.site}-${i}`}>
                          <td>{row.parameter}</td>
                          <td>{row.site}</td>
                          <td>{row.value}</td>
                          <td>{row.unit}</td>
                          <td>{row.limit}</td>
                          <ExploreResultCell result={row.result} />
                          <td>{row.methodOrRemarks}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'water-wasac' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Sampling point</th>
                      <th>Value</th>
                      <th>Unit</th>
                      <th>Limit</th>
                      <th>Result</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWasacWaterExplore.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>
                          {wasacWaterExplore.length === 0
                            ? 'No WASAC water data loaded.'
                            : 'No rows match your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredWasacWaterExplore.map((row, i) => (
                        <tr key={`${row.parameter}-${row.site}-${i}`}>
                          <td>{row.parameter}</td>
                          <td>{row.site}</td>
                          <td>{row.value}</td>
                          <td>{row.unit}</td>
                          <td>{row.limit}</td>
                          <ExploreResultCell result={row.result} />
                          <td>{row.methodOrRemarks}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
    </div>
  ) : null;

  const waterRate = waterOverall?.rate ?? null;
  const waterTone: 'ok' | 'warn' | 'bad' = waterRate == null ? 'ok' : waterRate >= 90 ? 'ok' : waterRate >= 70 ? 'warn' : 'bad';
  const attention: { text: string; go: SectionId }[] = [];
  if (kpis.openConflicts > 0) attention.push({ text: `${kpis.openConflicts} open conflict case${kpis.openConflicts === 1 ? '' : 's'}`, go: 'conflicts' });

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="dashboard-shell">
        <header className="dash-head">
          <h1 className="sr-only">Biodiversity and Research Department dashboard</h1>
          <div className="dash-head-right">
            {latestMonth && (
              <p className="dash-updated"><span className="dash-dot" aria-hidden />Data to {latestMonth}</p>
            )}
            <Link href="/report" className="dash-report-btn">Monthly summary (PDF)</Link>
          </div>
        </header>

        <nav className="dash-tabs" aria-label="Dashboard sections">
          {SECTIONS.filter(t => t.id !== 'restoration' || restoration).map(t => (
            <button
              key={t.id}
              type="button"
              className={`dash-tab${section === t.id ? ' dash-tab--active' : ''}`}
              onClick={() => setSection(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="dash-body" key={section}>
        {section === 'overview' && (
          <div className="dash-tiles">
            <Tile
              title="Biodiversity" onOpen={() => go('biodiversity')} delay={0}
              value={<CountUp value={kpis.species} />} unit="species recorded"
              viz={<SegmentBar labels={false} segments={insights.sortedTaxa.map(t => ({ label: t.taxa, value: t.count, color: t.color }))} />}
              note={insights.sortedTaxa[0] ? `${insights.sortedTaxa[0].taxa} lead with ${insights.sortedTaxa[0].count} (${insights.topShare}%)` : ''}
            />
            <Tile
              title="Education" onOpen={() => go('education')} delay={60}
              value={<CountUp value={kpis.students} />} unit={`students reached · ${kpis.visits} school visits`}
              viz={<Sparkline values={schoolQuarterly.map(q => q.students)} />}
              note={insights.bestQuarter ? `Best quarter ${insights.bestQuarter.quarter}: ${insights.bestQuarter.students.toLocaleString()} (target ${studentTarget})` : ''}
            />
            <Tile
              title="Community" onOpen={() => go('community')} delay={120}
              value={<CountUp value={kpis.activities} />} unit="outreach activities"
              viz={<Sparkline values={communityByMonth.map(m => m.activities)} />}
              note={`${insights.participants.toLocaleString()} participants${insights.peakActivity ? ` · busiest ${insights.peakActivity.month}` : ''}`}
            />
            <Tile
              title="Research" onOpen={() => go('research')} delay={180}
              value={<CountUp value={kpis.researchRequests} />} unit="research requests"
              viz={<Sparkline values={researchByMonth.map(m => m.requests)} />}
              note={insights.peakResearch ? `Busiest month ${insights.peakResearch.month} (${insights.peakResearch.value})` : ''}
            />
            <Tile
              title="Conflicts" onOpen={() => go('conflicts')} delay={240}
              value={<CountUp value={kpis.openConflicts} />} unit="open cases"
              viz={<SegmentBar labels={false} segments={conflictsByStatus.map(r => ({ label: r.name, value: r.count, color: /resolved/i.test(r.name) ? '#2E9E5B' : /progress/i.test(r.name) ? '#E0A030' : /open/i.test(r.name) ? '#D9534F' : '#B9C4BC' }))} />}
              note={`${conflicts.length} logged · ${insights.inProgress} in progress · ${insights.resolved} resolved`}
            />
            <Tile
              title="Waste" onOpen={() => go('waste')} delay={300}
              value={<CountUp value={kpis.wasteKg} />} unit="kg collected"
              viz={<Sparkline values={insights.cumulativeWaste} />}
              note={`About ${insights.avgWaste} kg a month${insights.peakWaste ? ` · peak ${insights.peakWaste.month}` : ''}`}
            />
            <Tile
              title="Water quality" onOpen={() => go('water')} delay={360}
              value={waterRate != null ? <CountUp value={waterRate} decimals={1} suffix="%" /> : '—'} unit="of tests within limits"
              viz={waterRate != null ? <Ring percent={waterRate} tone={waterTone} /> : null}
              note={waterOverall ? `${waterOverall.pass} pass · ${waterOverall.fail} outside limits` : ''}
            />
            {restoration && (() => {
              const latest = restoration.byCheckpoint.filter(r => r.rate != null).at(-1);
              return (
                <Tile
                  title="Trees planted" onOpen={() => go('restoration')} delay={390}
                  value={<CountUp value={restoration.totalPlanted} />} unit={`trees · ${restoration.species} species`}
                  viz={latest?.rate != null ? <Ring percent={latest.rate} tone={latest.rate >= SURVIVAL_TARGET ? 'ok' : latest.rate >= 70 ? 'warn' : 'bad'} /> : null}
                  note={latest?.rate != null ? `${latest.rate}% alive at ${latest.label}` : 'No survival check yet'}
                />
              );
            })()}
            <div className="dash-tile dash-tile--static" style={{ animationDelay: '420ms' }}>
              <span className="dash-tile-title">Needs attention</span>
              {attention.length === 0 ? (
                <span className="dash-tile-note">Nothing flagged right now.</span>
              ) : (
                <ul className="dash-attention">
                  {attention.map(a => (
                    <li key={a.text}><button type="button" className="dash-attention-btn" onClick={() => go(a.go)}>{a.text}</button></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {section === 'biodiversity' && (
          <>
            <SectionTitle note={insights.sortedTaxa[0] ? `${insights.sortedTaxa[0].taxa} make up ${insights.topShare}% of the ${kpis.species} species recorded.` : undefined}>
              Biodiversity
            </SectionTitle>
            <StatRow items={[
              { label: 'species recorded', value: <CountUp value={kpis.species} /> },
              { label: 'groups surveyed', value: <CountUp value={insights.sortedTaxa.length} /> },
              { label: `${insights.sortedTaxa[0]?.taxa ?? 'largest group'} share`, value: <CountUp value={insights.topShare} suffix="%" /> },
            ]} />
            <div className="taxa-mini">
              {taxaCards.map(card => (
                <div key={card.taxa} className="taxa-mini-item">
                  <TaxaIcon taxa={card.taxa} size={30} />
                  <b>{card.count}</b>
                  <span>{card.taxa}</span>
                  <em className={card.stable ? 'is-stable' : ''}>{card.badge}</em>
                </div>
              ))}
            </div>
            <div className="dashboard-charts-grid">
              <ChartCard title="Growth since the 2023 baseline" content>
                <GrowthRows rows={barBiodiversity.map(r => ({ label: r.taxa, from: r['2023'], to: r['2025'] }))} />
              </ChartCard>
              <ChartCard title="Who lives here: share of species" content>
                <Waffle segments={insights.sortedTaxa.map(t => ({ label: t.taxa, value: t.count, color: t.color }))} />
              </ChartCard>
            </div>
            <p className="dash-links">
              <Link href="/species">Browse all {kpis.species} species →</Link>
              <Link href="/map">See the survey areas on the map →</Link>
            </p>
            {recordsPanel}
          </>
        )}

        {section === 'education' && schoolQuarterly.length > 0 && (
          <>
            <SectionTitle note={insights.bestQuarter ? `Best quarter: ${insights.bestQuarter.quarter} with ${insights.bestQuarter.students.toLocaleString()} students. ${insights.belowTarget} of ${insights.completedCount} completed quarters fell below the ${studentTarget} target.` : undefined}>
              Education & school visits
            </SectionTitle>
            <StatRow items={[
              { label: 'students reached', value: <CountUp value={kpis.students} /> },
              { label: 'school visits', value: <CountUp value={kpis.visits} /> },
              { label: 'quarterly target', value: <CountUp value={studentTarget} /> },
              { label: 'completed quarters on target', value: `${insights.completedCount - insights.belowTarget} of ${insights.completedCount}` },
            ]} />
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Students per quarter" tall>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schoolQuarterly} margin={{ top: 24, right: 8, left: -8, bottom: 8 }}>
                    {GRADIENT_DEFS}
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SlickTooltip />} cursor={{ fill: 'rgba(12,96,56,0.05)' }} />
                    <ReferenceLine
                      y={studentTarget}
                      stroke="#E39A1F"
                      strokeDasharray="4 4"
                      strokeWidth={1.2}
                      label={{ value: `Target ${studentTarget}`, position: 'insideTopRight', fill: '#C98516', fontSize: 11, fontFamily: 'Poppins' }}
                    />
                    <Bar dataKey="students" name="Students" fill="url(#gGreen)" radius={[8, 8, 0, 0]} barSize={26} animationDuration={900}>
                      <LabelList dataKey="students" position="top" style={{ fontSize: 11, fill: c.tick, fontFamily: 'Poppins' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Students per month">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={withShortMonths(schoolMonthlyRows)} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    {GRADIENT_DEFS}
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SlickTooltip />} cursor={{ fill: 'rgba(12,96,56,0.05)' }} />
                    <Bar dataKey="students" name="Students" fill="url(#gGreen)" radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            {recordsPanel}
          </>
        )}

        {section === 'community' && (
          <>
            <SectionTitle note={`${kpis.activities} activities reached about ${insights.participants.toLocaleString()} people.`}>
              Community engagement
            </SectionTitle>
            <StatRow items={[
              { label: 'outreach activities', value: <CountUp value={kpis.activities} /> },
              { label: 'participants (est.)', value: <CountUp value={insights.participants} /> },
              { label: 'complimentary passes', value: <CountUp value={passesMonthly.reduce((t, m) => t + (m.totalPasses ?? 0), 0)} /> },
              ...(insights.peakActivity ? [{ label: 'busiest month', value: insights.peakActivity.month }] : []),
            ]} />
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Outreach by month" tall>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={communityByMonth} margin={{ top: 8, right: 12, left: -4, bottom: 16 }}>
                    {GRADIENT_DEFS}
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#C98516', fontFamily: 'Poppins', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SlickTooltip />} cursor={{ fill: 'rgba(12,96,56,0.05)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins' }} />
                    <Bar yAxisId="left" dataKey="activities" name="Activities" fill="url(#gGreen)" radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                    <Line yAxisId="right" type="monotone" dataKey="participants" name="Participants (est.)" stroke="#E39A1F" strokeWidth={2} dot={{ r: 3, fill: '#fff', stroke: '#E39A1F', strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={1100} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Complimentary passes per month">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={passesMonthly} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    {GRADIENT_DEFS}
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SlickTooltip />} cursor={{ fill: 'rgba(227,154,31,0.07)' }} />
                    <Bar dataKey="totalPasses" name="Complimentary passes" fill="url(#gGold)" radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            {complementaryPassByGroup.length > 0 && (
              <div className="dashboard-charts-grid dashboard-charts-grid--single">
                <ChartCard title="Complimentary passes by group" content>
                  <RankRows color="#E39A1F" items={complementaryPassByGroup.slice(0, 8).map(r => ({ label: r.group, value: r.complementaryPasses }))} />
                </ChartCard>
              </div>
            )}
            {recordsPanel}
          </>
        )}

        {section === 'research' && (research.length > 0 || internshipByMonth.length > 0) && (
          <>
            <SectionTitle note={insights.peakResearch ? `${kpis.researchRequests} requests so far. Busiest month: ${insights.peakResearch.month} (${insights.peakResearch.value}).` : undefined}>
              Research coordination
            </SectionTitle>
            <StatRow items={[
              { label: 'research requests', value: <CountUp value={kpis.researchRequests} /> },
              { label: 'internship placements', value: <CountUp value={internships.reduce((t, r) => t + r.total, 0)} /> },
              ...(pipeline ? [{ label: `applications since ${pipeline.since}`, value: <CountUp value={pipeline.total} /> }] : []),
              ...(insights.peakResearch ? [{ label: 'busiest month', value: insights.peakResearch.month }] : []),
            ]} />
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Research requests by month">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={researchByMonth} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    {GRADIENT_DEFS}
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<SlickTooltip />} cursor={{ fill: 'rgba(12,96,56,0.05)' }} />
                    <Bar dataKey="requests" name="Requests" fill="url(#gGreen)" radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              {internshipByMonth.length > 0 && (
                <ChartCard title="Internship placements by month">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={internshipByMonth} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                      {GRADIENT_DEFS}
                      <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                      <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<SlickTooltip />} cursor={{ fill: 'rgba(12,96,56,0.05)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins' }} />
                      <Bar dataKey="academic" name="Academic" stackId="i" fill="url(#gGreen)" barSize={16} animationDuration={900} />
                      <Bar dataKey="professional" name="Professional" stackId="i" fill="url(#gGold)" radius={[6, 6, 0, 0]} barSize={16} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
            {pipeline && (
              <div className="dashboard-charts-grid">
                <ChartCard title={`Internship applications since ${pipeline.since}: where they stand`} content>
                  <SegmentBar segments={pipeline.stages.map((st, i) => ({
                    label: st.stage,
                    value: st.academic + st.professional,
                    color: ['#B9C4BC', '#2E9E5B', '#E0A030', '#4895ef', '#808847'][i % 5],
                  }))} />
                  <p className="chart-card-desc" style={{ marginTop: 14 }}>
                    {pipeline.total} applicants: {pipeline.byType.Academic} academic and {pipeline.byType.Professional} professional. Counts only, as of {pipeline.asOf}.
                  </p>
                </ChartCard>
                <ChartCard title="Applicants by institution" content>
                  <RankRows items={pipeline.institutions.map(i => ({ label: i.name, value: i.count }))} />
                </ChartCard>
              </div>
            )}
            {researchByAction.length > 0 && (
              <div className="dashboard-charts-grid dashboard-charts-grid--single">
                <ChartCard title="Requests by status" content>
                  <RankRows items={researchByAction.map(r => ({ label: r.name, value: r.count }))} />
                </ChartCard>
              </div>
            )}
            {recordsPanel}
          </>
        )}

        {section === 'conflicts' && conflicts.length > 0 && (
          <>
            <SectionTitle note={`${conflicts.length} cases logged: ${kpis.openConflicts} open, ${insights.inProgress} in progress, ${insights.resolved} resolved.`}>
              Conflict management
            </SectionTitle>
            <StatRow items={[
              { label: 'cases logged', value: <CountUp value={conflicts.length} /> },
              { label: 'open', value: <CountUp value={kpis.openConflicts} /> },
              { label: 'in progress', value: <CountUp value={insights.inProgress} /> },
              { label: 'resolved', value: <CountUp value={insights.resolved} /> },
            ]} />
            <div className="dashboard-charts-grid">
              <ChartCard title="Cases by status" content>
                <SegmentBar segments={conflictsByStatus.map(r => ({ label: r.name, value: r.count, color: /resolved/i.test(r.name) ? '#2E9E5B' : /progress/i.test(r.name) ? '#E0A030' : /open/i.test(r.name) ? '#D9534F' : '#B9C4BC' }))} />
              </ChartCard>
              <ChartCard title="Cases by issue type" content>
                <RankRows color="#D9534F" items={conflictsByType.map(r => ({ label: r.name, value: r.count }))} />
              </ChartCard>
            </div>
            {recordsPanel}
          </>
        )}

        {section === 'waste' && (
          <>
            <SectionTitle note={`${kpis.wasteKg.toLocaleString()} kg collected, about ${insights.avgWaste} kg a month.`}>
              Waste management
            </SectionTitle>
            <StatRow items={[
              { label: 'kg collected', value: <CountUp value={kpis.wasteKg} /> },
              { label: 'kg per month, average', value: <CountUp value={insights.avgWaste} /> },
              ...(insights.peakWaste ? [{ label: `peak month (${Math.round(insights.peakWaste.value)} kg)`, value: insights.peakWaste.month }] : []),
            ]} />
            <WasteDashboardCharts data={wasteData} />
            {recordsPanel}
          </>
        )}

        {section === 'restoration' && restoration && (
          <>
            <SectionTitle>Tree planting and survival</SectionTitle>
            <StatRow items={[
              { label: 'trees planted', value: <CountUp value={restoration.totalPlanted} /> },
              { label: 'species', value: <CountUp value={restoration.species} /> },
              { label: 'plantings', value: <CountUp value={restoration.plantings.length} /> },
            ]} />
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Survival at each check" content>
                <table className="report-table entry-table">
                  <thead><tr><th>Check</th><th>Trees checked</th><th>Alive</th><th>Dead</th><th>Survival</th></tr></thead>
                  <tbody>
                    {restoration.byCheckpoint.map(r => (
                      <tr key={r.label}>
                        <td>{r.label}</td><td>{r.batches ? r.planted.toLocaleString('en-US') : '—'}</td><td>{r.batches ? r.alive : '—'}</td><td>{r.batches ? r.dead : '—'}</td>
                        <td>{r.rate != null ? `${r.rate}%${r.rate >= SURVIVAL_TARGET ? '' : ` (target ${SURVIVAL_TARGET}%)`}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            </div>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="By sector" content>
                <table className="report-table entry-table">
                  <thead><tr><th>Sector</th><th>Trees planted</th><th>Alive at latest check</th><th>Survival</th></tr></thead>
                  <tbody>
                    {restoration.bySector.map(r => (
                      <tr key={r.label}><td>{r.label}</td><td>{r.planted.toLocaleString('en-US')}</td><td>{r.rate != null ? r.alive : '—'}</td><td>{r.rate != null ? `${r.rate}%` : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            </div>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Plantings" content>
                <table className="report-table entry-table">
                  <thead><tr><th>Date planted</th><th>Species</th><th>Sector</th><th>Trees</th><th>Latest check</th></tr></thead>
                  <tbody>
                    {restoration.plantings.slice(0, 30).map(p => (
                      <tr key={p.id}>
                        <td>{p.date}</td><td><em>{p.species}</em>{p.common ? ` (${p.common})` : ''}</td><td>{p.sector}</td><td>{p.planted}</td>
                        <td>{p.latest ? `${p.latest.checkpoint}: ${p.latest.rate}% alive` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            </div>
          </>
        )}

        {section === 'water' && (
          <>
            <SectionTitle note={waterOverall ? `${waterOverall.rate}% of ${waterOverall.total} results were within Rwanda freshwater limits.` : undefined}>
              Water quality
            </SectionTitle>
            {waterTests.length > 0 && (
              <div className="dashboard-charts-grid dashboard-charts-grid--single">
                <ChartCard title="Latest water tests" content>
                  <table className="report-table entry-table">
                    <thead><tr><th>Date sampled</th><th>Sampling point</th><th>Within limits</th><th>Outside limits</th></tr></thead>
                    <tbody>
                      {waterTests.slice(0, 20).map(t => (
                        <tr key={t.id}>
                          <td>{t.date}</td>
                          <td>{t.point}</td>
                          <td>{t.rate != null ? `${t.rate}% (${t.pass} of ${t.pass + t.fail})` : 'no limits apply'}</td>
                          <td>{t.outside.length ? t.outside.map(r => `${r.parameter} ${r.value}${r.unit ? ` ${r.unit}` : ''} (limit ${r.limit})`).join('; ') : 'none'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ChartCard>
              </div>
            )}
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              {bioWater && (
                <ChartCard title="Park water quality: biodiversity survey" content>
                  <BiodiversityWaterCompliance summary={bioWater} />
                </ChartCard>
              )}
            </div>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              {bioWater && (
                <ChartCard title="Explore park water parameters" content>
                  <BiodiversityWaterExplorer summary={bioWater} />
                </ChartCard>
              )}
              <ChartCard title="WASAC effluent and industrial wastewater (separate programme)" content>
                <WasacWaterPanel />
              </ChartCard>
            </div>
            {recordsPanel}
          </>
        )}

        </div>
      </div>
    </div>
  );
}
