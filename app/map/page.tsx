'use client';

import { useEffect, useRef } from 'react';

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);

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
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              attribution: 'Tiles © Esri',
            },
          },
          layers: [{
            id: 'esri-satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
          }],
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
            id: 'park-boundary',
            type: 'line',
            source: 'park-boundary-src',
            paint: { 'line-color': '#0C6038', 'line-width': 3 },
          });

          // Restored area
          const restored = await fetch('/data/geojson/Nyandungu.geojson').then(r => r.json());
          map.current.addSource('restored-src', { type: 'geojson', data: restored });
          map.current.addLayer({
            id: 'restored-area',
            type: 'fill',
            source: 'restored-src',
            paint: { 'fill-color': '#F5A623', 'fill-opacity': 0.3 },
          });

          // Polylines — trails and drainage
          const polylines = await fetch('/data/geojson/Topo_polylines.geojson').then(r => r.json());

          const trails = {
            ...polylines,
            features: polylines.features.filter((f: any) => f.properties.Layer === 'PEDESTRIAN WALKWAYS AND TRAILS'),
          };
          map.current.addSource('trails-src', { type: 'geojson', data: trails });
          map.current.addLayer({
            id: 'trails',
            type: 'line',
            source: 'trails-src',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#c77dff', 'line-width': 2, 'line-dasharray': [2, 2] },
          });

          const drainage = {
            ...polylines,
            features: polylines.features.filter((f: any) => ['DRAINAGE', 'MASONRY DRAINAGE'].includes(f.properties.Layer)),
          };
          map.current.addSource('drainage-src', { type: 'geojson', data: drainage });
          map.current.addLayer({
            id: 'drainage',
            type: 'line',
            source: 'drainage-src',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#4895ef', 'line-width': 1.5 },
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

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 68px)', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
