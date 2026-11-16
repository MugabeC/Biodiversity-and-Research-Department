'use client';

import { useEffect, useRef, useState } from 'react';
import type { LayerSpecification, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { fetchMapGeoJson, MAP_GEOJSON } from '../lib/mapGeojson';
import { annotateMeasures } from '../lib/mapStats';

// ── Map style options ─────────────────────────────────────────────────────────

const MAP_STYLES = [
  { id: 'satellite', label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { id: 'terrain',   label: 'Terrain',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}' },
] as const;

type StyleId = typeof MAP_STYLES[number]['id'];

// ── Layer config ──────────────────────────────────────────────────────────────

const LAYERS = [
  { id: 'park-boundary', label: 'Park Boundary',     color: '#E53935', mapIds: ['park-boundary'] },
  { id: 'restored-area', label: 'Restored Area',      color: '#F5A623', mapIds: ['restored-area-fill', 'restored-area-line'] },
  { id: 'trails',        label: 'Trails & Walkways',  color: '#c77dff', mapIds: ['trails'] },
  { id: 'access-trail',  label: 'Access Trail',       color: '#FFD60A', mapIds: ['access-trail'] },
  { id: 'invasive-removal', label: 'Invasive Species Removal', color: '#FF6B6B', mapIds: ['invasive-removal-fill', 'invasive-removal-line'] },
  { id: 'pond',          label: 'Pond',               color: '#2962FF', mapIds: ['pond-fill', 'pond-line'] },
  { id: 'macadamia',     label: 'Macadamia',          color: '#C8A97E', mapIds: ['macadamia-fill', 'macadamia-line'] },
  { id: 'drainage',      label: 'Drainage & Streams', color: '#00B0FF', mapIds: ['drainage'] },
  { id: 'open-grounds',  label: 'Open Grounds',       color: '#8DA750', mapIds: ['open-grounds'] },
  { id: 'roads',         label: 'Roads',               color: '#adb5bd', mapIds: ['roads'] },
];

const INIT_VISIBILITY: Record<string, boolean> = {
  'park-boundary': true,
  'restored-area': true,
  'trails':        true,
  'access-trail':  true,
  'invasive-removal': true,
  'pond':          true,
  'macadamia':     true,
  'drainage':      true,
  'open-grounds':  true,
  'roads':         true,
};

// Survey areas: layer-id prefix, `group` value in the GeoJSON, colour.
// Order = drawing order (later groups draw on top).
const SURVEY_AREA_GROUPS = [
  { key: 'invasive-removal', group: 'Invasive species removal', color: '#FF6B6B' },
  { key: 'macadamia',        group: 'Macadamia',                color: '#C8A97E' },
  { key: 'pond',             group: 'Pond',                     color: '#2962FF' },
];

type PanelInfo = { title: string; line: string; meta?: string };
type Props = Record<string, unknown>;

// ── Hover / click info ────────────────────────────────────────────────────────

const TYPE_NAMES: Record<string, string> = {
  'PEDESTRIAN WALKWAYS AND TRAILS': 'Pedestrian walkways and trails',
  'DRAINAGE': 'Drainage',
  'MASONRY DRAINAGE': 'Masonry drainage',
  'MAIN ROAD_PEDESTRIAN': 'Main road / pedestrian',
  'INTERNAL SERVICE ROAD': 'Internal service road',
  'EXISTING EARTHROAD': 'Existing earth road',
  'GARDEN': 'Garden',
  'BAMBOO_TREE': 'Bamboo trees',
  'BOTANIC GARDEN': 'Botanic garden',
};
const typeName = (raw: unknown, fallback: string) => {
  const key = String(raw ?? '');
  if (TYPE_NAMES[key]) return TYPE_NAMES[key];
  const t = key.replace(/_/g, ' ').toLowerCase();
  return t && t !== '0' ? t.charAt(0).toUpperCase() + t.slice(1) : fallback;
};
const titleCase = (v: unknown) => String(v ?? '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const fmtLength = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const fmtHa = (m2: number) => `${(m2 / 1e4).toFixed(2)} ha`;
const fmtArea = (m2: number) => `${fmtHa(m2)} · ${Math.round(m2).toLocaleString('en')} m²`;

const describeSurveyArea = (p: Props): PanelInfo => ({
  title: String(p.name),
  line: `${p.area_ha} ha · ${Number(p.area_m2).toLocaleString('en')} m²`,
  meta: Number(p.group_count) > 1 ? `All ${String(p.name).toLowerCase()} areas: ${p.group_ha} ha` : undefined,
});
const describeLine = (label: string) => (p: Props): PanelInfo => ({
  title: typeName(p.Layer, label),
  line: `Total length: ${fmtLength(Number(p._typeTotal))}`,
  meta: Number(p._typeCount) > 1 ? `This segment: ${fmtLength(Number(p._size))}` : undefined,
});

// Layers that give info on hover/click, topmost first. Lines come before the big
// fills so a trail is still hoverable on top of a garden or the restored area.
const INFO_LAYERS: { id: string; describe: (p: Props) => PanelInfo }[] = [
  { id: 'pond-fill',            describe: describeSurveyArea },
  { id: 'macadamia-fill',       describe: describeSurveyArea },
  { id: 'invasive-removal-fill', describe: describeSurveyArea },
  { id: 'access-trail',         describe: p => ({ title: 'Access Trail', line: `Length: ${fmtLength(Number(p._size))}` }) },
  { id: 'trails',               describe: describeLine('Trails & Walkways') },
  { id: 'drainage',             describe: describeLine('Drainage & Streams') },
  { id: 'roads',                describe: describeLine('Roads') },
  { id: 'park-boundary',        describe: p => ({ title: 'Park Boundary', line: `Mapped area: ${fmtArea(Number(p._size))}`, meta: `Perimeter: ${fmtLength(Number(p._perimeter))}` }) },
  { id: 'restored-area-fill',   describe: p => ({
      title: 'Restored Area',
      line: p.AREA ? `${p.AREA} ha` : fmtArea(Number(p._size)),
      meta: [p.LocalName, titleCase(p.District), titleCase(p.Sector)].filter(Boolean).join(' · ') || undefined,
    }) },
  { id: 'open-grounds',         describe: p => {
      const title = typeName(p.Layer, 'Open Grounds');
      return {
        title,
        line: `This area: ${fmtArea(Number(p._size))}`,
        meta: Number(p._typeCount) > 1 ? `All ${title.toLowerCase()}: ${fmtHa(Number(p._typeTotal))}` : undefined,
      };
    } },
];
const PICK_PX = 6; // how close (in pixels) the pointer must be to a thin line

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const mapContainer  = useRef<HTMLDivElement>(null);
  const map           = useRef<MapLibreMap | null>(null);
  const visibilityRef = useRef<Record<string, boolean>>({ ...INIT_VISIBILITY });

  const [is3D,        setIs3D]        = useState(true);
  const [layerStates, setLayerStates] = useState<Record<string, boolean>>({ ...INIT_VISIBILITY });
  const [mapStyle,    setMapStyle]    = useState<StyleId>('satellite');
  const [hoverInfo,   setHoverInfo]   = useState<PanelInfo | null>(null);
  const [pinnedInfo,  setPinnedInfo]  = useState<PanelInfo | null>(null);
  const shownInfo = pinnedInfo ?? hoverInfo;

  // ── Layer toggle ──────────────────────────────────────────────────────────
  const handleToggle = (key: string, layerIds: string[]) => {
    const newVal = !visibilityRef.current[key];
    visibilityRef.current[key] = newVal;
    setLayerStates(prev => ({ ...prev, [key]: newVal }));
    const m = map.current;
    if (m) {
      layerIds.forEach(id => {
        if (m.getLayer(id)) {
          m.setLayoutProperty(id, 'visibility', newVal ? 'visible' : 'none');
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
    // Keep the basemap under the lowest data layer that actually loaded.
    const before = m.getStyle().layers.find(l => l.type !== 'raster' && l.type !== ('sky' as string))?.id;
    m.addLayer({ id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite' }, before);
  };

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    const initMap = async () => {
      const maplibregl = (await import('maplibre-gl')).default;

      const mapInstance = new maplibregl.Map({
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
        } as StyleSpecification,
        center: [30.1491, -1.9555],
        zoom: 15,
        pitch: 60,
        bearing: -17,
      });

      map.current = mapInstance;
      mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapInstance.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

      mapInstance.on('load', async () => {
        try {
          // ── Terrain & sky (3D, enabled by default) ──────────────────────
          mapInstance.addSource('terrain-source', {
            type: 'raster-dem',
            url: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=g8UGiMdXyHomD5NmJULL',
            tileSize: 256,
          });
          mapInstance.setTerrain({ source: 'terrain-source', exaggeration: 1.8 });
          // MapLibre supports sky layers at runtime; bundled typings lag behind for some versions.
          mapInstance.addLayer({
            id: 'sky-layer',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 90.0],
              'sky-atmosphere-sun-intensity': 15,
            },
          } as unknown as LayerSpecification);
        } catch (e) {
          console.error('Error adding terrain:', e);
        }

        // ── Data layers ─────────────────────────────────────────────────
        // Fetched in parallel; each layer is added on its own so one missing
        // file never hides the others. Added in this order (= drawing order).
        const dataLayers: { url: string; src: string; layers: LayerSpecification[] }[] = [
          {
            url: MAP_GEOJSON.boundary, src: 'park-boundary-src',
            layers: [{
              id: 'park-boundary', type: 'line', source: 'park-boundary-src',
              layout: { visibility: 'visible' },
              paint: { 'line-color': '#E53935', 'line-width': 1.5, 'line-opacity': 1 },
            }],
          },
          {
            url: MAP_GEOJSON.restored, src: 'restored-src',
            layers: [
              {
                id: 'restored-area-fill', type: 'fill', source: 'restored-src',
                layout: { visibility: 'visible' },
                paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.2 },
              },
              {
                id: 'restored-area-line', type: 'line', source: 'restored-src',
                layout: { visibility: 'visible' },
                paint: { 'line-color': '#F5A623', 'line-width': 1.5 },
              },
            ],
          },
          {
            url: MAP_GEOJSON.trails, src: 'trails-src',
            layers: [{
              id: 'trails', type: 'line', source: 'trails-src',
              layout: { visibility: 'visible' },
              paint: { 'line-color': '#c77dff', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2] },
            }],
          },
          {
            url: MAP_GEOJSON.drainage, src: 'drainage-src',
            layers: [{
              id: 'drainage', type: 'line', source: 'drainage-src',
              layout: { visibility: 'visible', 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#00B0FF', 'line-width': 1.5, 'line-opacity': 1 },
            }],
          },
          {
            url: MAP_GEOJSON.roads, src: 'roads-src',
            layers: [{
              id: 'roads', type: 'line', source: 'roads-src',
              layout: { visibility: 'visible' },
              paint: { 'line-color': '#adb5bd', 'line-width': 1.5, 'line-opacity': 0.6 },
            }],
          },
          {
            url: MAP_GEOJSON.openGrounds, src: 'open-grounds-src',
            layers: [{
              id: 'open-grounds', type: 'fill', source: 'open-grounds-src',
              layout: { visibility: 'visible' },
              paint: { 'fill-color': '#8DA750', 'fill-opacity': 0.4 },
            }],
          },
          {
            // GPS track, drawn on top of the other layers
            url: MAP_GEOJSON.accessTrail, src: 'access-trail-src',
            layers: [{
              id: 'access-trail', type: 'line', source: 'access-trail-src',
              layout: { visibility: 'visible', 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#FFD60A', 'line-width': 1.5, 'line-opacity': 0.7 },
            }],
          },
          {
            // Survey areas from the 16 Nov GPS tracks (closed polygons). One source,
            // one fill + outline per switch; the pond is drawn last so it sits on top.
            url: MAP_GEOJSON.surveyAreas, src: 'survey-areas-src',
            layers: SURVEY_AREA_GROUPS.flatMap(({ key, group, color }) => [
              {
                id: `${key}-fill`, type: 'fill', source: 'survey-areas-src',
                filter: ['==', ['get', 'group'], group],
                layout: { visibility: 'visible' },
                paint: { 'fill-color': color, 'fill-opacity': 0.35 },
              },
              {
                id: `${key}-line`, type: 'line', source: 'survey-areas-src',
                filter: ['==', ['get', 'group'], group],
                layout: { visibility: 'visible', 'line-join': 'round' },
                paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.8 },
              },
            ] as LayerSpecification[]),
          },
        ];

        const results = await Promise.allSettled(dataLayers.map(l => fetchMapGeoJson(l.url)));
        results.forEach((result, i) => {
          const { url, src, layers } = dataLayers[i];
          if (result.status === 'rejected') {
            console.error(`Error loading ${url}:`, result.reason);
            return;
          }
          try {
            // Add lengths/areas (hover info). The survey areas already carry their own.
            const data = src === 'survey-areas-src' ? result.value : annotateMeasures(result.value);
            mapInstance.addSource(src, { type: 'geojson', data });
            layers.forEach(layer => {
              // Respect toggles flipped while the data was loading.
              const key = LAYERS.find(l => l.mapIds.includes(layer.id))?.id;
              if (key && !visibilityRef.current[key]) {
                layer = { ...layer, layout: { ...layer.layout, visibility: 'none' } } as LayerSpecification;
              }
              mapInstance.addLayer(layer);
            });
          } catch (e) {
            console.error(`Error adding ${src}:`, e);
          }
        });

        // ── Hover / click info for every layer (shown in the side panel) ──
        const pick = (point: { x: number; y: number }): PanelInfo | undefined => {
          const layers = INFO_LAYERS.map(l => l.id).filter(id => mapInstance.getLayer(id));
          if (!layers.length) return undefined;
          const hits = mapInstance.queryRenderedFeatures(
            [[point.x - PICK_PX, point.y - PICK_PX], [point.x + PICK_PX, point.y + PICK_PX]], { layers });
          for (const l of INFO_LAYERS) {
            const f = hits.find(h => h.layer.id === l.id);
            if (f) return l.describe(f.properties);
          }
          return undefined;
        };
        mapInstance.on('mousemove', e => {
          const info = pick(e.point);
          mapInstance.getCanvas().style.cursor = info ? 'pointer' : '';
          setHoverInfo(info ?? null);
        });
        mapInstance.on('mouseout', () => setHoverInfo(null));
        mapInstance.on('click', e => {
          setPinnedInfo(pick(e.point) ?? null); // click a feature to pin it, click elsewhere to clear
        });
      });
    };

    initMap();

    return () => {
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []);

  return (
    <div className="map-page-root">

      {/* Map canvas */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* ── Left column: layer toggles, then the park info card ── */}
      <div className="map-left-stack">
        <div className="map-glass-panel map-layer-panel">
          <p className="map-layer-panel-title">Map Layers</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {LAYERS.map(({ id, label, color, mapIds }) => (
              <div key={id}
                onClick={() => handleToggle(id, mapIds)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {label}
                  </span>
                </div>
                <ToggleSwitch on={layerStates[id]} color={color} />
              </div>
            ))}
          </div>
        </div>

        <div className="map-glass-panel map-info-card">
          <p className="map-info-title">Nyandungu Eco-Park</p>
          <p className="map-info-line">183.94 Ha · Kigali, Rwanda</p>
          <p className="map-info-meta">2025 Biodiversity Survey</p>
        </div>
      </div>

      {/* ── Feature info — top-right, under the zoom controls ── */}
      {shownInfo && (
        <div className="map-glass-panel map-area-panel">
          {pinnedInfo && (
            <button type="button" className="map-area-panel-close" aria-label="Close" onClick={() => setPinnedInfo(null)}>×</button>
          )}
          <p className="map-info-title">{shownInfo.title}</p>
          <p className="map-info-line">{shownInfo.line}</p>
          {shownInfo.meta && <p className="map-info-meta">{shownInfo.meta}</p>}
        </div>
      )}

      <div className="map-bottom-dock">
        <div className="map-bottom-dock-row">
          <div className="map-style-bar">
            {MAP_STYLES.map(({ id, label, url }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchMapStyle(id, url)}
                className={`map-style-btn${mapStyle === id ? ' map-style-btn--active' : ' map-style-btn--idle'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggle3D}
            className={`map-btn-3d${is3D ? ' map-btn-3d--on' : ' map-btn-3d--off'}`}
          >
            {is3D ? '3D' : '2D'}
          </button>
        </div>
        <p className="map-attribution">Tiles © Esri</p>
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
