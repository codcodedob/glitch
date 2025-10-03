// components/MapView.tsx
"use client";
import { useEffect, useRef } from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  restroom_available: boolean | null;
  code?: string | null;
  distance_km?: number;
  code_updated_at?: string | null;
};

type Props = {
  center: { lat: number; lng: number };
  places: Place[];
};

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MapView({ center, places }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, LeafletMarker>>({});

  // Create map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true })
      .setView([center.lat, center.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []); // create once

  // Recenter when center changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], 16);
  }, [center.lat, center.lng]);

  // Sync markers with `places`
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove markers that are no longer present
    const existingIds = new Set(Object.keys(markersRef.current));
    const incomingIds = new Set(places.map(p => p.id));
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }

    // Add/update markers
    places.forEach((p) => {
      let m = markersRef.current[p.id];
      const content = `
        <div style="min-width:180px">
          <div style="font-weight:600">${p.name}</div>
          <div style="opacity:.7; font-size:12px">${p.address}</div>
          <div style="margin-top:6px; font-size:13px">
            ${
              p.restroom_available === false
                ? "No restroom"
                : p.code
                ? `<span style="opacity:.8">Code:</span> <span style="font-family:monospace">${p.code}</span>`
                : "No code yet"
            }
          </div>
          ${
            typeof p.distance_km === "number"
              ? `<div style="margin-top:4px; font-size:11px; opacity:.7">${p.distance_km.toFixed(2)} km away</div>`
              : ""
          }
          ${
            p.code && p.code_updated_at
              ? `<div style="margin-top:4px; font-size:11px; opacity:.6">Updated ${new Date(p.code_updated_at).toLocaleString()}</div>`
              : ""
          }
        </div>
      `;

      if (!m) {
        m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        markersRef.current[p.id] = m;
      } else {
        m.setLatLng([p.lat, p.lng]);
      }
      m.bindPopup(content);
    });
  }, [places]);

  return (
    <div
      ref={mapEl}
      className="h-[380px] w-full overflow-hidden rounded-2xl border border-slate-800"
    />
  );
}
