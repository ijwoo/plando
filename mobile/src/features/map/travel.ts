/**
 * 이동시간 추정 — 하버사인 직선거리 기반의 보수적 추정치.
 * 카카오 길찾기(실경로) API는 백엔드 프록시 추가 시 이 모듈만 교체하면 된다.
 */

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type TravelMode = 'walk' | 'drive';

export interface TravelEstimate {
  mode: TravelMode;
  minutes: number;
  distKm: number;
}

/**
 * 직선거리 → 체감 이동시간.
 * 도심 우회를 감안해 직선거리에 1.35배 보정, 1.1km 이하 도보(4.5km/h),
 * 그 외 차량(도심 평균 22km/h) + 주차·대기 6분.
 */
export function estimateTravel(aLat: number, aLng: number, bLat: number, bLng: number): TravelEstimate {
  const straight = distanceKm(aLat, aLng, bLat, bLng);
  const road = straight * 1.35;
  if (road <= 1.1) {
    return { mode: 'walk', minutes: Math.max(3, Math.round((road / 4.5) * 60)), distKm: road };
  }
  return { mode: 'drive', minutes: Math.max(8, Math.round((road / 22) * 60) + 6), distKm: road };
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `약 ${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`;
}

export function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${Math.round(km * 10) / 10}km`;
}
