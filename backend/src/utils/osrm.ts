import { logger } from "../config/logger";

// Public OSRM demo server — free, no API key, no billing. It's rate-limited
// and NOT backed by an SLA, so a production deployment with serious traffic
// should self-host OSRM (a single `docker run osrm/osrm-backend` against an
// OSM extract) and just repoint OSRM_BASE_URL — nothing else in this file
// would need to change.
const OSRM_BASE_URL = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

export interface RouteResult {
  distanceMeters: number;
  etaSeconds: number;
  /** GeoJSON LineString coordinates: [[lng, lat], [lng, lat], ...] */
  geometry: [number, number][];
}

// Just the shape of OSRM's response this file actually reads — `fetch`'s
// `.json()` types as `unknown` under Node's built-in fetch types, so this
// gives it a real shape instead of reaching for `any`.
interface OsrmRouteResponse {
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
}

/**
 * Fastest driving route between two points, via OSRM's public routing
 * engine (OpenStreetMap data). Returns null (never throws) on any failure —
 * dispatching an ambulance must never be blocked by a third-party map
 * service being briefly unreachable; callers fall back to a straight-line
 * distance/ETA estimate instead (see estimateStraightLine below).
 */
export async function getFastestRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  const url = `${OSRM_BASE_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ status: res.status }, "OSRM route request failed");
      return null;
    }

    const body = (await res.json()) as OsrmRouteResponse;
    const route = body?.routes?.[0];
    if (!route) return null;

    return {
      distanceMeters: route.distance,
      etaSeconds: route.duration,
      geometry: route.geometry.coordinates,
    };
  } catch (err) {
    logger.warn({ err }, "OSRM route request errored");
    return null;
  }
}

const EARTH_RADIUS_METERS = 6371000;
// Rough fudge factor: real driving distance is longer than straight-line —
// used only as a last-resort fallback when OSRM is unreachable.
const STRAIGHT_LINE_ROAD_FACTOR = 1.3;
const ASSUMED_AVERAGE_SPEED_KMH = 40;

/** Haversine-based fallback so the UI always has SOME distance/ETA to show. */
export function estimateStraightLine(fromLat: number, fromLng: number, toLat: number, toLng: number): RouteResult {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  const straightLineMeters = EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = straightLineMeters * STRAIGHT_LINE_ROAD_FACTOR;
  const etaSeconds = (distanceMeters / 1000 / ASSUMED_AVERAGE_SPEED_KMH) * 3600;

  return {
    distanceMeters,
    etaSeconds,
    geometry: [
      [fromLng, fromLat],
      [toLng, toLat],
    ],
  };
}

/** Always returns a route — OSRM's real one if reachable, else a fallback. */
export async function getRouteWithFallback(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult & { isEstimate: boolean }> {
  const route = await getFastestRoute(fromLat, fromLng, toLat, toLng);
  if (route) return { ...route, isEstimate: false };
  return { ...estimateStraightLine(fromLat, fromLng, toLat, toLng), isEstimate: true };
}
