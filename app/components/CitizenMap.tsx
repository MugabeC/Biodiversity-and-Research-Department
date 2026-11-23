'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerSpecification, Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { fetchMapGeoJson, MAP_GEOJSON } from '@/app/lib/mapGeojson';
import { fetchMapObservations, wildlifeDots, type MapObservation } from '@/app/lib/wildlife';

const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

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
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => { fetchMapObservations().then(setObs).catch(() => setObs([])); }, []);

  const [first, last] = useMemo(() => {
    const ys = obs.map(o => Number(o.observed_on.slice(0, 4)));
    return ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 0];
  }, [obs]);
  const shownYear = year ?? last;

  // draw the dots for the chosen year
  useEffect(() => {
    const src = map.current?.getSource('citizen-src') as { setData: (d: unknown) => void } | undefined;
    if (ready && src && shownYear) src.setData(wildlifeDots(obs, String(shownYear), true));
  }, [ready, obs, shownYear]);

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
        zoom: 14.2,
        cooperativeGestures: true,
      });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left');
      m.on('load', async () => {
        try {
          const boundary = await fetchMapGeoJson(MAP_GEOJSON.boundary);
          m.addSource('boundary-src', { type: 'geojson', data: boundary });
          let minX = 180, minY = 90, maxX = -180, maxY = -90;
          const walk = (c: unknown) => {
            if (Array.isArray(c) && typeof c[0] === 'number') { const [x, y] = c as number[]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
            else if (Array.isArray(c)) c.forEach(walk);
          };
          for (const f of (boundary as { features?: { geometry?: { coordinates?: unknown } }[] }).features ?? []) walk(f.geometry?.coordinates);
          if (maxX > minX) m.fitBounds([[minX, minY], [maxX, maxY]], { padding: 28, duration: 0 });
          m.addLayer({ id: 'boundary', type: 'line', source: 'boundary-src', paint: { 'line-color': '#E53935', 'line-width': 1.5 } } as LayerSpecification);
        } catch (e) { console.error(e); }
        m.addSource('citizen-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({
          id: 'citizen-dots', type: 'circle', source: 'citizen-src',
          paint: {
            'circle-color': '#2EBD59', 'circle-opacity': 0.65,
            'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0.6, 'circle-stroke-opacity': 0.7,
            'circle-radius': ['interpolate', ['linear'], ['get', 'records'], 1, 3.5, 5, 5.5, 20, 8, 60, 12, 200, 17],
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
      {canSlide && (
        <ol className="year-steps" aria-label="Show records up to this year">
          {Array.from({ length: last - first + 1 }, (_, i) => first + i).map(y => (
            <li key={y} className={y <= shownYear ? 'on' : ''}>
              <button type="button" aria-pressed={y === shownYear} onClick={() => setYear(y)}><i aria-hidden /><span>{y}</span></button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
