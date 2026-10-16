import { KAKAO_REST_KEY } from '@/shared/config/env';

import { estimateTravel } from './travel';

/**
 * 경로 제공 추상화 — KakaoRouteProvider(2026-07-21 오픈된 카카오맵 경로 조회 API)가
 * 도보·자전거·대중교통 실경로를 제공하고, 차량·API 실패 시 직선 추정으로 폴백한다.
 *
 * 참고: 신규 API에 '자동차'는 없음 — 차량은 추정 유지(또는 별도 카카오모빌리티).
 */

export type RouteMode = 'walk' | 'bike' | 'transit' | 'drive';

export const ROUTE_MODES: { mode: RouteMode; label: string; icon: string }[] = [
  { mode: 'walk', label: '도보', icon: 'walk-outline' },
  { mode: 'bike', label: '자전거', icon: 'bicycle-outline' },
  { mode: 'transit', label: '대중교통', icon: 'bus-outline' },
  { mode: 'drive', label: '차량', icon: 'car-outline' },
];

/** 구간 세부 leg — 대중교통이면 지하철/버스 구간, 그 외엔 단일 leg */
export interface RouteLeg {
  kind: 'walk' | 'subway' | 'bus' | 'bike' | 'car';
  label: string; // "2호선", "143번", "도보"
  minutes: number;
  detail?: string; // "5정거장", "강남역 → 사당역"
  /** 보조설명 — 승하차역 등 ("강남 → 을지로입구") */
  sub?: string;
}

export interface RouteResult {
  mode: RouteMode;
  /** false면 데이터 없음(API 실패·미지원 구간) — 시트에 안내 표시 */
  available: boolean;
  minutes?: number;
  distKm?: number;
  transfers?: number;
  /** 대중교통 요금(원) — API 제공 시 */
  fareWon?: number;
  /** 차량 통행료(원) — 카카오내비 제공 시 */
  tollWon?: number;
  /** 예상 택시요금(원) — 카카오내비 제공 시 */
  taxiWon?: number;
  legs?: RouteLeg[];
  /** 실경로 폴리라인 — 추정에선 null(직선), API에선 도로 좌표열 */
  polyline?: { lat: number; lng: number }[] | null;
  /** 추정치임을 표시(실경로 아님) */
  estimated?: boolean;
}

export interface RouteQuery {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

export interface RouteProvider {
  getRoute(q: RouteQuery, mode: RouteMode): Promise<RouteResult>;
}

/** 직선거리 기반 추정 — 도보/자전거/차량은 값 제공, 대중교통은 데이터 없음(placeholder) */
export const EstimationProvider: RouteProvider = {
  async getRoute(q, mode) {
    if (mode === 'transit') {
      // 대중교통은 시각표 없이는 추정이 무의미 — API 폴백 상황에선 안내만 표시
      return { mode, available: false, estimated: false, polyline: null };
    }
    const base = estimateTravel(q.fromLat, q.fromLng, q.toLat, q.toLng);
    // estimateTravel은 walk/drive만 구분 — bike는 15km/h로 별도 환산
    let minutes = base.minutes;
    if (mode === 'bike') minutes = Math.max(4, Math.round((base.distKm / 15) * 60) + 2);
    else if (mode === 'walk') minutes = Math.max(3, Math.round((base.distKm / 4.5) * 60));
    else if (mode === 'drive') minutes = base.minutes;
    return {
      mode,
      available: true,
      estimated: true,
      minutes,
      distKm: base.distKm,
      polyline: null,
      legs: [{ kind: mode === 'drive' ? 'car' : mode === 'bike' ? 'bike' : 'walk', label: labelFor(mode), minutes }],
    };
  },
};

function labelFor(mode: RouteMode): string {
  return mode === 'walk' ? '도보' : mode === 'bike' ? '자전거' : mode === 'drive' ? '차량' : '대중교통';
}

// ── 카카오맵 경로 조회 API (2026-07-21 오픈) ──
// walk/bicycle: GET /v2/routing/{walk|bicycle} → { route: { properties: {totalDistance(m), totalTime(s)}, legs[].steps[].path.points[[lng,lat]] } }
// publictraffic: GET /v2/routing/publictraffic → { routes[]: { properties: {type, totalTime, totalDistance, transfers, fare.value}, steps[] } }
// 인증: Authorization: KakaoAK <REST 키>

interface KakaoPathStep {
  path?: { points?: [number, number][] };
  properties?: {
    type?: 'BUS' | 'SUBWAY' | 'WALKING';
    time?: number;
    distance?: number;
    guidance?: string;
    vehicles?: { name?: string; type?: string }[];
    stops?: { name?: string }[];
  };
}

function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: ctrl.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** 일시적 네트워크 실패 대비 1회 재시도 — 약전계(신호 1칸)에서 첫 시도가 곧잘 죽는다 */
async function fetchJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url);
  } catch {
    res = await fetchWithTimeout(url);
  }
  if (!res.ok) throw new Error(`kakao routing ${res.status}`);
  return res.json();
}

