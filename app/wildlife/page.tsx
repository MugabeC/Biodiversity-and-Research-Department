'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTooltipProps, useChartColors } from '@/app/components/dashboard/chartTheme';
import { fetchObservations, fetchSyncStatus, rwandaToday, summarize, type Period, type SyncStatus } from '@/app/lib/wildlife';

const INAT_URL = 'https://www.inaturalist.org/observations?nelat=-1.944868&nelng=30.163748&swlat=-1.966359&swlng=30.132534';
const EBIRD_URL = 'https://ebird.org/hotspot/L4235382';
const n = (v: number) => v.toLocaleString('en-US');

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="glass-card wildlife-stat">
      <span className="doc-upload-help">{label}</span>
      <span className="wildlife-stat-value">{value}</span>
      {note && <span className="doc-upload-meta">{note}</span>}
    </div>
  );
}

function PeriodChart({ data, c }: { data: Period[]; c: ReturnType<typeof useChartColors> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.tick }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: c.tick }} />
        <Tooltip {...chartTooltipProps(c)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="species" name="Species recorded" fill={c.primary} radius={[3, 3, 0, 0]} />
        <Bar dataKey="newSpecies" name="First records" fill={c.accent} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function WildlifePage() {
  const c = useChartColors();
  const [obs, setObs] = useState<Awaited<ReturnType<typeof fetchObservations>> | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    fetchObservations().then(setObs).catch(() => setError('Could not load the wildlife records. Please refresh the page.'));
    fetchSyncStatus().then(setStatus);
  }, []);

  const today = rwandaToday();
  const s = useMemo(() => (obs ? summarize(obs, today) : null), [obs, today]);

  return (
    <div className="report-page wildlife-page">
      <h1 className="heading" style={{ margin: '0 0 6px' }}>Wildlife records</h1>
      <p className="doc-upload-help" style={{ marginBottom: '1.5rem', maxWidth: 720 }}>
        Species recorded inside Nyandungu Eco-Park by park staff, researchers and visitors on iNaturalist and eBird. Only records confirmed by other identifiers
        count. These records are a lower bound: they show what people have photographed and logged, not everything that lives in the park.
      </p>

      {error && <p className="doc-upload-error" role="alert">{error}</p>}
      {!s && !error && <p className="doc-upload-help">Loading…</p>}

      {s && (
        <>
          <div className="wildlife-stats">
            <Stat label="Species recorded, all time" value={n(s.totalSpecies)} note={s.firstDate ? `Since ${s.firstDate.slice(0, 4)}` : undefined} />
            <Stat label={`Species recorded in ${s.thisYear.key}`} value={n(s.thisYear.species)} note={`${n(s.thisYear.newSpecies)} first records`} />
            <Stat label="Species recorded this month" value={n(s.thisMonth.species)} note={`${n(s.thisMonth.observations)} observations`} />
            <Stat label="Observations, all time" value={n(s.totalObservations)} />
          </div>

          <div className="glass-card wildlife-card">
            <h2 className="doc-upload-title">Species recorded each month</h2>
            <p className="doc-upload-help">Different species recorded in the month, and species recorded in the park for the first time that month. Last 24 months.</p>
            <PeriodChart data={s.monthly} c={c} />
          </div>

          <div className="glass-card wildlife-card">
            <h2 className="doc-upload-title">Species recorded each year</h2>
            <PeriodChart data={s.yearly} c={c} />
            <table className="report-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Year</th><th>Species</th><th>First records</th><th>Observations</th></tr></thead>
              <tbody>{[...s.yearly].reverse().map(p => <tr key={p.key}><td>{p.label}</td><td>{n(p.species)}</td><td>{n(p.newSpecies)}</td><td>{n(p.observations)}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="wildlife-two">
            <div className="glass-card wildlife-card">
              <h2 className="doc-upload-title">Species by group</h2>
              <table className="report-table report-table--small">
                <tbody>{s.groups.map(g => <tr key={g.group}><td>{g.group}</td><td>{n(g.species)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="glass-card wildlife-card">
              <h2 className="doc-upload-title">New to the park, last 4 months</h2>
              {s.recentNew.length === 0 ? <p className="doc-upload-help">No new species in this period.</p> : (
                <table className="report-table report-table--small">
                  <tbody>{s.recentNew.slice(0, 12).map(r => (
                    <tr key={r.name}><td>{r.common ? `${r.common} ` : ''}<em>{r.name}</em><br /><span className="doc-upload-meta">{r.group}</span></td><td>{r.date}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <div className="glass-card wildlife-card">
        <h2 className="doc-upload-title">Add your own records</h2>
        <p className="doc-upload-help" style={{ maxWidth: 720 }}>
          Anyone can contribute. Photograph a plant or animal inside the park and upload it to iNaturalist (free), or submit a checklist to the Nyandungu hotspot on eBird.
          An iNaturalist record counts here once other identifiers agree on the species. Records appear on this page within a day.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          <a className="dash-report-link" href={INAT_URL} target="_blank" rel="noreferrer">iNaturalist observations in the park →</a>
          {'   '}
          <a className="dash-report-link" href={EBIRD_URL} target="_blank" rel="noreferrer">Nyandungu Eco-Park hotspot on eBird →</a>
        </p>
        <p className="doc-upload-meta" style={{ marginTop: 12, maxWidth: 720 }}>
          Observations belong to the people who made them. Data from iNaturalist (research grade) and eBird{status?.ebird_enabled ? '' : ' (eBird is being connected)'}.
          {status?.last_ok ? ` Last updated ${status.last_ok.slice(0, 10)}.` : ''} Records with hidden locations, planted or captive organisms, and observations not identified to species are left out.
        </p>
      </div>
    </div>
  );
}
