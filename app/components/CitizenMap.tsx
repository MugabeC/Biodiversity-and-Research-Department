'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerSpecification, Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { fetchMapGeoJson, MAP_GEOJSON } from '@/app/lib/mapGeojson';
import { fetchMapObservations, wildlifeDots, type MapObservation } from '@/app/lib/wildlife';

const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const n = (v: number) => v.toLocaleString('en-US');

type Info = { title: string; line: string; source: string; names: string[] };

function describe(p: Record<string, unknown>): Info {
  const species = Number(p.species), records = Number(p.records);
  const names = String(p.names ?? '').split('|').filter(Boolean).map(x => { const [label, date] = x.split('~'); return `${label}, ${date}`; });
  return {
    title: `${species} species · ${records} record${records === 1 ? '' : 's'}`,
    line: p.first === p.last ? String(p.first) : `${p.first} to ${p.last}`,
    source: String(p.source),
    names: [...names.slice(0, 6), ...(species > 6 ? [`and ${species - 6} more`] : [])],
  };
}

/** Where citizen science records were made. A year slider shows the records building up over the years. */
export default function CitizenMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [obs, setObs] = useState<MapObservation[]>([]);
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => { fetchMapObservations().then(setObs).catch(() => setObs([])); }, []);

  const [first, last] = useMemo(() => {
    const ys = obs.map(o => Number(o.observed_on.slice(0, 4)));
    return ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 0];
  }, [obs]);
  const shownYear = year ?? last;

  const totals = useMemo(() => {
    const names = new Set<string>();
    let records = 0;
    for (const o of obs) if (Number(o.observed_on.slice(0, 4)) <= shownYear) { names.add(o.scientific_name); records += 1; }
    return { species: names.size, records };
  }, [obs, shownYear]);

  // draw the dots for the chosen year
  useEffect(() => {
    const src = map.current?.getSource('citizen-src') as { setData: (d: unknown) => void } | undefined;
    if (ready && src && shownYear) src.setData(wildlifeDots(obs, String(shownYear), true));
  }, [ready, obs, shownYear]);

  // play: step through the years, then stop at the latest
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setYear(y => {
        const next = (y ?? last) + 1;
        if (next >= last) setPlaying(false);
        return Math.min(next, last);
      });
    }, 1300);
    return () => clearInterval(t);
  }, [playing, last]);

  useEffect(() => {
    if (map.current || !box.current) return;
    let gone = false;
    (async () => {
      const maplibregl = await import('maplibre-gl');
      if (gone || !box.current) return;
      maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
      const m = new maplibregl.Map({
        container: box.current,
        style: {
          version: 8,
          sources: { sat: { type: 'raster', tiles: [SATELLITE], tileSize: 256, attribution: 'Tiles © Esri' } },
          layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
        } as StyleSpecification,
        center: [30.1491, -1.9555],
        zoom: 14.6,
        cooperativeGestures: true,
      });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left');
      m.on('load', async () => {
        try {
          const boundary = await fetchMapGeoJson(MAP_GEOJSON.boundary);
          m.addSource('boundary-src', { type: 'geojson', data: boundary });
          m.addLayer({ id: 'boundary', type: 'line', source: 'boundary-src', paint: { 'line-color': '#E53935', 'line-width': 1.5 } } as LayerSpecification);
        } catch (e) { console.error(e); }
        m.addSource('citizen-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({
          id: 'citizen-dots', type: 'circle', source: 'citizen-src',
          paint: {
            'circle-color': '#2EBD59', 'circle-opacity': 0.65,
            'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0.6, 'circle-stroke-opacity': 0.7,
            'circle-radius': ['interpolate', ['linear'], ['get', 'species'], 1, 3.5, 5, 5, 20, 7, 60, 10],
          },
        } as LayerSpecification);
        const pick = (e: MapMouseEvent) => {
          const f = m.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['citizen-dots'] })[0] as MapGeoJSONFeature | undefined;
          return f ? describe(f.properties) : null;
        };
        m.on('mousemove', e => { const i = pick(e); m.getCanvas().style.cursor = i ? 'pointer' : ''; setInfo(i); });
        m.on('mouseout', () => setInfo(null));
        m.on('click', e => setInfo(pick(e)));
        setReady(true);
      });
    })();
    return () => { gone = true; if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  const canSlide = last > first;
  return (
    <div className="citizen-map">
      <div className="citizen-map-canvas">
        <div ref={box} style={{ width: '100%', height: '100%' }} role="region" aria-label="Map of citizen science records in the park" />
        {info && (
          <div className="citizen-map-info">
            <p className="map-info-title">{info.title}</p>
            <p className="map-info-line">{info.line}</p>
            <p className="map-info-meta">{info.source}</p>
            {info.names.map((t, i) => <p key={i} className="map-info-meta">{t}</p>)}
          </div>
        )}
      </div>
      <div className="citizen-map-controls">
        <button
          type="button"
          className="doc-action-btn doc-action-btn--primary"
          disabled={!canSlide}
          onClick={() => { if (!playing && shownYear >= last) setYear(first); setPlaying(p => !p); }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range" min={first} max={last || 1} step={1} value={shownYear || 0} disabled={!canSlide}
          aria-label="Show records up to this year"
          onChange={e => { setPlaying(false); setYear(Number(e.target.value)); }}
        />
        <span className="citizen-map-year">{first && first !== shownYear ? `${first} to ${shownYear}` : shownYear || ''}</span>
      </div>
      <p className="citizen-map-note">{n(totals.species)} species · {n(totals.records)} records up to {shownYear || 'now'}. Bigger dots mean more species recorded at that place. Hover or tap a dot to see the species.</p>
    </div>
  );
}
