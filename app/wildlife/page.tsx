'use client';

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CitizenMap from '@/app/components/CitizenMap';
import { chartTooltipProps, useChartColors } from '@/app/components/dashboard/chartTheme';
import { fetchObservations, rwandaToday, summarize, type Period } from '@/app/lib/wildlife';

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

function QuarterChart({ data, c }: { data: Period[]; c: ReturnType<typeof useChartColors> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: c.tick }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: c.tick }} />
        <Tooltip {...chartTooltipProps(c)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="species" name="Species recorded" stroke={c.primary} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="newSpecies" name="First records" stroke={c.accent} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** One circle per year. Circle area follows the species count; the ring shows how many of them were first records. */
function YearBubbles({ data }: { data: Period[] }) {
  const max = Math.max(1, ...data.map(p => p.species));
  return (
    <ol className="year-bubbles">
      {data.map(p => {
        const size = 60 + Math.sqrt(p.species / max) * 64;
        const share = p.species ? Math.round((p.newSpecies / p.species) * 100) : 0;
        return (
          <li key={p.key} className="year-bubble">
            <div className="year-bubble-ring" style={{ width: size, height: size, background: `conic-gradient(#e8a317 ${share}%, var(--ring-rest) 0)` }}>
              <div className="year-bubble-core"><strong>{n(p.species)}</strong>{size >= 84 && <span>species</span>}</div>
            </div>
            <span className="year-bubble-year">{p.label}</span>
            <span className="year-bubble-note">{n(p.newSpecies)} first records</span>
            <span className="year-bubble-note">{n(p.observations)} observations</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function WildlifePage() {
  const c = useChartColors();
  const [obs, setObs] = useState<Awaited<ReturnType<typeof fetchObservations>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchObservations().then(setObs).catch(() => setError('Could not load the wildlife records. Please refresh the page.'));
  }, []);

  const today = rwandaToday();
  const s = useMemo(() => (obs ? summarize(obs, today) : null), [obs, today]);

  return (
    <div className="report-page wildlife-page">
      <h1 className="sr-only">Citizen Science</h1>
      <p className="doc-upload-help" style={{ marginBottom: '1.5rem', maxWidth: 720 }}>
        Species recorded inside Nyandungu Eco-Park by park staff, researchers and visitors on iNaturalist and eBird.
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
            <h2 className="doc-upload-title">Species recorded each quarter</h2>
            <QuarterChart data={s.quarterly} c={c} />
          </div>

          <div className="glass-card wildlife-card">
            <h2 className="doc-upload-title">Species recorded each year</h2>
            <YearBubbles data={s.yearly} />
            <p className="year-bubble-legend"><i aria-hidden /> Amber ring: share of the year&apos;s species that were first records for the park. Circle size: species recorded.</p>
          </div>

          <div className="glass-card wildlife-card">
            <h2 className="doc-upload-title">Where records were made</h2>
            <CitizenMap />
          </div>

          <div className="wildlife-two">
            <div className="glass-card wildlife-card">
              <h2 className="doc-upload-title">Species by group</h2>
              <table className="report-table report-table--small">
                <tbody>{s.groups.map(g => <tr key={g.group}><td>{g.group}</td><td>{n(g.species)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="glass-card wildlife-card">
              <h2 className="doc-upload-title">Newest species in the park</h2>
              {s.recentNew.length === 0 ? <p className="doc-upload-help">No new species in the last 4 months.</p> : (
                <table className="report-table report-table--small">
                  <tbody>{s.recentNew.slice(0, 5).map(r => (
                    <tr key={r.name}><td>{r.common ? `${r.common} ` : ''}<em>{r.name}</em><br /><span className="doc-upload-meta">{r.group}</span></td><td style={{ whiteSpace: 'nowrap' }}>{r.date}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <div className="glass-card wildlife-card">
        <h2 className="doc-upload-title">Join citizen science</h2>
        <div className="wildlife-two">
          <div>
            <h3 className="wildlife-how-title">iNaturalist: plants, animals, insects and fungi</h3>
            <ol className="wildlife-steps">
              <li>Create a free account at inaturalist.org, or in the iNaturalist app.</li>
              <li>Photograph the plant or animal inside the park, with your phone location turned on.</li>
              <li>Upload the photo and suggest a name. The record counts here once other identifiers agree.</li>
            </ol>
          </div>
          <div>
            <h3 className="wildlife-how-title">eBird: birds</h3>
            <ol className="wildlife-steps">
              <li>Create a free account at ebird.org, or in the eBird app.</li>
              <li>Start a checklist and choose the Nyandungu Eco-Park hotspot.</li>
              <li>List every bird you see or hear, then submit the checklist.</li>
            </ol>
          </div>
        </div>
        <div className="wildlife-btn-row wildlife-btn-row--center">
          <a className="dash-report-btn" href={INAT_URL} target="_blank" rel="noreferrer">iNaturalist records</a>
          <a className="dash-report-btn" href={EBIRD_URL} target="_blank" rel="noreferrer">eBird records</a>
        </div>
      </div>
    </div>
  );
}