function toPolyline(steps: KakaoPathStep[]): { lat: number; lng: number }[] | null {
  const pts: { lat: number; lng: number }[] = [];
  for (const s of steps) for (const [lng, lat] of s.path?.points ?? []) pts.push({ lat, lng });
  return pts.length ? pts : null;
}

const asMinutes = (sec: number) => Math.max(1, Math.round(sec / 60));

/** 중복 제거 후 · 로 연결 — 지하철 vehicles가 같은 호선을 반복하고, 버스는 대체 노선을 나열한다 */
const vehicleLabel = (vehicles: { name?: string }[] | undefined, fallback: string) => {
  const names = [...new Set((vehicles ?? []).map((v) => v.name).filter(Boolean))] as string[];
  return names.length ? names.join('·') : fallback;
};

async function kakaoWalkBike(q: RouteQuery, mode: 'walk' | 'bike'): Promise<RouteResult> {
  const endpoint = mode === 'walk' ? 'walk' : 'bicycle';
  const json = await fetchJson(
    `https://dapi.kakao.com/v2/routing/${endpoint}?start_x=${q.fromLng}&start_y=${q.fromLat}&end_x=${q.toLng}&end_y=${q.toLat}`,
  );
  const props = json?.route?.properties;
  const legs: KakaoPathStep[][] = (json?.route?.legs ?? []).map((l: { steps?: KakaoPathStep[] }) => l.steps ?? []);
  const steps = legs.flat();
  // TOO_FAR_AWAY 등도 200 + totalTime:0으로 온다 — status OK가 아니면 실경로 없음(추정 폴백)
  if (json?.status !== 'OK' || !props?.totalTime) throw new Error(`kakao routing: ${json?.status ?? 'empty'}`);
  const minutes = asMinutes(props.totalTime);
  return {
    mode,
    available: true,
    estimated: false,
    minutes,
    distKm: props.totalDistance != null ? props.totalDistance / 1000 : undefined,
    polyline: toPolyline(steps),
    legs: [{ kind: mode === 'bike' ? 'bike' : 'walk', label: labelFor(mode), minutes }],
  };
}

async function kakaoTransit(q: RouteQuery): Promise<RouteResult> {
  const json = await fetchJson(
    `https://dapi.kakao.com/v2/routing/publictraffic?start_x=${q.fromLng}&start_y=${q.fromLat}&end_x=${q.toLng}&end_y=${q.toLat}`,
  );
  const best = json?.routes?.[0];
  const props = best?.properties;
  if (json?.status !== 'OK' || !props?.totalTime)
    return { mode: 'transit', available: false, estimated: false, polyline: null };
  const steps: KakaoPathStep[] = best.steps ?? [];
  const legs: RouteLeg[] = steps.map((s) => {
    const p = s.properties ?? {};
    const kind = p.type === 'SUBWAY' ? 'subway' : p.type === 'BUS' ? 'bus' : 'walk';
    const stopCount = p.stops?.length ?? 0;
    // guidance "2호선 (강남 > 을지로입구)" → 승하차역 "강남 → 을지로입구"
    const boarding = /\(([^)]+)\)/.exec(p.guidance ?? '')?.[1]?.replace(/\s*>\s*/g, ' → ');
    return {
      kind,
      label: kind === 'walk' ? '도보' : vehicleLabel(p.vehicles, kind === 'bus' ? '버스' : '지하철'),
      minutes: asMinutes(p.time ?? 0),
      detail: kind !== 'walk' && stopCount > 1 ? `${stopCount - 1}정거장` : undefined,
      sub: kind !== 'walk' ? boarding : undefined,
    };
  });
  return {
    mode: 'transit',
    available: true,
    estimated: false,
    minutes: asMinutes(props.totalTime),
    distKm: props.totalDistance != null ? props.totalDistance / 1000 : undefined,
    transfers: props.transfers,
    fareWon: props.fare?.value,
    polyline: toPolyline(steps),
    legs,
  };
}

