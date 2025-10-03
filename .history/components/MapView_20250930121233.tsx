// components/MapView.tsx
"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

type MapViewProps = {
  center: { lat: number; lng: number };
  places: { id: string; name: string; address: string; lat: number; lng: number; code?: string | null; distance_km?: number }[];
};

// Fix Leaflet default icon paths when bundled by Next.js
function useLeafletIconFix() {
  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);
}

export default function MapView({ center, places }: MapViewProps) {
  useLeafletIconFix();
  return (
    <div className="h-[380px] w-full overflow-hidden rounded-2xl border border-slate-800">
      <MapContainer center={[center.lat, center.lng]} zoom={16} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs opacity-70">{p.address}</div>
              {p.code && (
                <div className="mt-1 text-sm">
                  <span className="opacity-70">Code:</span> <span className="font-mono">{p.code}</span>
                </div>
              )}
              {typeof p.distance_km === "number" && <div className="mt-1 text-xs">{p.distance_km.toFixed(2)} km away</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
