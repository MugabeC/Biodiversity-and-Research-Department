'use client';

import { useEffect, useRef, useState } from 'react';

// ── Layer config ──────────────────────────────────────────────────────────────

const LAYER_CONFIG = [
  { id: 'park-boundary', label: 'Park Boundary',      color: '#0C6038', defaultOn: true  },
  { id: 'restored-area', label: 'Restored Area',       color: '#F5A623', defaultOn: true  },
  { id: 'trails',        label: 'Trails & Walkways',   color: '#c77dff', defaultOn: false },
  { id: 'drainage',      label: 'Drainage & Streams',  color: '#4895ef', defaultOn: false },
  { id: 'ponds',         label: 'Ponds & Wet Areas',   color: '#52b788', defaultOn: false },
  { id: 'vegetation',    label: 'Vegetation',           color: '#2D4C39', defaultOn: false },
  { id: 'roads',         label: 'Roads',                color: '#adb5bd', defaultOn: false },
  { id: 'buildings',     label: 'Buildings',            color: '#6C2728', defaultOn: false },
];

// MapLibre layer IDs associated with each toggle (some have fill + line sub-layers)
const LAYER_MAP_IDS: Record<string, string[]> = {
  'park-boundary': ['park-boundary-line'],
  'restored-area': ['restored-area-fill', 'restored-area-line'],
  'trails':        ['trails-line'],
  'drainage':      ['drainage-line'],
  'ponds':         ['ponds-circle'],
  'vegetation':    ['vegetation-fill'],
  'roads':         ['roads-line'],
  'buildings':     ['buildings-circle'],
};

// ── GeoJSON filter helpers ────────────────────────────────────────────────────

