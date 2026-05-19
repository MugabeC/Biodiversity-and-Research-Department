'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
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
  type PassesData,
  type SchoolVisitsData,
  type WasteFile,
} from '@/app/lib/dashboardData';
import {
  TAXA_META,
  sortByMonth,
  parseParticipantCount,
  withShortMonths,
  aggregateStudentsByQuarter,
} from '@/app/lib/dashboardUtils';
import { useChartColors, chartTooltipProps } from './chartTheme';
import TaxaShareBarChart from './TaxaShareBarChart';
import { normalizeWasteData } from './WasteDashboardCharts';

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
  { id: 'waste', label: 'Waste' },
  { id: 'water', label: 'Water quality' },
  { id: 'explore', label: 'Explore Data' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="heading" style={{ fontSize: '22px', color: 'var(--accent-text)', margin: '0 0 1.25rem' }}>
      {children}
    </h2>
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
    <div className="glass-card chart-card">
      <h3 className="heading" style={{ fontSize: '16px', margin: '0 0 0.5rem' }}>{title}</h3>
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
  const waste = useMemo(() => normalizeWasteData(wasteData), [wasteData]);
  const [bioWater, setBioWater] = useState<ReturnType<typeof loadDashboardFromBundle>['bioWater']>(null);
  const [wasacParams, setWasacParams] = useState<ReturnType<typeof loadDashboardFromBundle>['wasacParams']>([]);
  const [wasacSiteLabels, setWasacSiteLabels] = useState<string[]>([]);
  const [exploreTab, setExploreTab] = useState('schools');
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const c = useChartColors();
  const tt = chartTooltipProps(c);
  const STUDENT_TARGET = 500;

  useEffect(() => {
    try {
      const data = loadDashboardFromBundle();
      setSummary(data.summary);
      setSchools(data.schools);
      setCommunity(data.community);
      setPasses(data.passes);
      setWasteData(data.waste);
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
      cur.participants += parseParticipantCount(row.participants);
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

  const kpis = useMemo(() => {
    const totalStudents = schoolMonthlyRows.reduce((s, m) => s + m.students, 0);
    const totalPasses = passesMonthly.reduce((s, m) => s + m.totalPasses, 0);
    const totalWaste = wasteMonthly.reduce((s, m) => s + m.kg, 0);
    return {
      species: summary?.totalSpecies ?? 870,
      students: totalStudents,
      activities: community.length,
      passes: totalPasses,
      wasteKg: Math.round(totalWaste),
      visits: schools?.individualVisits?.length ?? 0,
    };
  }, [summary, schoolMonthlyRows, passesMonthly, wasteMonthly, community, schools]);

  const filteredSchoolVisits = useMemo(() => {
    if (!schools) return [];
    if (!search.trim()) return schools.individualVisits.slice(0, 100);
    const q = search.toLowerCase();
    return schools.individualVisits.filter(
      v =>
        v.school?.toLowerCase().includes(q) ||
        v.month?.toLowerCase().includes(q) ||
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
        v.participants.toLowerCase().includes(q)
    );
  }, [community, search]);

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

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="dashboard-shell">
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`dashboard-nav-btn${section === s.id ? ' dashboard-nav-btn--active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-title-block">
          <h1 className="dashboard-title">Biodiversity and Research Department</h1>
        </div>

        <p className="dashboard-subtitle">
          {summary?.parkName ?? 'Nyandungu Eco-Park'} · {summary?.location ?? 'Kigali, Rwanda'} ·{' '}
          {summary?.parkSize ?? '219 Ha'}
          <br />
          <span style={{ fontSize: 13, opacity: 0.85 }}>
            Interactive dashboard · Survey {summary?.surveyYear ?? '2025/2026'}
          </span>
        </p>

        {(section === 'overview' || section === 'biodiversity') && (
          <>
            {section === 'overview' && (
              <>
                <div className="kpi-row">
                  {[
                    { label: 'Species recorded', value: kpis.species },
                    { label: 'Students reached', value: kpis.students.toLocaleString() },
                    { label: 'School visits logged', value: kpis.visits },
                    { label: 'Community activities', value: kpis.activities },
                    { label: 'Complementary pass total', value: kpis.passes.toLocaleString() },
                    { label: 'Waste collected (kg)', value: kpis.wasteKg.toLocaleString() },
                  ].map(k => (
                    <div key={k.label} className="glass-card kpi-tile">
                      <p className="heading kpi-value">{k.value}</p>
                      <p className="kpi-label">{k.label}</p>
                    </div>
                  ))}
                </div>

                <section className="taxa-section-float">
                  <SectionTitle>Species by taxa (2025)</SectionTitle>
                  <div className="taxa-row-scroll">
                  <div className="taxa-grid taxa-grid--row">
                    {taxaCards.map(card => (
                      <div
                        key={card.taxa}
                        className="taxa-card taxa-card--compact"
                      >
                        <div className="taxa-card-icon-float" aria-hidden>
                          <TaxaIcon taxa={card.taxa} size={52} />
                        </div>
                        <span
                          className="taxa-card-badge"
                          style={{
                            background: card.stable ? 'rgba(74,94,79,0.15)' : 'rgba(12,96,56,0.15)',
                            color: card.stable ? 'var(--text-secondary)' : 'var(--accent-text)',
                          }}
                        >
                          {card.badge}
                        </span>
                        <p className="taxa-card-label" style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center', fontSize: 10 }}>
                          {card.taxa}
                        </p>
                        <p className="heading taxa-card-count" style={{ color: 'var(--accent-text)', margin: 0, lineHeight: 1 }}>
                          {card.count}
                        </p>
                      </div>
                    ))}
                  </div>
                  </div>
                </section>
              </>
            )}

            <SectionTitle>Biodiversity survey</SectionTitle>
            <div className="dashboard-charts-grid">
              <ChartCard title="Species count: 2023 vs 2025">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barBiodiversity} margin={{ top: 8, right: 8, left: -10, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="taxa" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tt} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="2023" name="2023 Baseline" fill={c.secondary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="2025" name="2025 Current" fill={c.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Species share by taxa (2025)" content>
                <TaxaShareBarChart data={donutBiodiversity} total={summary?.totalSpecies ?? 870} />
              </ChartCard>
            </div>
          </>
        )}

        {(section === 'overview' || section === 'education') && schoolQuarterly.length > 0 && (
          <>
            <SectionTitle>Education & school visits</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard
                title="Quarterly student visits"
                description="Students reached per quarter (Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec, Q1 Jan–Mar) compared with the 500-student quarterly target."
                tall
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schoolQuarterly} margin={{ top: 12, right: 8, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tt} />
                    <ReferenceLine
                      y={STUDENT_TARGET}
                      stroke="#F5A623"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      label={{ value: 'Target: 500', position: 'insideTopRight', fill: '#F5A623', fontSize: 11, fontFamily: 'Poppins' }}
                    />
                    <Bar dataKey="students" name="Students" fill={c.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}

        {(section === 'overview' || section === 'community') && (
          <>
            <SectionTitle>Community engagement</SectionTitle>
            <div className="dashboard-charts-grid dashboard-charts-grid--single">
              <ChartCard
                title="Community outreach by month"
                description="Dual scale: left axis = # activities (typically under 20); right axis = participants (from activity attendance fields)."
                tall
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={communityByMonth} margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
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
                    <Bar yAxisId="left" dataKey="activities" name="# Activities" fill={c.primary} radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar yAxisId="right" dataKey="participants" name="Participants (est.)" fill={c.accent} radius={[4, 4, 0, 0]} barSize={16} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <SectionTitle>Complementary pass</SectionTitle>
            <div className="dashboard-charts-grid">
              <ChartCard title="Monthly complementary pass">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={passesMonthly} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 9 }} angle={-35} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: c.tick, fontFamily: 'Poppins', fontSize: 11 }} axisLine={false} />
                    <Tooltip {...tt} />
                    <Area type="monotone" dataKey="totalPasses" name="Complementary pass" stroke={c.accent} fill={c.accent} fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Top groups by complementary pass" content>
                <div className="data-table-wrap chart-table-in-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Complementary pass</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complementaryPassByGroup.map((row, i) => (
                        <tr key={i}>
                          <td>{row.group}</td>
                          <td>{row.complementaryPasses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </div>
          </>
        )}

        {(section === 'overview' || section === 'waste') && (
          <>
            <SectionTitle>Waste management</SectionTitle>
            <WasteDashboardCharts data={wasteData} />
          </>
        )}

        {(section === 'overview' || section === 'water') && (
          <>
            <SectionTitle>Water quality</SectionTitle>
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
              placeholder="Search schools, activities, water parameters, sites…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
              {[
                { id: 'schools', label: `School visits (${schools?.individualVisits.length ?? 0})` },
                { id: 'community', label: `Activities (${community.length})` },
                { id: 'passes', label: `Complementary pass (${passes?.detail.length ?? 0})` },
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
                      <th>School</th>
                      <th>Students</th>
                      <th>Teachers</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchoolVisits.map((row, i) => (
                      <tr key={i}>
                        <td>{row.month}</td>
                        <td>{row.school}</td>
                        <td>{row.students ?? '—'}</td>
                        <td>{row.teachers ?? '—'}</td>
                        <td>{row.notes ?? '—'}</td>
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
                      <th>Participants</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommunity.map((row, i) => (
                      <tr key={i}>
                        <td>{row.month}</td>
                        <td>{row.activity}</td>
                        <td>{row.participants}</td>
                        <td>{row.notes ?? '—'}</td>
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
  );
}
