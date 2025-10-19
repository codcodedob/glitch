// components/MapView.tsx
"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Establishment } from "@/pages/index";

type Props = {
  center: { lat: number; lng: number };
  places: Establishment[];
  onUpdateRequested?: (placeId: string) => void;
};

const icon = L.icon({
  // Use CDN so you don’t get 404s in prod
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function MapView({ center, places, onUpdateRequested }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // init map (once)
  useEffect(() => {
    if (!mapEl.current) return;

    // Guard against double-init (can happen under HMR)
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([center.lat, center.lng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      try {
        Object.values(markersRef.current).forEach((m) => m.remove());
        markersRef.current = {};
        map.remove();
      } catch {
        /* noop */
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  // recenter when center changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], 16);
  }, [center.lat, center.lng]);

  // sync markers with places
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // remove stale markers
    const incoming = new Set(places.map((p) => p.google_place_id || p.id));
    Object.keys(markersRef.current).forEach((key) => {
      if (!incoming.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    // add/update markers
    places.forEach((p) => {
      const key = p.google_place_id || p.id;
      let m = markersRef.current[key];

      const codeHtml =
        p.restroom_available === false
          ? "No restroom"
          : p.code
          ? '<span style="opacity:.8">Code:</span> <span style="font-family:monospace">' +
            p.code +
            "</span>"
          : "Customer access — no code yet";

      const btn =
        '<div style="margin-top:8px">' +
        '<button data-place="' +
        (p.google_place_id || p.id) +
        '" style="cursor:pointer; padding:6px 10px; background:#1f2937; color:#e6eef8; border:1px solid #334155; border-radius:8px;">' +
        (p.code ? "Update code" : "Add code") +
        "</button>" +
        "</div>";

      const html =
        '<div style="min-width:200px">' +
        '<div style="font-weight:600">' +
        p.name +
        "</div>" +
        '<div style="opacity:.75; font-size:12px">' +
        (p.address || "") +
        "</div>" +
        '<div style="margin-top:6px; font-size:13px">' +
        codeHtml +
        "</div>" +
        btn +
        "</div>";

      if (!m) {
        m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        markersRef.current[key] = m;
      } else {
        m.setLatLng([p.lat, p.lng]);
      }
      m.bindPopup(html);

      m.off("popupopen");
      m.on("popupopen", () => {
        const popup = m.getPopup();
        if (!popup) return;
        const node = popup.getElement();
        if (!node) return;

        const el = node.querySelector('button[data-place]');
        if (el && onUpdateRequested) {
          el.addEventListener("click", () => {
            const pid = (el as HTMLButtonElement).getAttribute("data-place");
            if (pid) onUpdateRequested(pid);
          });
        }
      });
    });
  }, [places, onUpdateRequested]);

  return (
    <div
      ref={mapEl}
      className="h-full w-full overflow-hidden rounded-2xl border border-slate-800"
      // keep the map behind modals by default
      style={{ zIndex: 0 }}
    />
  );
}