function filterFeatures(features: any[], layers: string[]): any {
  return {
    type: 'FeatureCollection',
    features: features.filter(f => layers.includes(f.properties?.Layer)),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [is3D, setIs3D] = useState(true);
  const [layerOn, setLayerOn] = useState<Record<string, boolean>>(
    Object.fromEntries(LAYER_CONFIG.map(l => [l.id, l.defaultOn]))
  );
  const [mapReady, setMapReady] = useState(false);

  // ── Init map (client-only) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: any;

    import('maplibre-gl').then(({ default: maplibregl }) => {
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [30.1491, -1.9555],
        zoom: 15,
        pitch: 45,
        bearing: -17,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', async () => {
        // Fetch all GeoJSON sources
        const [boundary, nyandungu, polylines, dots, polygon] = await Promise.all([
          fetch('/data/geojson/Surveyed_boundary.geojson').then(r => r.json()),
          fetch('/data/geojson/Nyandungu.geojson').then(r => r.json()),
          fetch('/data/geojson/Topo_polylines.geojson').then(r => r.json()),
          fetch('/data/geojson/Topo_dots.geojson').then(r => r.json()),
          fetch('/data/geojson/Topo_polygon.geojson').then(r => r.json()),
        ]);

        // ── Add sources ──────────────────────────────────────────────────────
        map.addSource('park-boundary-src', { type: 'geojson', data: boundary });
        map.addSource('restored-area-src', { type: 'geojson', data: nyandungu });

        map.addSource('trails-src', {
          type: 'geojson',
          data: filterFeatures(polylines.features, ['PEDESTRIAN WALKWAYS AND TRAILS']),
        });
        map.addSource('drainage-src', {
          type: 'geojson',
          data: filterFeatures(polylines.features, ['DRAINAGE', 'MASONRY DRAINAGE']),
        });
        map.addSource('ponds-src', {
          type: 'geojson',
          data: filterFeatures(dots.features, ['PONDS', 'WET AREA']),
        });
        map.addSource('vegetation-src', {
          type: 'geojson',
          data: filterFeatures(polygon.features, ['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN']),
        });
        map.addSource('roads-src', {
          type: 'geojson',
          data: filterFeatures(polylines.features, ['MAIN ROAD_PEDESTRIAN', 'INTERNAL SERVICE ROAD', 'EXISTING EARTHROAD']),
        });
        map.addSource('buildings-src', {
          type: 'geojson',
          data: filterFeatures(dots.features, ['EXISTING BUILDING']),
        });

        // ── Add layers ───────────────────────────────────────────────────────
        map.addLayer({
          id: 'restored-area-fill',
          type: 'fill',
          source: 'restored-area-src',
          paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.25 },
        });
        map.addLayer({
          id: 'restored-area-line',
          type: 'line',
          source: 'restored-area-src',
          paint: { 'line-color': '#F5A623', 'line-width': 2 },
        });

        map.addLayer({
          id: 'vegetation-fill',
          type: 'fill',
          source: 'vegetation-src',
          paint: { 'fill-color': '#2D4C39', 'fill-opacity': 0.4 },
        });

        map.addLayer({
          id: 'roads-line',
          type: 'line',
          source: 'roads-src',
          paint: { 'line-color': '#adb5bd', 'line-width': 2 },
        });

        map.addLayer({
          id: 'drainage-line',
          type: 'line',
          source: 'drainage-src',
          paint: { 'line-color': '#4895ef', 'line-width': 1.5 },
        });

        map.addLayer({
          id: 'trails-line',
          type: 'line',
          source: 'trails-src',
          paint: {
            'line-color': '#c77dff',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });

        map.addLayer({
          id: 'ponds-circle',
          type: 'circle',
          source: 'ponds-src',
          paint: { 'circle-color': '#52b788', 'circle-radius': 6, 'circle-opacity': 0.8 },
        });

        map.addLayer({
          id: 'buildings-circle',
          type: 'circle',
          source: 'buildings-src',
          paint: { 'circle-color': '#6C2728', 'circle-radius': 5 },
        });

        map.addLayer({
          id: 'park-boundary-line',
          type: 'line',
          source: 'park-boundary-src',
          paint: { 'line-color': '#0C6038', 'line-width': 3, 'line-opacity': 0.9 },
        });

        // Apply initial visibility from state
        LAYER_CONFIG.forEach(({ id, defaultOn }) => {
          const visibility = defaultOn ? 'visible' : 'none';
          (LAYER_MAP_IDS[id] || []).forEach(lid => {
            if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visibility);
          });
        });

        setMapReady(true);
      });

      mapRef.current = map;
    });

    return () => { map?.remove(); mapRef.current = null; };
  }, []);

  // ── 2D/3D toggle ─────────────────────────────────────────────────────────
  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    map.easeTo({ pitch: next ? 45 : 0, bearing: next ? -17 : 0, duration: 600 });
    setIs3D(next);
  };

  // ── Layer visibility toggle ───────────────────────────────────────────────
  const toggleLayer = (id: string) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const nextOn = !layerOn[id];
    const visibility = nextOn ? 'visible' : 'none';
    (LAYER_MAP_IDS[id] || []).forEach(lid => {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visibility);
    });
    setLayerOn(prev => ({ ...prev, [id]: nextOn }));
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const GLASS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(12,96,56,0.13)',
    border: '1px solid rgba(255,255,255,0.7)',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 68px)' }}>

      {/* Map container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* ── 2D/3D Toggle ── */}
      <button
        onClick={toggle3D}
        style={{
          position: 'absolute',
          top: '16px',
          right: '56px',
          zIndex: 10,
          padding: '8px 20px',
          borderRadius: '9999px',
          border: 'none',
          background: '#ffffff',
          color: '#0C6038',
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          transition: 'background 0.2s ease',
        }}
      >
        {is3D ? '2D' : '3D'}
      </button>

      {/* ── Layer Toggle Panel ── */}
      <div style={{
        ...GLASS,
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        padding: '16px',
        minWidth: '200px',
      }}>
        <p style={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          color: '#0C6038',
          margin: '0 0 12px',
        }}>
          Map Layers
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {LAYER_CONFIG.map(({ id, label, color }) => (
            <label
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 400,
                  fontSize: '13px',
                  color: '#1A2E1F',
                }}>
                  {label}
                </span>
              </div>
              <ToggleSwitch
                on={layerOn[id]}
                color={color}
                onChange={() => toggleLayer(id)}
              />
            </label>
          ))}
        </div>
      </div>

      {/* ── Info Card ── */}
      <div style={{
        ...GLASS,
        position: 'absolute',
        bottom: '32px',
        right: '16px',
        zIndex: 10,
        padding: '12px 16px',
      }}>
        <p style={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          color: '#1A2E1F',
          margin: '0 0 2px',
        }}>
          Nyandungu Eco-Park
        </p>
        <p style={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 400,
          fontSize: '12px',
          color: '#4A5E4F',
          margin: '0 0 2px',
        }}>
          164 hectares · Kigali, Rwanda
        </p>
        <p style={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 400,
          fontSize: '11px',
          color: '#808847',
          margin: 0,
        }}>
          2025 Biodiversity Survey
        </p>
      </div>

    </div>
  );
}

// ── Toggle Switch component ───────────────────────────────────────────────────

function ToggleSwitch({
  on,
  color,
  onChange,
}: {
  on: boolean;
  color: string;
  onChange: () => void;
}) {
  return (
    <div
      onClick={onChange}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: '9999px',
        background: on ? color : '#D1D5DB',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.2s ease',
        cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '3px',
        left: on ? '19px' : '3px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s ease',
      }} />
    </div>
  );
}
