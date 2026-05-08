'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── ESRI style definitions ────────────────────────────────────────────────────

type StyleKey = 'satellite' | 'street' | 'topo';

function esriStyle(service: string): object {
  return {
    version: 8,
    sources: {
      'esri-base': {
        type: 'raster',
        tiles: [`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri',
      },
    },
    layers: [{ id: 'esri-base-layer', type: 'raster', source: 'esri-base' }],
  };
}

const STYLES: Record<StyleKey, object> = {
  satellite: esriStyle('World_Imagery'),
  street:    esriStyle('World_Street_Map'),
  topo:      esriStyle('World_Topo_Map'),
};

const STYLE_LABELS: Record<StyleKey, string> = {
  satellite: 'Satellite',
  street:    'Street',
  topo:      'Topo',
};

// ── Layer config ──────────────────────────────────────────────────────────────

const LAYER_CONFIG = [
  { id: 'park-boundary',   label: 'Park Boundary',     color: '#0C6038', defaultOn: true  },
  { id: 'restored-area',   label: 'Restored Area',      color: '#F5A623', defaultOn: true  },
  { id: 'trails',          label: 'Trails & Walkways',  color: '#c77dff', defaultOn: false },
  { id: 'drainage',        label: 'Drainage & Streams', color: '#4895ef', defaultOn: false },
  { id: 'ponds',           label: 'Ponds & Wet Areas',  color: '#52b788', defaultOn: false },
  { id: 'vegetation',      label: 'Vegetation',          color: '#2D4C39', defaultOn: false },
  { id: 'roads',           label: 'Roads',               color: '#adb5bd', defaultOn: false },
  { id: 'buildings',       label: 'Buildings',           color: '#6C2728', defaultOn: false },
];

// MapLibre layer IDs per toggle (restored-area has two sub-layers)
const TOGGLE_LAYER_IDS: Record<string, string[]> = {
  'park-boundary': ['park-boundary'],
  'restored-area': ['restored-area-fill', 'restored-area-line'],
  'trails':        ['trails'],
  'drainage':      ['drainage'],
  'ponds':         ['ponds'],
  'vegetation':    ['vegetation'],
  'roads':         ['roads'],
  'buildings':     ['buildings'],
};

// ── GeoJSON filter helper ─────────────────────────────────────────────────────

function filterFeatures(features: any[], layers: string[]): object {
  return {
    type: 'FeatureCollection',
    features: features.filter(f => layers.includes(f.properties?.Layer)),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const geojsonRef   = useRef<Record<string, any>>({});   // persists across style changes
  const layerOnRef   = useRef<Record<string, boolean>>(   // mirrors state for use in callbacks
    Object.fromEntries(LAYER_CONFIG.map(l => [l.id, l.defaultOn]))
  );

  const [is3D,      setIs3D]      = useState(true);
  const [activeStyle, setActiveStyle] = useState<StyleKey>('satellite');
  const [layerOn,   setLayerOn]   = useState<Record<string, boolean>>(layerOnRef.current);
  const [mapReady,  setMapReady]  = useState(false);

  // ── addAllLayers: adds sources + layers, applies current visibility ─────────
  const addAllLayers = useCallback((map: any) => {
    const g = geojsonRef.current;
    if (!g.boundary) return;  // data not yet loaded

    // Sources
    const addSource = (id: string, data: object) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
    };
    addSource('park-boundary-src', g.boundary);
    addSource('restored-area-src', g.nyandungu);
    addSource('trails-src',        filterFeatures(g.polylines, ['PEDESTRIAN WALKWAYS AND TRAILS']));
    addSource('drainage-src',      filterFeatures(g.polylines, ['DRAINAGE', 'MASONRY DRAINAGE']));
    addSource('ponds-src',         filterFeatures(g.dots,      ['PONDS', 'WET AREA']));
    addSource('vegetation-src',    filterFeatures(g.polygon,   ['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN']));
    addSource('roads-src',         filterFeatures(g.polylines, ['MAIN ROAD_PEDESTRIAN', 'INTERNAL SERVICE ROAD', 'EXISTING EARTHROAD']));
    addSource('buildings-src',     filterFeatures(g.dots,      ['EXISTING BUILDING']));

    // Layers (bottom → top)
    const addLayer = (layer: object) => { if (!map.getLayer((layer as any).id)) map.addLayer(layer); };

    addLayer({ id: 'restored-area-fill', type: 'fill',   source: 'restored-area-src', paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.25 } });
    addLayer({ id: 'restored-area-line', type: 'line',   source: 'restored-area-src', paint: { 'line-color': '#F5A623', 'line-width': 2 } });
    addLayer({ id: 'vegetation',         type: 'fill',   source: 'vegetation-src',    paint: { 'fill-color': '#2D4C39', 'fill-opacity': 0.4 } });
    addLayer({ id: 'roads',              type: 'line',   source: 'roads-src',         paint: { 'line-color': '#adb5bd', 'line-width': 2 } });
    addLayer({ id: 'drainage',           type: 'line',   source: 'drainage-src',      paint: { 'line-color': '#4895ef', 'line-width': 1.5 } });
    addLayer({ id: 'trails',             type: 'line',   source: 'trails-src',        paint: { 'line-color': '#c77dff', 'line-width': 2, 'line-dasharray': [2, 2] } });
    addLayer({ id: 'ponds',              type: 'circle', source: 'ponds-src',         paint: { 'circle-color': '#52b788', 'circle-radius': 6, 'circle-opacity': 0.8 } });
    addLayer({ id: 'buildings',          type: 'circle', source: 'buildings-src',     paint: { 'circle-color': '#6C2728', 'circle-radius': 5 } });
    addLayer({ id: 'park-boundary',      type: 'line',   source: 'park-boundary-src', paint: { 'line-color': '#0C6038', 'line-width': 3, 'line-opacity': 0.9 } });

    // Apply stored visibility
    const vis = layerOnRef.current;
    LAYER_CONFIG.forEach(({ id }) => {
      const visibility = vis[id] ? 'visible' : 'none';
      (TOGGLE_LAYER_IDS[id] || []).forEach(lid => {
        if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visibility);
      });
    });

    setMapReady(true);
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: any;

    import('maplibre-gl').then(async ({ default: maplibregl }) => {
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: STYLES.satellite as any,
        center: [30.1491, -1.9555],
        zoom: 15,
        pitch: 45,
        bearing: -17,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Fetch all GeoJSON once and cache in ref
      const [boundary, nyandungu, polylines, dots, polygon] = await Promise.all([
        fetch('/data/geojson/Surveyed_boundary.geojson').then(r => r.json()),
        fetch('/data/geojson/Nyandungu.geojson').then(r => r.json()),
        fetch('/data/geojson/Topo_polylines.geojson').then(r => r.json()),
        fetch('/data/geojson/Topo_dots.geojson').then(r => r.json()),
        fetch('/data/geojson/Topo_polygon.geojson').then(r => r.json()),
      ]);
      geojsonRef.current = { boundary, nyandungu, polylines, dots, polygon };

      map.on('load', () => addAllLayers(map));

      mapRef.current = map;
    });

    return () => { map?.remove(); mapRef.current = null; };
  }, [addAllLayers]);

  // ── Switch base map style ─────────────────────────────────────────────────
  const switchStyle = (key: StyleKey) => {
    const map = mapRef.current;
    if (!map || key === activeStyle) return;
    setActiveStyle(key);
    setMapReady(false);
    map.setStyle(STYLES[key] as any);
    map.once('style.load', () => addAllLayers(map));
  };

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
    const nextOn = !layerOnRef.current[id];
    layerOnRef.current = { ...layerOnRef.current, [id]: nextOn };
    const visibility = nextOn ? 'visible' : 'none';
    (TOGGLE_LAYER_IDS[id] || []).forEach(lid => {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visibility);
    });
    setLayerOn(prev => ({ ...prev, [id]: nextOn }));
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
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

      {/* ── Style switcher + 2D/3D — top centre-right ── */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '56px',
        zIndex: 10,
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      }}>
        {/* Style buttons */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '9999px',
          padding: '3px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          border: '1px solid rgba(255,255,255,0.7)',
          gap: '2px',
        }}>
          {(Object.keys(STYLES) as StyleKey[]).map(key => (
            <button
              key={key}
              onClick={() => switchStyle(key)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                background: activeStyle === key ? '#0C6038' : 'transparent',
                color: activeStyle === key ? '#ffffff' : '#4A5E4F',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.2s ease, color 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {STYLE_LABELS[key]}
            </button>
          ))}
        </div>

        {/* 2D/3D button */}
        <button
          onClick={toggle3D}
          style={{
            padding: '8px 18px',
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
            whiteSpace: 'nowrap',
          }}
        >
          {is3D ? '2D' : '3D'}
        </button>
      </div>

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

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ on, color, onChange }: { on: boolean; color: string; onChange: () => void }) {
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
