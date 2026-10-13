/**
 * Map Tile Layer Configurations & Helpers
 * Supports high-resolution Satellite (Hybrid with roads & place labels) and Street views.
 */

export const MAP_LAYERS = {
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: '🛰️',
    base: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS Community',
        className: 'leaflet-satellite-tile',
      },
    },
    overlay: {
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 19,
        attribution: '',
      },
    },
  },
  street: {
    id: 'street',
    name: 'Street',
    icon: '🗺️',
    base: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
  },
};

/**
 * Applies a tile layer to a Leaflet map instance.
 * Preserves zoom, bounds, and markers while switching layers smoothly.
 */
export function applyLeafletTileLayer(L, map, currentLayerGroupRef, layerType = 'satellite') {
  if (!L || !map) return;

  // Remove existing tile layers managed by this ref
  if (currentLayerGroupRef.current) {
    try {
      if (currentLayerGroupRef.current.base) map.removeLayer(currentLayerGroupRef.current.base);
      if (currentLayerGroupRef.current.overlay) map.removeLayer(currentLayerGroupRef.current.overlay);
    } catch {}
  }

  const config = MAP_LAYERS[layerType] || MAP_LAYERS.satellite;
  const baseLayer = L.tileLayer(config.base.url, config.base.options).addTo(map);

  let overlayLayer = null;
  if (config.overlay) {
    overlayLayer = L.tileLayer(config.overlay.url, config.overlay.options).addTo(map);
  }

  // Ensure tile layers stay in background below markers
  if (baseLayer.bringToBack) baseLayer.bringToBack();

  currentLayerGroupRef.current = {
    type: layerType,
    base: baseLayer,
    overlay: overlayLayer,
  };

  return currentLayerGroupRef.current;
}
