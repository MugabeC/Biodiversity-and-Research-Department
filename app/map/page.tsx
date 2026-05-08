'use client';

import { useEffect, useRef, useState } from 'react';

// ── ESRI styles ───────────────────────────────────────────────────────────────

type StyleKey = 'satellite' | 'street' | 'topo';

function esriStyle(service: string): object {
  return {
    version: 8,
    sources: {
      'esri-base': {
        type: 'raster',
        tiles: [`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        attribution: 'Tiles © Esri',
      },
    },
    layers: [{ id: 'esri-base-layer', type: 'raster', source: 'esri-base' }],
  };
}

const ESRI_STYLES: Record<StyleKey, object> = {
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
  { id: 'park-boundary', label: 'Park Boundary',     color: '#0C6038', ids: ['park-boundary'] },
  { id: 'restored-area', label: 'Restored Area',      color: '#F5A623', ids: ['restored-area-fill', 'restored-area-line'] },
  { id: 'trails',        label: 'Trails & Walkways',  color: '#c77dff', ids: ['trails'] },
  { id: 'drainage',      label: 'Drainage & Streams', color: '#4895ef', ids: ['drainage'] },
  { id: 'ponds',         label: 'Ponds & Wet Areas',  color: '#52b788', ids: ['ponds'] },
  { id: 'vegetation',    label: 'Vegetation',          color: '#2D4C39', ids: ['vegetation'] },
  { id: 'roads',         label: 'Roads',               color: '#adb5bd', ids: ['roads'] },
  { id: 'buildings',     label: 'Buildings',           color: '#6C2728', ids: ['buildings'] },
];

// ── GeoJSON filter ────────────────────────────────────────────────────────────

function filterFC(features: any[], layerNames: string[]): object {
  return {
    type: 'FeatureCollection',
    features: features.filter(f => layerNames.includes(f.properties?.Layer)),
  };
}

// ── Toggle helper ─────────────────────────────────────────────────────────────

function setLayerVisible(map: any, ids: string[], visible: boolean) {
  ids.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    } else {
      console.warn('Layer not found:', id);
    }
  });
}

// ── addAllLayers ──────────────────────────────────────────────────────────────

function addAllLayers(map: any, g: Record<string, any>) {
  function addSource(id: string, data: object) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
  }
  function addLayer(layer: any) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }

  // Sources
  addSource('park-boundary-src', g.boundary);
  addSource('restored-area-src', g.nyandungu);
  addSource('trails-src',     filterFC(g.polylines, ['PEDESTRIAN WALKWAYS AND TRAILS']));
  addSource('drainage-src',   filterFC(g.polylines, ['DRAINAGE', 'MASONRY DRAINAGE']));
  addSource('ponds-src',      filterFC(g.dots,      ['PONDS', 'WET AREA']));
  addSource('vegetation-src', filterFC(g.polygon,   ['BAMBOO_TREE', 'GARDEN', 'BOTANIC GARDEN']));
  addSource('roads-src',      filterFC(g.polylines, ['MAIN ROAD_PEDESTRIAN', 'INTERNAL SERVICE ROAD', 'EXISTING EARTHROAD']));
  addSource('buildings-src',  filterFC(g.dots,      ['EXISTING BUILDING']));

  // Layers — all start visible
  addLayer({ id: 'restored-area-fill', type: 'fill',   source: 'restored-area-src', layout: { visibility: 'visible' }, paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.25 } });
  addLayer({ id: 'restored-area-line', type: 'line',   source: 'restored-area-src', layout: { visibility: 'visible' }, paint: { 'line-color': '#F5A623', 'line-width': 2 } });
  addLayer({ id: 'vegetation',         type: 'fill',   source: 'vegetation-src',    layout: { visibility: 'visible' }, paint: { 'fill-color': '#2D4C39', 'fill-opacity': 0.4 } });
  addLayer({ id: 'roads',              type: 'line',   source: 'roads-src',         layout: { visibility: 'visible' }, paint: { 'line-color': '#adb5bd', 'line-width': 2 } });
  addLayer({ id: 'drainage',           type: 'line',   source: 'drainage-src',      layout: { visibility: 'visible' }, paint: { 'line-color': '#4895ef', 'line-width': 1.5 } });
  addLayer({ id: 'trails',             type: 'line',   source: 'trails-src',        layout: { visibility: 'visible' }, paint: { 'line-color': '#c77dff', 'line-width': 2, 'line-dasharray': [2, 2] } });
  addLayer({ id: 'ponds',              type: 'circle', source: 'ponds-src',         layout: { visibility: 'visible' }, paint: { 'circle-color': '#52b788', 'circle-radius': 6, 'circle-opacity': 0.8 } });
  addLayer({ id: 'buildings',          type: 'circle', source: 'buildings-src',     layout: { visibility: 'visible' }, paint: { 'circle-color': '#6C2728', 'circle-radius': 5 } });
  addLayer({ id: 'park-boundary',      type: 'line',   source: 'park-boundary-src', layout: { visibility: 'visible' }, paint: { 'line-color': '#0C6038', 'line-width': 3, 'line-opacity': 0.9 } });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const geojsonRef   = useRef<Record<string, any>>({});

  const [is3D,        setIs3D]        = useState(true);
  const [activeStyle, setActiveStyle] = useState<StyleKey>('satellite');
  // All layers start ON (true) — matches addAllLayers which adds all as visible
  const [layerOn, setLayerOn] = useState<Record<string, boolean>>(
    Object.fromEntries(LAYER_CONFIG.map(l => [l.id, true]))
  );

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: any;
    let mounted = true;

    Promise.all([
      import('maplibre-gl'),
      fetch('/data/geojson/Surveyed_boundary.geojson').then(r => r.json()),
      fetch('/data/geojson/Nyandungu.geojson').then(r => r.json()),
      fetch('/data/geojson/Topo_polylines.geojson').then(r => r.json()),
      fetch('/data/geojson/Topo_dots.geojson').then(r => r.json()),
      fetch('/data/geojson/Topo_polygon.geojson').then(r => r.json()),
    ]).then(([{ default: maplibregl }, boundary, nyandungu, polylines, dots, polygon]) => {
      if (!mounted || !containerRef.current) return;

      geojsonRef.current = { boundary, nyandungu, polylines, dots, polygon };

      map = new maplibregl.Map({
        container: containerRef.current,
        style: ESRI_STYLES.satellite as any,
        center: [30.1491, -1.9555],
        zoom: 15,
        pitch: 45,
        bearing: -17,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', () => {
        addAllLayers(map, geojsonRef.current);
        console.log('Map loaded. All layers added as visible. Access map via window.__nepMap');
      });

      // Expose map for browser console debugging
      (window as any).__nepMap = map;
      mapRef.current = map;
    }).catch(err => console.error('Map init error:', err));

    return () => {
      mounted = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // ── Style switch ─────────────────────────────────────────────────────────
  const switchStyle = (key: StyleKey) => {
    const map = mapRef.current;
    if (!map || key === activeStyle) return;
    setActiveStyle(key);
    map.setStyle(ESRI_STYLES[key] as any);
    map.once('style.load', () => {
      addAllLayers(map, geojsonRef.current);
      // Re-apply current toggle state after style reload
      LAYER_CONFIG.forEach(({ id, ids }) => {
        const visible = layerOnRef.current[id];
        console.log(`Re-applying visibility after style switch: ${id} → ${visible}`);
        setLayerVisible(map, ids, visible);
      });
    });
  };

  // Keep a ref of layerOn for use in style-switch callback above
  const layerOnRef = useRef(layerOn);
  useEffect(() => { layerOnRef.current = layerOn; }, [layerOn]);

  // ── 2D/3D toggle ─────────────────────────────────────────────────────────
  // is3D=true means map IS currently 3D → button shows "2D" (switch to 2D)
  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next3D = !is3D;
    map.easeTo({ pitch: next3D ? 45 : 0, bearing: next3D ? -17 : 0, duration: 600 });
    setIs3D(next3D);
  };

  // ── Layer toggle ──────────────────────────────────────────────────────────
  const toggleLayer = (id: string, ids: string[]) => {
    const map = mapRef.current;
    const nextOn = !layerOn[id];
    console.log(`Toggle "${id}" → ${nextOn ? 'visible' : 'none'} | layer IDs:`, ids);
    setLayerOn(prev => ({ ...prev, [id]: nextOn }));
    if (map) setLayerVisible(map, ids, nextOn);
  };

  // ── Shared glass style ────────────────────────────────────────────────────
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
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 68px)' }}>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Style switcher + 2D/3D */}
      <div style={{ position: 'absolute', top: '16px', right: '56px', zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div style={{
          display: 'flex', gap: '2px', padding: '3px',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '9999px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.7)',
        }}>
          {(Object.keys(ESRI_STYLES) as StyleKey[]).map(key => (
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

        {/* Shows the mode you will SWITCH TO */}
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

      {/* Layer panel */}
      <div style={{ ...GLASS, position: 'absolute', top: '16px', left: '16px', zIndex: 10, padding: '16px', minWidth: '210px' }}>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#0C6038', margin: '0 0 12px' }}>
          Map Layers
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {LAYER_CONFIG.map(({ id, label, color, ids }) => (
            <div key={id}
              onClick={() => toggleLayer(id, ids)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '13px', color: '#1A2E1F' }}>
                  {label}
                </span>
              </div>
              <ToggleSwitch on={layerOn[id]} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Info card */}
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
