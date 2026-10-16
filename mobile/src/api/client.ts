import axios from 'axios';

import { API_BASE_URL } from '@/shared/config/env';
import { getToken, isTokenExpired } from './auth';

/**
 * 공용 axios 인스턴스.
 *
 * 백엔드 규약(백엔드 CLAUDE.md 참고):
 *  - 인증:        Authorization: Bearer <jwt>
 *  - 워크스페이스: X-Workspace-Id: <id>  (대부분의 리소스가 워크스페이스 스코프)
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

// --- 활성 워크스페이스 (해석되면 workspaceStore가 설정) ---
let activeWorkspaceId: number | null = null;
export function setActiveWorkspaceId(id: number | null): void {
  activeWorkspaceId = id;
}

// --- 401 훅: 루트 레이아웃에서 authStore에 연결 ---
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (activeWorkspaceId != null) {
    config.headers['X-Workspace-Id'] = String(activeWorkspaceId);
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    // 이 백엔드는 인증 실패 시 401 대신 로그인 페이지로 302 리다이렉트한다.
    // 네이티브 XHR은 리다이렉트를 강제로 따라가므로 최종 응답이 HTML(200)로 도착 —
    // JSON 대신 HTML이 오면 인증 실패로 간주해 로그아웃 훅을 태운다 (화면 크래시·세션 좀비 방지).
    const ct = String(res.headers?.['content-type'] ?? '');
    const looksHtml = ct.includes('text/html') || (typeof res.data === 'string' && res.data.trimStart().startsWith('<'));
    if (looksHtml && String(res.config?.url ?? '').includes('/api/')) {
      onUnauthorized?.();
      return Promise.reject(new axios.AxiosError('세션이 만료되었어요. 다시 로그인해주세요.', 'ERR_AUTH_REDIRECT', res.config, res.request, res));
    }
    return res;
  },
  async (error) => {
    if (error?.response?.status === 401) {
      // 개별 요청의 일시적/권한성 401로 앱 전체를 로그아웃시키지 않는다.
      // 전역 로그아웃 조건: 토큰 없음 / 실제 만료 / 신원 엔드포인트(/auth/me)가 거부(=서버가 토큰 자체를 무효화)
      const token = await getToken().catch(() => null);
      const url = String(error?.config?.url ?? '');
      if (!token || isTokenExpired(token, 0) || url.includes('/api/auth/me')) {
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  },
);
