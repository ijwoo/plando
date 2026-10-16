/**
 * 지오펜스 네이티브 모듈 — 인터페이스 + 스텁 (Phase 0).
 *
 * 실제 구현(Phase 4)은 기존 Capacitor Swift 로직을 재포장한다:
 *   frontend-todo/ios/App/App/GeofenceManager.swift   (CLLocationManager + CLCircularRegion)
 *   frontend-todo/ios/App/App/GeofencePlugin.swift     (JS 브릿지)
 * 를 Expo Module(TurboModule)로. Android(Phase 7)는 Geofencing API 사용.
 *
 * iOS 하드 제한: 앱당 모니터링 리전 20개. 실제 모듈은 가장 관련 높은 20개(예: 거리순)만
 * 유지하고 위치 변화에 따라 재등록해야 한다.
 */

export interface GeofenceRegion {
  /** 안정적인 id, 보통 todo/위치 id */
  id: string;
  latitude: number;
  longitude: number;
  /** 미터 단위 */
  radius: number;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
}

export type GeofenceEventType = 'enter' | 'exit';

export interface GeofenceEvent {
  regionId: string;
  type: GeofenceEventType;
  at: number;
}

export interface GeofenceModule {
  /** "항상" 위치 권한 요청 (리전 모니터링에 필수) */
  requestPermissions(): Promise<boolean>;
  /** 모니터링 대상 집합 교체 (iOS는 ≤ 20개 — 모듈이 상한 강제) */
  setRegions(regions: GeofenceRegion[]): Promise<void>;
  stopAll(): Promise<void>;
  addListener(handler: (event: GeofenceEvent) => void): () => void;
}

const notImplemented = (): never => {
  throw new Error('[geofence] 네이티브 모듈 미구현 (Phase 4).');
};

export const Geofence: GeofenceModule = {
  requestPermissions: notImplemented,
  setRegions: notImplemented,
  stopAll: notImplemented,
  addListener: () => notImplemented(),
};

/** iOS가 강제하는 동시 모니터링 리전 최대 개수 */
export const IOS_MAX_REGIONS = 20;
