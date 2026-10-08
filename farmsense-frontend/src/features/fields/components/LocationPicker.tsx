import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";

import type { Region } from "../../../services/region";

// Leaflet's default marker icon paths break under bundlers; an inline SVG pin
// avoids shipping image assets and works in both themes.
const pin = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 25 15 25s15-14 15-25C30 6.7 23.3 0 15 0z" fill="#15803d" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

export type LatLng = { latitude: number; longitude: number };

const inside = (p: LatLng, b: NonNullable<Region["bounds"]>) =>
  p.latitude >= b.south && p.latitude <= b.north && p.longitude >= b.west && p.longitude <= b.east;

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng }),
  });
  return null;
}

function Recenter({ value }: { value: LatLng }) {
  const map = useMap();
  useEffect(() => {
    // Only pan when the pin leaves the view, so clicking does not jerk the map.
    if (!map.getBounds().contains([value.latitude, value.longitude])) {
      map.setView([value.latitude, value.longitude]);
    }
  }, [map, value.latitude, value.longitude]);
  return null;
}

/**
 * Lets the farmer place their field anywhere inside the region.
 * Weather, soil and satellite lookups all key off this point, so it must be
 * the real plot, not the district centre.
 */
export function LocationPicker({
  value,
  onChange,
  region,
}: {
  value: LatLng;
  onChange: (p: LatLng) => void;
  region: Region | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const bounds = region?.bounds;

  const pick = (p: LatLng) => {
    if (bounds && !inside(p, bounds)) {
      setMessage(`That point is outside ${region?.name}. Pick a location inside the district.`);
      return;
    }
    setMessage(null);
    onChange(p);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setMessage("Could not get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-clay-700">Field location</p>
        <button
          type="button"
          onClick={locate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-clay-200 px-3 py-1.5 text-sm font-medium text-clay-700 hover:bg-clay-50"
        >
          <LocateFixed className="h-4 w-4" /> Use my location
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-clay-200">
        <MapContainer
          center={[value.latitude, value.longitude]}
          zoom={12}
          scrollWheelZoom
          style={{ height: 320, width: "100%" }}
          maxBounds={
            bounds
              ? [
                  [bounds.south - 0.2, bounds.west - 0.2],
                  [bounds.north + 0.2, bounds.east + 0.2],
                ]
              : undefined
          }
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={pick} />
          <Recenter value={value} />
          <Marker position={[value.latitude, value.longitude]} icon={pin} />
        </MapContainer>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      <p className="text-xs text-clay-500 tabular">
        {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)} — tap the map to move the pin.
      </p>
    </div>
  );
}
