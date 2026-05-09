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
  { id: 'park-boundary', label: 'Park Boundary',     color: '#1a1a1a', mapIds: ['park-boundary'] },
  { id: 'restored-area', label: 'Restored Area',      color: '#F5A623', mapIds: ['restored-area-fill', 'restored-area-line'] },
  { id: 'trails',        label: 'Trails & Walkways',  color: '#c77dff', mapIds: ['trails'] },
  { id: 'drainage',      label: 'Drainage & Streams', color: '#4895ef', mapIds: ['drainage'] },
  { id: 'ponds',         label: 'Ponds & Wet Areas',  color: '#52b788', mapIds: ['ponds', 'ponds-polygon'] },
  { id: 'open-grounds',  label: 'Open Grounds',       color: '#8DA750', mapIds: ['open-grounds'] },
  { id: 'roads',         label: 'Roads',               color: '#adb5bd', mapIds: ['roads'] },
  { id: 'zones',         label: 'Zones',               color: '#7B8CDE', mapIds: ['zones-bamboo', 'zones-garden', 'zones-botanic', 'zones-drainage', 'zones-sector'] },
];

const INIT_VISIBILITY: Record<string, boolean> = {
  'park-boundary': true,
  'restored-area': true,
  'trails':        true,
  'drainage':      true,
  'ponds':         true,
  'open-grounds':  true,
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

  // ── 2D/3D with terrain ────────────────────────────────────────────────────
  const toggle3D = () => {
    if (!map.current) return;
    const next3D = !is3D;
    if (next3D) {
      if (map.current.getSource('terrain-source')) {
        map.current.setTerrain({ source: 'terrain-source', exaggeration: 1.8 });
      }
      map.current.easeTo({ pitch: 60, bearing: -17, duration: 700 });
    } else {
      map.current.setTerrain(null);
      map.current.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
    setIs3D(next3D);
  };

  // ── Style switcher ────────────────────────────────────────────────────────
  const switchMapStyle = (styleId: StyleId, url: string) => {
    setMapStyle(styleId);
    if (!map.current) return;
    const m = map.current;
    if (m.getLayer('esri-satellite-layer')) m.removeLayer('esri-satellite-layer');
    if (m.getSource('esri-satellite'))      m.removeSource('esri-satellite');
    m.addSource('esri-satellite', { type: 'raster', tiles: [url], tileSize: 256, attribution: 'Tiles © Esri' });
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
        pitch: 60,
        bearing: -17,
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.current.on('load', async () => {
        try {
          // ── Terrain & sky (3D, enabled by default) ──────────────────────
          map.current.addSource('terrain-source', {
            type: 'raster-dem',
            url: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=g8UGiMdXyHomD5NmJULL',
            tileSize: 256,
          });
          map.current.setTerrain({ source: 'terrain-source', exaggeration: 1.8 });
          map.current.addLayer({
            id: 'sky-layer',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 90.0],
              'sky-atmosphere-sun-intensity': 15,
            },
          } as any);

          // ── Park boundary ───────────────────────────────────────────────
          const boundary = await fetch('/data/geojson/Surveyed_boundary.geojson').then(r => r.json());
          map.current.addSource('park-boundary-src', { type: 'geojson', data: boundary });
          map.current.addLayer({
            id: 'park-boundary', type: 'line', source: 'park-boundary-src',
            layout: { visibility: 'visible' },
            paint: { 'line-color': '#1a1a1a', 'line-width': 1.5, 'line-opacity': 0.85 },
          });

          // ── Restored area ───────────────────────────────────────────────
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

          // ── Polylines ───────────────────────────────────────────────────
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

          // ── Dots ────────────────────────────────────────────────────────
          const dots = await fetch('/data/geojson/Topo_dots.geojson').then(r => r.json());
          const pondFeatures = dots.features.filter((f: any) => ['PONDS', 'WET AREA'].includes(f.properties.Layer));
          map.current.addSource('ponds-src', { type: 'geojson', data: { type: 'FeatureCollection', features: pondFeatures } });
          map.current.addLayer({
            id: 'ponds', type: 'circle', source: 'ponds-src',
            layout: { visibility: 'visible' },
            paint: { 'circle-color': '#52b788', 'circle-radius': 4, 'circle-opacity': 0.7 },
          });

          // ── Polygons ────────────────────────────────────────────────────
          const polygons = await fetch('/data/geojson/Topo_polygon.geojson').then(r => r.json());

          // Wet area polygon (DRAINAGE polygon as water coverage)
          const pondPolyFeatures = polygons.features.filter((f: any) => f.properties.Layer === 'DRAINAGE');
          map.current.addSource('ponds-polygon-src', { type: 'geojson', data: { type: 'FeatureCollection', features: pondPolyFeatures } });
          map.current.addLayer({
            id: 'ponds-polygon', type: 'fill', source: 'ponds-polygon-src',
            layout: { visibility: 'visible' },
            paint: { 'fill-color': '#52b788', 'fill-opacity': 0.35 },
          });

          // Open Grounds (vegetation cover)
          const openGroundsFeatures = polygons.features.filter((f: any) => ['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN'].includes(f.properties.Layer));
          map.current.addSource('open-grounds-src', { type: 'geojson', data: { type: 'FeatureCollection', features: openGroundsFeatures } });
          map.current.addLayer({
            id: 'open-grounds', type: 'fill', source: 'open-grounds-src',
            layout: { visibility: 'visible' },
            paint: { 'fill-color': '#8DA750', 'fill-opacity': 0.4 },
          });

          // Zones — 5 sublayers with distinct colours
          const zoneConfigs = [
            { id: 'zones-bamboo',   filter: 'BAMBOO_TREE',    fill: '#4a7c59', opacity: 0.40 },
            { id: 'zones-garden',   filter: 'GARDEN',         fill: '#8DA750', opacity: 0.35 },
            { id: 'zones-botanic',  filter: 'BOTANIC GARDEN', fill: '#2d6a4f', opacity: 0.40 },
            { id: 'zones-drainage', filter: 'DRAINAGE',       fill: '#4895ef', opacity: 0.25 },
            { id: 'zones-sector',   filter: 'SECTOR_2',       fill: '#565656', opacity: 0.20 },
          ];

          for (const { id, filter, fill, opacity } of zoneConfigs) {
            const features = polygons.features.filter((f: any) => f.properties.Layer === filter);
            map.current.addSource(`${id}-src`, { type: 'geojson', data: { type: 'FeatureCollection', features } });
            map.current.addLayer({
              id, type: 'fill', source: `${id}-src`,
              layout: { visibility: 'visible' },
              paint: { 'fill-color': fill, 'fill-opacity': opacity },
            });
          }

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
  // position:fixed anchors the map to the viewport so the NavBar (68px) never
  // overlaps and there is no white band at the bottom.
  return (
    <div style={{ position: 'fixed', top: '68px', left: 0, right: 0, bottom: 0 }}>

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

      {/* ── 2D/3D button — left side, above style switcher ── */}
      <button
        onClick={toggle3D}
        style={{
          position: 'absolute', bottom: '82px', left: '16px', zIndex: 10,
          padding: '7px 20px', borderRadius: '9999px', border: 'none',
          background: is3D ? '#0C6038' : '#ffffff',
          color: is3D ? '#ffffff' : '#0C6038',
          fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          transition: 'background 0.2s ease, color 0.2s ease',
        }}
      >
        {is3D ? '3D ▲' : '2D ▬'}
      </button>

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
