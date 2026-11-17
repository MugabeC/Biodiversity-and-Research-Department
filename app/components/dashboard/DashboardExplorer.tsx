'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
  ComposedChart, ReferenceLine,
} from 'recharts';
import TaxaIcon from '../TaxaIcon';
import {
  flattenBiodiversityExplore,
  flattenWasacExplore,
  filterWaterExploreRows,
} from '@/app/lib/exploreWaterQuality';
import {
  loadDashboardFromBundle,
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
import { useChartColors, chartTooltipProps } from './chartTheme';
import TaxaShareBarChart from './TaxaShareBarChart';
import { normalizeWasteData } from './WasteDashboardCharts';
import { CountUp, Sparkline, Ring, SegmentBar } from './minimal';

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
  { id: 'explore', label: 'Explore Data' },
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
  const [internships, setInternships] = useState<ReturnType<typeof loadDashboardFromBundle>['internships']>([]);
  const waste = useMemo(() => normalizeWasteData(wasteData), [wasteData]);
  const [bioWater, setBioWater] = useState<ReturnType<typeof loadDashboardFromBundle>['bioWater']>(null);
  const [wasacParams, setWasacParams] = useState<ReturnType<typeof loadDashboardFromBundle>['wasacParams']>([]);
  const [wasacSiteLabels, setWasacSiteLabels] = useState<string[]>([]);
  const [exploreTab, setExploreTab] = useState('schools');
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const c = useChartColors();
  const tt = chartTooltipProps(c);
  const studentTarget = summary?.studentTargetPerQuarter ?? 500;

  useEffect(() => {
    try {
      const data = loadDashboardFromBundle();
      setSummary(data.summary);
      setSchools(data.schools);
      setCommunity(data.community);
      setPasses(data.passes);
      setWasteData(data.waste);
      setResearch(data.research);
      setConflicts(data.conflicts);
      setInternships(data.internships);
      setBioWater(data.bioWater);
      setWasacParams(data.wasacParams);
      setWasacSiteLabels(data.wasacSiteLabels);
      setLoadError(null);
    } catch {
      setLoadError(
        'Could not load dashboard data. Run npm run dev:clean to reset the dev server, then refresh.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
      waterCompliance: bioWater != null ? `${bioWater.rate}%` : '—',
      wasteKg: Math.round(totalWaste),
      visits: (() => {
        const groups = (schools?.monthlyTotals ?? []).reduce((s, m) => s + (m.schoolGroups ?? 0), 0);
        return groups > 0 ? groups : schools?.individualVisits?.length ?? 0;
      })(),
    };
  }, [summary, schoolMonthlyRows, wasteMonthly, community, schools, bioWater, research, conflicts]);

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

  const waterRate = bioWater?.rate ?? null;
  const waterTone: 'ok' | 'warn' | 'bad' = waterRate == null ? 'ok' : waterRate >= 90 ? 'ok' : waterRate >= 70 ? 'warn' : 'bad';
  const attention: { text: string; go: SectionId }[] = [];
  if (kpis.openConflicts > 0) attention.push({ text: `${kpis.openConflicts} open conflict case${kpis.openConflicts === 1 ? '' : 's'}`, go: 'conflicts' });
  if (bioWater && bioWater.fail > 0) attention.push({ text: `${bioWater.fail} water tests outside limits`, go: 'water' });
  if (insights.belowTarget > 0) attention.push({ text: `${insights.belowTarget} of ${insights.completedCount} completed quarters below the ${studentTarget} student target`, go: 'education' });

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="dashboard-shell">
        <header className="dash-head">
          <div>
            <h1 className="dash-title">Biodiversity and Research Department</h1>
            <p className="dash-sub">
              {summary?.parkName ?? 'Nyandungu Eco-Park'} · {summary?.location ?? 'Kigali, Rwanda'} · {summary?.parkSize ?? '183.94 Ha'}
            </p>
          </div>
          {latestMonth && (
            <p className="dash-updated"><span className="dash-dot" aria-hidden />Data to {latestMonth}</p>
          )}
        </header>

        <nav className="dash-tabs" aria-label="Dashboard sections">
          {SECTIONS.map(t => (
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
              note={bioWater ? `${bioWater.pass} pass · ${bioWater.fail} outside limits` : ''}
            />
            <div className="dash-tile dash-tile--static" style={{ animationDelay: '420ms' }}>
              <span className="dash-tile-title">Needs attention</span>
              {attention.length === 0 ? (
                <span className="dash-tile-note">Nothing flagged right now.</span>
              ) : (
                <ul className="dash-attention">
                  {attention.map(a => (
                    <li key={a.text}><button type="button" onClick={() => go(a.go)}>{a.text}<i aria-hidden>→</i></button></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {section === 'biodiversity' && (
          <>
            <SectionTitle note={insights.sortedTaxa[0] ? `${insights.sortedTaxa[0].taxa} make up ${insights.topShare}% of the ${kpis.species} species recorded.` : undefined}>
              Biodiversity survey
            </SectionTitle>
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
              <ChartCard title="Species count: 2023 vs 2025">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barBiodiversity} margin={{ top: 8, right: 8, left: -10, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="taxa" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tt} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="2023" name="2023 Baseline" fill={c.secondary} radius={[6, 6, 0, 0]} barSize={12} animationDuration={900} />
                    <Bar dataKey="2025" name="2025 Current" fill={c.primary} radius={[6, 6, 0, 0]} barSize={12} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Species share by taxa (2025)" content>
                <TaxaShareBarChart data={donutBiodiversity} total={summary?.totalSpecies ?? 870} />
              </ChartCard>
            </div>
          </>
        )}

        {section === 'education' && schoolQuarterly.length > 0 && (
          <>
            <SectionTitle note={insights.bestQuarter ? `Best quarter: ${insights.bestQuarter.quarter} with ${insights.bestQuarter.students.toLocaleString()} students. ${insights.belowTarget} of ${insights.completedCount} completed quarters fell below the ${studentTarget} target.` : undefined}>Education & school visits</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard
                title="Quarterly student visits"
                tall
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schoolQuarterly} margin={{ top: 12, right: 8, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tt} />
                    <ReferenceLine
                      y={studentTarget}
                      stroke="#F5A623"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      label={{ value: `Target: ${studentTarget}`, position: 'insideTopRight', fill: '#F5A623', fontSize: 11, fontFamily: 'Poppins' }}
                    />
                    <Bar dataKey="students" name="Students" fill={c.primary} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

        {section === 'community' && (
          <>
            <SectionTitle note={`${kpis.activities} activities reached about ${insights.participants.toLocaleString()} people.`}>Community engagement</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard
                title="Community outreach by month"
                tall
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={communityByMonth} margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={{ fill: c.primary, fontFamily: 'Poppins', fontSize: 10 }}
                      axisLine={false}
                      allowDecimals={false}
                      label={{ value: 'Activities', angle: -90, position: 'insideLeft', fill: c.primary, fontSize: 10, fontFamily: 'Poppins' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: c.accent, fontFamily: 'Poppins', fontSize: 10 }}
                      axisLine={false}
                      label={{ value: 'Participants', angle: 90, position: 'insideRight', fill: c.accent, fontSize: 10, fontFamily: 'Poppins' }}
                    />
                    <Tooltip {...tt} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins' }} />
                    <Bar yAxisId="left" dataKey="activities" name="# Activities" fill={c.primary} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                    <Bar yAxisId="right" dataKey="participants" name="Participants (est.)" fill={c.accent} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <SectionTitle note="Complimentary passes issued each month.">Complementary pass</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Monthly complementary pass">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={passesMonthly} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} />
                    <Tooltip {...tt} />
                    <Bar dataKey="totalPasses" name="Complementary pass" fill={c.accent} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

        {section === 'research' && (research.length > 0 || internshipByMonth.length > 0) && (
          <>
            <SectionTitle note={insights.peakResearch ? `${kpis.researchRequests} requests so far. Busiest month: ${insights.peakResearch.month} (${insights.peakResearch.value}).` : undefined}>Research coordination</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard
                title="Research requests by month"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={researchByMonth} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} allowDecimals={false} />
                    <Tooltip {...tt} />
                    <Bar dataKey="requests" name="Requests" fill={c.primary} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            {internshipByMonth.length > 0 && (
              <div className="dashboard-charts-grid dashboard-charts-grid--single" style={{ marginTop: '1rem' }}>
                <ChartCard
                  title="Internship placements by month"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={internshipByMonth} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                      <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} />
                      <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} allowDecimals={false} />
                      <Tooltip {...tt} />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins' }} />
                      <Bar dataKey="academic" name="Academic" fill={c.primary} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                      <Bar dataKey="professional" name="Professional" fill={c.accent} radius={[6, 6, 0, 0]} barSize={14} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </>
        )}

        {section === 'conflicts' && conflicts.length > 0 && (
          <>
            <SectionTitle note={`${conflicts.length} cases logged: ${kpis.openConflicts} open, ${insights.inProgress} in progress, ${insights.resolved} resolved.`}>Conflict management</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard title="Conflict cases by status" content>
                <SegmentBar segments={conflictsByStatus.map(r => ({ label: r.name, value: r.count, color: /resolved/i.test(r.name) ? '#2E9E5B' : /progress/i.test(r.name) ? '#E0A030' : /open/i.test(r.name) ? '#D9534F' : '#B9C4BC' }))} />
              </ChartCard>
            </div>
          </>
        )}

        {section === 'waste' && (
          <>
            <SectionTitle note={`${kpis.wasteKg.toLocaleString()} kg collected, about ${insights.avgWaste} kg a month.`}>Waste management</SectionTitle>
            <WasteDashboardCharts data={wasteData} />
          </>
        )}

        {section === 'water' && (
          <>
            <SectionTitle note={bioWater ? `${bioWater.rate}% of tests were within Rwanda freshwater limits.` : undefined}>Water quality</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              {bioWater && (
                <ChartCard title="Park water quality — biodiversity survey compliance" content>
                  <BiodiversityWaterCompliance summary={bioWater} />
                </ChartCard>
              )}
            </div>
            <div className="dashboard-charts-grid dashboard-charts-grid--single" style={{ marginTop: '1.25rem' }}>
              {bioWater && (
                <ChartCard title="Explore park water parameters (biodiversity survey)" content>
                  <BiodiversityWaterExplorer summary={bioWater} />
                </ChartCard>
              )}
              <ChartCard title="WASAC effluent & industrial wastewater (separate programme)" content>
                <WasacWaterPanel />
              </ChartCard>
            </div>
          </>
        )}

        {section === 'explore' && (
          <>
            <SectionTitle>Explore all records</SectionTitle>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 1rem', lineHeight: 1.6 }}>
              Search and browse department datasets. Water quality has two programmes: the{' '}
              <strong>biodiversity survey</strong> (park ponds & wetlands, Nov 2025) and{' '}
              <strong>WASAC / RS 109</strong> (industrial wastewater & Phoenix Apartment community effluent, Oct 2025).
              Use the <strong>Water quality</strong> tab for charts and compliance summaries.
            </p>
            <input
              type="search"
              className="species-search"
              placeholder="Search schools, activities, research, conflicts, water parameters…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
              {[
                { id: 'schools', label: `School visits (${schools?.individualVisits.length ?? 0})` },
                { id: 'community', label: `Activities (${community.length})` },
                { id: 'research', label: `Research (${research.length})` },
                { id: 'research-status', label: `Research status (${researchByAction.length})` },
                { id: 'internships', label: `Internships (${internships.reduce((s, r) => s + r.total, 0)})` },
                { id: 'conflicts', label: `Conflicts (${conflicts.length})` },
                { id: 'conflict-types', label: `Conflict types (${conflictsByType.length})` },
                { id: 'passes', label: `Complementary pass (${passes?.detail.length ?? 0})` },
                { id: 'pass-groups', label: `Pass groups (${complementaryPassByGroup.length})` },
                { id: 'waste', label: `Waste (${waste.length})` },
                { id: 'water-bio', label: `Water — Biodiversity (${bioWaterExplore.length})` },
                { id: 'water-wasac', label: `Water — WASAC (${wasacWaterExplore.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`dashboard-nav-btn${exploreTab === t.id ? ' dashboard-nav-btn--active' : ''}`}
                  onClick={() => setExploreTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="glass-card data-table-wrap" role="region" aria-label="Explore data records">
              {exploreTab === 'schools' && (
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
              {exploreTab === 'community' && (
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
              {exploreTab === 'research' && (
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
              {exploreTab === 'research-status' && (
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
              {exploreTab === 'conflicts' && (
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
              {exploreTab === 'conflict-types' && (
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
              {exploreTab === 'pass-groups' && (
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
              {exploreTab === 'internships' && (
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
              {exploreTab === 'passes' && passes && (
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
              {exploreTab === 'waste' && (
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
              {exploreTab === 'water-bio' && (
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
              {exploreTab === 'water-wasac' && (
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
          </>
        )}
        </div>
      </div>
    </div>
  );
}