/** 폴리라인 다운샘플 — 장거리 차량 경로(수천 점)를 지도 주입에 감당 가능한 크기로 */
function thinPolyline(pts: { lat: number; lng: number }[], max = 300): { lat: number; lng: number }[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

/** 차량 — 카카오내비 길찾기(도로 실경로·소요시간·통행료). 지도 REST 키 그대로 사용 */
async function kakaoDrive(q: RouteQuery): Promise<RouteResult> {
  const json = await fetchJson(
    `https://apis-navi.kakaomobility.com/v1/directions?origin=${q.fromLng},${q.fromLat}&destination=${q.toLng},${q.toLat}`,
  );
  const r = json?.routes?.[0];
  if (r?.result_code !== 0 || !r?.summary?.duration) throw new Error(`kakao navi: ${r?.result_code ?? 'empty'}`);
  const pts: { lat: number; lng: number }[] = [];
  for (const sec of r.sections ?? [])
    for (const road of sec.roads ?? []) {
      const v: number[] = road.vertexes ?? [];
      for (let i = 0; i + 1 < v.length; i += 2) pts.push({ lat: v[i + 1], lng: v[i] });
    }
  const minutes = asMinutes(r.summary.duration);
  return {
    mode: 'drive',
    available: true,
    estimated: false,
    minutes,
    distKm: r.summary.distance != null ? r.summary.distance / 1000 : undefined,
    tollWon: r.summary.fare?.toll || undefined,
    taxiWon: r.summary.fare?.taxi || undefined,
    polyline: pts.length ? thinPolyline(pts) : null,
    legs: [{ kind: 'car', label: '차량', minutes }],
  };
}

/**
 * 카카오 경로 조회 — 도보·자전거·대중교통(카카오맵)·차량(카카오내비) 모두 실경로.
 * REST 키 없음/네트워크·API 실패 시 EstimationProvider로 폴백(대중교통은 available:false).
 */
export const KakaoRouteProvider: RouteProvider = {
  async getRoute(q, mode) {
    if (!KAKAO_REST_KEY) return EstimationProvider.getRoute(q, mode);
    try {
      if (mode === 'transit') return await kakaoTransit(q);
      if (mode === 'drive') return await kakaoDrive(q);
      return await kakaoWalkBike(q, mode);
    } catch {
      return EstimationProvider.getRoute(q, mode);
    }
  },
};

/** 앱 전역이 사용하는 활성 provider */
export const routeProvider: RouteProvider = KakaoRouteProvider;

// ── 오늘 동선 개요용 구간 실경로 ──
// 구간 거리에 따라 도보(≤1.1km 보정거리)/차량을 골라 실경로·실소요시간을 가져온다.
// 성공만 캐시(세션 한정) — 동선 재진입·리렌더마다 API를 다시 때리지 않게.

export interface SegmentRoute {
  minutes: number;
  path: { lat: number; lng: number }[] | null;
}

const segmentCache = new Map<string, SegmentRoute>();

export function segmentKey(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  return `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
}

export async function getSegmentRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<SegmentRoute | null> {
  const key = segmentKey(a, b);
  const hit = segmentCache.get(key);
  if (hit) return hit;
  const est = estimateTravel(a.lat, a.lng, b.lat, b.lng);
  const q: RouteQuery = { fromLat: a.lat, fromLng: a.lng, toLat: b.lat, toLng: b.lng };
  const r = await KakaoRouteProvider.getRoute(q, est.mode === 'walk' ? 'walk' : 'drive');
  if (!r.available || r.estimated || r.minutes == null) return null; // 폴백(추정)이면 기존 추정 라벨·직선 유지
  const v: SegmentRoute = { minutes: r.minutes, path: r.polyline ?? null };
  segmentCache.set(key, v);
  return v;
}
