'use client';

import { useEffect, useRef, useState } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const KEY = 'g8UGiMdXyHomD5NmJULL';

type StyleKey = 'satellite' | 'street' | 'topo';

const MT_STYLES: Record<StyleKey, string> = {
  satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${KEY}`,
  street:    `https://api.maptiler.com/maps/streets/style.json?key=${KEY}`,
  topo:      `https://api.maptiler.com/maps/topo/style.json?key=${KEY}`,
};

const STYLE_LABELS: Record<StyleKey, string> = {
  satellite: 'Satellite',
  street:    'Street',
  topo:      'Topo',
};

// ── Layer config ──────────────────────────────────────────────────────────────

type LayerEntry = {
  id: string;
  label: string;
  color: string;
  defaultOn: boolean;
  mapIds: string[];
};

const LAYER_CONFIG: LayerEntry[] = [
  { id: 'park-boundary', label: 'Park Boundary',     color: '#0C6038', defaultOn: true,  mapIds: ['park-boundary'] },
  { id: 'restored-area', label: 'Restored Area',      color: '#F5A623', defaultOn: true,  mapIds: ['restored-area-fill', 'restored-area-line'] },
  { id: 'trails',        label: 'Trails & Walkways',  color: '#c77dff', defaultOn: false, mapIds: ['trails'] },
  { id: 'drainage',      label: 'Drainage & Streams', color: '#4895ef', defaultOn: false, mapIds: ['drainage'] },
  { id: 'ponds',         label: 'Ponds & Wet Areas',  color: '#52b788', defaultOn: false, mapIds: ['ponds'] },
  { id: 'vegetation',    label: 'Vegetation',          color: '#2D4C39', defaultOn: false, mapIds: ['vegetation'] },
  { id: 'roads',         label: 'Roads',               color: '#adb5bd', defaultOn: false, mapIds: ['roads'] },
  { id: 'buildings',     label: 'Buildings',           color: '#6C2728', defaultOn: false, mapIds: ['buildings'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterFC(features: any[], layerNames: string[]): object {
  return {
    type: 'FeatureCollection',
    features: features.filter(f => layerNames.includes(f.properties?.Layer)),
  };
}

function addTerrain(map: any) {
  if (!map.getSource('maptiler-terrain')) {
    map.addSource('maptiler-terrain', {
      type: 'raster-dem',
      url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${KEY}`,
      tileSize: 256,
    });
  }
  map.setTerrain({ source: 'maptiler-terrain', exaggeration: 2.5 });
  if (!map.getLayer('sky')) {
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 90.0],
        'sky-atmosphere-sun-intensity': 15,
      },
    });
  }
}

function addAllLayers(
  map: any,
  g: Record<string, any>,
  visibility: Record<string, boolean>
) {
  function src(id: string, data: object) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
  }
  function lyr(layer: any) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
  function vis(key: string): 'visible' | 'none' {
    return visibility[key] ? 'visible' : 'none';
  }

  // Sources
  src('park-boundary-src', g.boundary);
  src('restored-area-src', g.nyandungu);
  src('trails-src',     filterFC(g.polylines, ['PEDESTRIAN WALKWAYS AND TRAILS']));
  src('drainage-src',   filterFC(g.polylines, ['DRAINAGE', 'MASONRY DRAINAGE']));
  src('ponds-src',      filterFC(g.dots,      ['PONDS', 'WET AREA']));
  src('vegetation-src', filterFC(g.polygon,   ['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN']));
  src('roads-src',      filterFC(g.polylines, ['MAIN ROAD_PEDESTRIAN', 'INTERNAL SERVICE ROAD', 'EXISTING EARTHROAD']));
  src('buildings-src',  filterFC(g.dots,      ['EXISTING BUILDING']));

  // Layers (bottom → top)
  lyr({ id: 'restored-area-fill', type: 'fill',   source: 'restored-area-src', layout: { visibility: vis('restored-area') }, paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.25 } });
  lyr({ id: 'restored-area-line', type: 'line',   source: 'restored-area-src', layout: { visibility: vis('restored-area') }, paint: { 'line-color': '#F5A623', 'line-width': 2 } });
  lyr({ id: 'vegetation',         type: 'fill',   source: 'vegetation-src',    layout: { visibility: vis('vegetation') },    paint: { 'fill-color': '#2D4C39', 'fill-opacity': 0.4 } });
  lyr({ id: 'roads',              type: 'line',   source: 'roads-src',         layout: { visibility: vis('roads') },         paint: { 'line-color': '#adb5bd', 'line-width': 2 } });
  lyr({ id: 'drainage',           type: 'line',   source: 'drainage-src',      layout: { visibility: vis('drainage') },      paint: { 'line-color': '#4895ef', 'line-width': 1.5 } });
  lyr({ id: 'trails',             type: 'line',   source: 'trails-src',        layout: { visibility: vis('trails') },        paint: { 'line-color': '#c77dff', 'line-width': 2, 'line-dasharray': [2, 2] } });
  lyr({ id: 'ponds',              type: 'circle', source: 'ponds-src',         layout: { visibility: vis('ponds') },         paint: { 'circle-color': '#52b788', 'circle-radius': 6, 'circle-opacity': 0.8 } });
  lyr({ id: 'buildings',          type: 'circle', source: 'buildings-src',     layout: { visibility: vis('buildings') },     paint: { 'circle-color': '#6C2728', 'circle-radius': 5 } });
  lyr({ id: 'park-boundary',      type: 'line',   source: 'park-boundary-src', layout: { visibility: vis('park-boundary') }, paint: { 'line-color': '#0C6038', 'line-width': 3, 'line-opacity': 0.9 } });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const geojsonRef   = useRef<Record<string, any>>({});
  const visRef       = useRef<Record<string, boolean>>(
    Object.fromEntries(LAYER_CONFIG.map(l => [l.id, l.defaultOn]))
  );

  const [is3D,        setIs3D]        = useState(true);
  const [activeStyle, setActiveStyle] = useState<StyleKey>('satellite');
  const [layerOn,     setLayerOn]     = useState<Record<string, boolean>>(visRef.current);

  // Keep visRef in sync with React state (for use in style-switch callbacks)
  useEffect(() => { visRef.current = layerOn; }, [layerOn]);

  // ── Map init: fetch GeoJSON first, then create map ─────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: any;
    let mounted = true;

    Promise.all([
      import('maplibre-gl'),
      fetch('/data/geojson/Surveyed_boundary.geojson').then(r => r.json()),
      fetch('/data/geojson/Nyandungu.geojson').then(r => r.json()),
      fetch('/data/geojson/Topo_polylines.geojson').then(r => r.json()),
      fetch('/data/geojson/Topo_polygon.geojson').then(r => r.json()),
      fetch('/data/geojson/Topo_dots.geojson').then(r => r.json()),
    ]).then(([{ default: maplibregl }, boundary, nyandungu, polylines, polygon, dots]) => {
      if (!mounted || !containerRef.current) return;

      geojsonRef.current = { boundary, nyandungu, polylines, polygon, dots };

      map = new maplibregl.Map({
        container: containerRef.current,
        style: MT_STYLES.satellite,
        center: [30.1491, -1.9555],
        zoom: 15,
        pitch: 60,
        bearing: -17,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', () => {
        addTerrain(map);
        addAllLayers(map, geojsonRef.current, visRef.current);
        console.log('NEP map ready. Debug: window.__nepMap');
      });

      (window as any).__nepMap = map;
      mapRef.current = map;
    }).catch(err => console.error('Map init error:', err));

    return () => {
      mounted = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // ── Style switch ──────────────────────────────────────────────────────────
  const switchStyle = (key: StyleKey) => {
    const map = mapRef.current;
    if (!map || key === activeStyle) return;
    setActiveStyle(key);
    map.setStyle(MT_STYLES[key]);
    map.once('style.load', () => {
      addTerrain(map);
      addAllLayers(map, geojsonRef.current, visRef.current);
    });
  };

  // ── 2D/3D toggle ─────────────────────────────────────────────────────────
  // is3D=true → currently 3D → button label shows "2D" (switch target)
  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next3D = !is3D;
    if (next3D) {
      addTerrain(map);
      map.easeTo({ pitch: 60, bearing: -17, duration: 700 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
    setIs3D(next3D);
  };

  // ── Layer toggle ──────────────────────────────────────────────────────────
  const toggleLayer = (entry: LayerEntry) => {
    const map = mapRef.current;
    const nextOn = !layerOn[entry.id];
    console.log(`Toggle "${entry.id}" → ${nextOn ? 'visible' : 'none'} | ids:`, entry.mapIds);
    setLayerOn(prev => ({ ...prev, [entry.id]: nextOn }));
    if (!map) return;
    entry.mapIds.forEach(id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', nextOn ? 'visible' : 'none');
      } else {
        console.warn('Layer not found:', id);
      }
    });
  };

  // ── UI styles ─────────────────────────────────────────────────────────────
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

      {/* Map canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* ── Top-right controls ── */}
      <div style={{ position: 'absolute', top: '16px', right: '56px', zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center' }}>

        {/* Style switcher */}
        <div style={{
          display: 'flex', gap: '2px', padding: '3px',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '9999px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.7)',
        }}>
          {(Object.keys(MT_STYLES) as StyleKey[]).map(key => (
            <button key={key} onClick={() => switchStyle(key)} style={{
              padding: '6px 14px', borderRadius: '9999px', border: 'none',
              background: activeStyle === key ? '#0C6038' : 'transparent',
              color: activeStyle === key ? '#ffffff' : '#4A5E4F',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}>
              {STYLE_LABELS[key]}
            </button>
          ))}
        </div>

        {/* 2D/3D — label shows the mode you switch TO */}
        <button onClick={toggle3D} style={{
          padding: '8px 18px', borderRadius: '9999px', border: 'none',
          background: '#ffffff', color: '#0C6038',
          fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
          cursor: 'pointer', whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}>
          {is3D ? '2D' : '3D'}
        </button>
      </div>

      {/* ── Layer panel ── */}
      <div style={{ ...GLASS, position: 'absolute', top: '16px', left: '16px', zIndex: 10, padding: '16px', minWidth: '210px' }}>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#0C6038', margin: '0 0 12px' }}>
          Map Layers
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {LAYER_CONFIG.map(entry => (
            <div key={entry.id}
              onClick={() => toggleLayer(entry)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: entry.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '13px', color: '#1A2E1F' }}>
                  {entry.label}
                </span>
              </div>
              <ToggleSwitch on={layerOn[entry.id]} color={entry.color} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Info card ── */}
      <div style={{ ...GLASS, position: 'absolute', bottom: '32px', right: '16px', zIndex: 10, padding: '12px 16px' }}>
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
