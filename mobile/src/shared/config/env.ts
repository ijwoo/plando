/**
 * 런타임 설정.
 *
 * 백엔드 base URL 결정 순서:
 *  1. EXPO_PUBLIC_API_URL  (.env 또는 셸에 설정 — 로컬 개발용)
 *  2. 프로덕션 기본값        (https://plando.imjaewoo.dev)
 *
 * 로컬 개발 팁:
 *  - iOS 시뮬레이터:  http://localhost:8080
 *  - 실기기:          http://<내-LAN-IP>:8080  (예: http://192.168.x.x:8080)
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://plando.imjaewoo.dev'
).replace(/\/+$/, '');

/** STOMP WebSocket base — API base에서 파생 (https→wss, http→ws) */
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

/** 카카오 지도 JavaScript 키 (WebView 지도용). 카카오 콘솔에 사이트 도메인 등록 필요 */
export const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

/**
 * 카카오톡 공유(JS SDK Share)용 JavaScript 키 — 웹앱의 VITE_KAKAO_JAVASCRIPT_KEY와
 * 동일한 카카오 앱(로그인/공유). 지도 키(KAKAO_JS_KEY)와는 다른 카카오 앱이므로 별도 관리.
 */
export const KAKAO_SHARE_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_SHARE_JS_KEY ?? '';

/** 카카오 REST API 키 (경로 조회 API) — 지도 앱과 동일 카카오 앱, 백엔드 kakao.maps.api-key와 같은 값 */
export const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY ?? '';

/** 기존 웹 앱 URL (HashRouter). 팀모집 등 일부 화면을 WebView로 임베드할 때 사용 */
export const WEB_APP_URL = 'https://plando.imjaewoo.dev';

/** WebView 카카오 지도의 referrer 도메인 (카카오 콘솔에 등록된 웹 플랫폼 도메인) */
export const KAKAO_MAP_REFERRER = WEB_APP_URL;
