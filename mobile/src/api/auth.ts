import * as SecureStore from 'expo-secure-store';

/**
 * 디바이스 Keychain/Keystore(expo-secure-store) 기반 토큰 저장소.
 * 앱은 Spring Boot 백엔드에 Bearer JWT로 인증한다.
 */
const ACCESS_TOKEN_KEY = 'plando.accessToken';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

/** JWT payload의 exp(초 단위 epoch). 디코드 실패 시 null — 만료로 단정하지 않는다. */
export function tokenExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const norm = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Hermes는 atob 내장. exp만 읽으므로 멀티바이트 문자열 필드가 깨져도 무방.
    const json = typeof globalThis.atob === 'function' ? globalThis.atob(norm) : null;
    if (!json) return null;
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** 토큰 만료 여부 (기본 30초 여유). exp를 읽을 수 없으면 false — 서버 판단에 맡긴다. */
export function isTokenExpired(token: string, skewSec = 30): boolean {
  const exp = tokenExp(token);
  return exp != null && exp * 1000 <= Date.now() + skewSec * 1000;
}
