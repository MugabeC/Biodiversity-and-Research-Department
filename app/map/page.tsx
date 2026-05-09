'use client';

import { useEffect, useRef, useState } from 'react';

// ── Map style options ─────────────────────────────────────────────────────────

const MAP_STYLES = [
  { id: 'satellite', label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { id: 'street',    label: 'Street',    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}' },
  { id: 'terrain',   label: 'Terrain',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}' },
] as const;

type StyleId = typeof MAP_STYLES[number]['id'];

// ── Layer config ──────────────────────────────────────────────────────────────

const LAYERS = [
  { id: 'park-boundary', label: 'Park Boundary',     color: '#000000', mapIds: ['park-boundary'] },
  { id: 'restored-area', label: 'Restored Area',      color: '#F5A623', mapIds: ['restored-area-fill', 'restored-area-line'] },
  { id: 'trails',        label: 'Trails & Walkways',  color: '#c77dff', mapIds: ['trails'] },
  { id: 'drainage',      label: 'Drainage & Streams', color: '#4895ef', mapIds: ['drainage'] },
  { id: 'ponds',         label: 'Ponds & Wet Areas',  color: '#52b788', mapIds: ['ponds'] },
  { id: 'vegetation',    label: 'Vegetation',          color: '#8DA750', mapIds: ['vegetation'] },
  { id: 'roads',         label: 'Roads',               color: '#adb5bd', mapIds: ['roads'] },
  { id: 'zones',         label: 'Zones',               color: '#4895ef', mapIds: ['zones-fill', 'zones-line'] },
];

const INIT_VISIBILITY: Record<string, boolean> = {
  'park-boundary': true,
  'restored-area': true,
  'trails':        true,
  'drainage':      true,
  'ponds':         true,
  'vegetation':    true,
  'roads':         true,
  'zones':         true,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const mapContainer  = useRef<HTMLDivElement>(null);
  const map           = useRef<any>(null);
  const visibilityRef = useRef<Record<string, boolean>>({ ...INIT_VISIBILITY });

  const [is3D,        setIs3D]        = useState(true);
  const [layerStates, setLayerStates] = useState<Record<string, boolean>>({ ...INIT_VISIBILITY });
  const [mapStyle,    setMapStyle]    = useState<StyleId>('satellite');

  // ── Layer toggle ──────────────────────────────────────────────────────────
  const handleToggle = (key: string, layerIds: string[]) => {
    const newVal = !visibilityRef.current[key];
    visibilityRef.current[key] = newVal;
    setLayerStates(prev => ({ ...prev, [key]: newVal }));
    if (map.current) {
      layerIds.forEach(id => {
        if (map.current.getLayer(id)) {
          map.current.setLayoutProperty(id, 'visibility', newVal ? 'visible' : 'none');
        }
      });
    }
  };

  // ── 2D/3D ─────────────────────────────────────────────────────────────────
  const toggle3D = () => {
    if (!map.current) return;
    const next3D = !is3D;
    map.current.easeTo({ pitch: next3D ? 45 : 0, bearing: next3D ? -17 : 0, duration: 600 });
    setIs3D(next3D);
  };

  // ── Style switcher ────────────────────────────────────────────────────────
  const switchMapStyle = (styleId: StyleId, url: string) => {
    setMapStyle(styleId);
    if (!map.current) return;
    const m = map.current;
    if (m.getLayer('esri-satellite-layer')) m.removeLayer('esri-satellite-layer');
    if (m.getSource('esri-satellite'))      m.removeSource('esri-satellite');
    m.addSource('esri-satellite', {
      type: 'raster',
      tiles: [url],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    });
    const before = m.getLayer('park-boundary') ? 'park-boundary' : undefined;
    m.addLayer({ id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite' }, before);
  };

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    const initMap = async () => {
      const maplibregl = (await import('maplibre-gl')).default;

      map.current = new maplibregl.Map({
        container: mapContainer.current!,
        style: {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: [MAP_STYLES[0].url],
              tileSize: 256,
              attribution: 'Tiles © Esri',
            },
          },
          layers: [{ id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite' }],
        } as any,
        center: [30.1491, -1.9555],
        zoom: 15,
        pitch: 45,
        bearing: -17,
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.current.on('load', async () => {
        try {
          // Park boundary
          const boundary = await fetch('/data/geojson/Surveyed_boundary.geojson').then(r => r.json());
          map.current.addSource('park-boundary-src', { type: 'geojson', data: boundary });
          map.current.addLayer({
            id: 'park-boundary', type: 'line', source: 'park-boundary-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#000000', 'line-width': 2.5, 'line-opacity': 0.9 },
          });

          // Restored area — fill + outline
          const restored = await fetch('/data/geojson/Nyandungu.geojson').then(r => r.json());
          map.current.addSource('restored-src', { type: 'geojson', data: restored });
          map.current.addLayer({
            id: 'restored-area-fill', type: 'fill', source: 'restored-src',
            layout: { visibility: 'visible' },
            paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.2 },
          });
          map.current.addLayer({
            id: 'restored-area-line', type: 'line', source: 'restored-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#F5A623', 'line-width': 1.5 },
          });

          // Polylines
          const polylines = await fetch('/data/geojson/Topo_polylines.geojson').then(r => r.json());

          const trailFeatures = polylines.features.filter((f: any) => f.properties.Layer === 'PEDESTRIAN WALKWAYS AND TRAILS');
          map.current.addSource('trails-src', { type: 'geojson', data: { type: 'FeatureCollection', features: trailFeatures } });
          map.current.addLayer({
            id: 'trails', type: 'line', source: 'trails-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#c77dff', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2] },
          });

          const drainageFeatures = polylines.features.filter((f: any) => ['DRAINAGE', 'MASONRY DRAINAGE'].includes(f.properties.Layer));
          map.current.addSource('drainage-src', { type: 'geojson', data: { type: 'FeatureCollection', features: drainageFeatures } });
          map.current.addLayer({
            id: 'drainage', type: 'line', source: 'drainage-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#4895ef', 'line-width': 1, 'line-opacity': 0.6 },
          });

          const roadFeatures = polylines.features.filter((f: any) => ['MAIN ROAD_PEDESTRIAN', 'INTERNAL SERVICE ROAD', 'EXISTING EARTHROAD'].includes(f.properties.Layer));
          map.current.addSource('roads-src', { type: 'geojson', data: { type: 'FeatureCollection', features: roadFeatures } });
          map.current.addLayer({
            id: 'roads', type: 'line', source: 'roads-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#adb5bd', 'line-width': 1.5, 'line-opacity': 0.6 },
          });

          // Dots — ponds only (buildings excluded: no valid data)
          const dots = await fetch('/data/geojson/Topo_dots.geojson').then(r => r.json());

          const pondFeatures = dots.features.filter((f: any) => ['PONDS', 'WET AREA'].includes(f.properties.Layer));
          map.current.addSource('ponds-src', { type: 'geojson', data: { type: 'FeatureCollection', features: pondFeatures } });
          map.current.addLayer({
            id: 'ponds', type: 'circle', source: 'ponds-src',
            layout: { visibility: 'visible' },
            paint: { 'circle-color': '#52b788', 'circle-radius': 4, 'circle-opacity': 0.7 },
          });

          // Polygons
          const polygons = await fetch('/data/geojson/Topo_polygon.geojson').then(r => r.json());

          const vegFeatures = polygons.features.filter((f: any) => ['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN'].includes(f.properties.Layer));
          map.current.addSource('vegetation-src', { type: 'geojson', data: { type: 'FeatureCollection', features: vegFeatures } });
          map.current.addLayer({
            id: 'vegetation', type: 'fill', source: 'vegetation-src',
            layout: { visibility: 'visible' },
            paint: { 'fill-color': '#8DA750', 'fill-opacity': 0.4 },
          });

          const zoneFeatures = polygons.features.filter((f: any) => f.properties.Layer === 'SECTOR_2');
          map.current.addSource('zones-src', { type: 'geojson', data: { type: 'FeatureCollection', features: zoneFeatures } });
          map.current.addLayer({
            id: 'zones-fill', type: 'fill', source: 'zones-src',
            layout: { visibility: 'visible' },
            paint: { 'fill-color': '#4895ef', 'fill-opacity': 0.2 },
          });
          map.current.addLayer({
            id: 'zones-line', type: 'line', source: 'zones-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#4895ef', 'line-width': 1 },
          });

          console.log('All layers added successfully');
        } catch (e) {
          console.error('Error adding layers:', e);
        }
      });
    };

    initMap();

    return () => {
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []);

  // ── Glass style ───────────────────────────────────────────────────────────
  const GLASS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(12,96,56,0.13)',
    border: '1px solid rgba(255,255,255,0.7)',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 68px)', overflow: 'hidden' }}>

      {/* Map canvas */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* ── Layer toggle panel — top-left ── */}
      <div style={{
        ...GLASS,
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        padding: '16px', minWidth: '210px',
      }}>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#0C6038', margin: '0 0 12px' }}>
          Map Layers
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {LAYERS.map(({ id, label, color, mapIds }) => (
            <div key={id}
              onClick={() => handleToggle(id, mapIds)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '13px', color: '#1A2E1F' }}>
                  {label}
                </span>
              </div>
              <ToggleSwitch on={layerStates[id]} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Map style switcher — bottom-left ── */}
      <div style={{ position: 'absolute', bottom: '32px', left: '16px', zIndex: 10, display: 'flex', gap: '6px' }}>
        {MAP_STYLES.map(({ id, label, url }) => (
          <button
            key={id}
            onClick={() => switchMapStyle(id, url)}
            style={{
              padding: '7px 14px', borderRadius: '9999px', border: 'none',
              background: mapStyle === id ? '#0C6038' : '#ffffff',
              color: mapStyle === id ? '#ffffff' : '#4A5E4F',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 2D/3D button — bottom-right, above info card ── */}
      <button
        onClick={toggle3D}
        style={{
          position: 'absolute', bottom: '180px', right: '16px', zIndex: 10,
          padding: '8px 18px', borderRadius: '9999px', border: 'none',
          background: '#ffffff', color: '#0C6038',
          fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}
      >
        {is3D ? '2D' : '3D'}
      </button>

      {/* ── Info card — bottom-right ── */}
      <div style={{
        ...GLASS,
        position: 'absolute', bottom: '32px', right: '16px', zIndex: 10,
        padding: '12px 16px',
      }}>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#1A2E1F', margin: '0 0 2px' }}>
          Nyandungu Eco-Park
        </p>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '12px', color: '#4A5E4F', margin: '0 0 2px' }}>
          219 Ha · Kigali, Rwanda
        </p>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '11px', color: '#808847', margin: 0 }}>
          2025 Biodiversity Survey
        </p>
      </div>

    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ on, color }: { on: boolean; color: string }) {
  return (
    <div style={{
      width: '36px', height: '20px', borderRadius: '9999px',
      background: on ? color : '#D1D5DB',
      position: 'relative', flexShrink: 0,
      transition: 'background 0.2s ease',
    }}>
      <div style={{
        position: 'absolute', top: '3px', left: on ? '19px' : '3px',
        width: '14px', height: '14px', borderRadius: '50%',
        background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s ease',
      }} />
    </div>
  );
}
