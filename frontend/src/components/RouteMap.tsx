import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker images don't resolve under Vite's bundling, so we
// use small inline div-icons instead of the default image-based marker —
// this also lets pickup / hospital / ambulance be visually distinct at a
// glance without shipping extra image assets.
function makeDivIcon(emoji: string, background: string) {
  return L.divIcon({
    html: `<div style="background:${background};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid white;">${emoji}</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

const pickupIcon = makeDivIcon("📍", "#16a34a");
const hospitalIcon = makeDivIcon("🏥", "#2563eb");
const ambulanceIcon = makeDivIcon("🚑", "#dc2626");

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(points, { padding: [48, 48] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);
  return null;
}

export interface RouteMapPoint {
  lat: number;
  lng: number;
  label?: string;
}

interface RouteMapProps {
  pickup: RouteMapPoint;
  destination: RouteMapPoint;
  /** Live ambulance position, if known. */
  ambulance?: RouteMapPoint | null;
  /** OSRM route geometry: [lng, lat] pairs, as returned by the API. */
  routeGeometry?: [number, number][] | null;
  /** Actual GPS breadcrumb trail so far: [lat, lng] pairs. */
  pingTrail?: [number, number][];
  height?: string;
}

export default function RouteMap({ pickup, destination, ambulance, routeGeometry, pingTrail, height = "420px" }: RouteMapProps) {
  const routeLatLngs: [number, number][] = (routeGeometry ?? []).map(([lng, lat]) => [lat, lng]);
  const boundsPoints: [number, number][] = [
    [pickup.lat, pickup.lng],
    [destination.lat, destination.lng],
    ...(ambulance ? ([[ambulance.lat, ambulance.lng]] as [number, number][]) : []),
  ];

  return (
    <div style={{ height, width: "100%" }} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <MapContainer center={[pickup.lat, pickup.lng]} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPoints} />

        {routeLatLngs.length > 1 && <Polyline positions={routeLatLngs} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.75 }} />}
        {pingTrail && pingTrail.length > 1 && (
          <Polyline positions={pingTrail} pathOptions={{ color: "#dc2626", weight: 3, opacity: 0.6, dashArray: "2 8" }} />
        )}

        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          {pickup.label && <Popup>{pickup.label}</Popup>}
        </Marker>
        <Marker position={[destination.lat, destination.lng]} icon={hospitalIcon}>
          {destination.label && <Popup>{destination.label}</Popup>}
        </Marker>
        {ambulance && (
          <Marker position={[ambulance.lat, ambulance.lng]} icon={ambulanceIcon}>
            {ambulance.label && <Popup>{ambulance.label}</Popup>}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
