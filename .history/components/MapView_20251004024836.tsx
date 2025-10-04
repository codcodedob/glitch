"use client";
import { useEffect, useRef } from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km?: number;
};

type Props = {
  center: { lat: number; lng: number };
  places: Place[];
};

export default function MapView({ center, places }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  // Fix default marker icon paths in bundlers like Next
  useEffect(() => {
    // @ts-expect-error – private property in leaflet, but this is the standard fix
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current) return;

    const initial: LatLngExpression = [center.lat, center.lng];
    const map = L.map("leaflet-map", { attributionControl: false }).setView(initial, 16);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
    }).addTo(map);

    // add a “you are here” dot
    L.circleMarker(initial, {
      radius: 6,
      weight: 2,
      color: "#22c55e",
      fillColor: "#22c55e",
      fillOpacity: 0.6,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng]); // ✅ include lat/lng to satisfy exhaustive-deps

  // Pan map when center changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom());
  }, [center.lat, center.lng]); // ✅ include lat/lng

  // Render place markers (clear & re-add)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // add new markers
    const created: LeafletMarker[] = places.map((p) => {
      const m = L.marker([p.lat, p.lng]).addTo(map);
      const dist = typeof p.distance_km === "number" ? ` • ${p.distance_km.toFixed(2)} km` : "";
      m.bindPopup(
        `<div style="font-weight:600">${p.name}</div>
         <div style="font-size:12px;opacity:.8">${p.address}${dist}</div>`
      );
      return m;
    });

    markersRef.current = created;

    return () => {
      created.forEach((m) => m.remove());
    };
  }, [places]);

  return <div id="leaflet-map" className="w-full h-full" />;
}


//npm run import:places -- "Whole Foods" "New York"