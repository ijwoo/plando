import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { appleLogin, type LoginResponse } from './api';
import { API_BASE_URL } from '@/shared/config/env';

export type OAuthProvider = 'google' | 'kakao';

/**
 * 백엔드의 기존 네이티브 OAuth 흐름을 재사용한다(Capacitor 앱이 쓰던 것과 동일):
 *   1. auth 세션에서 ${API}/oauth2/authorization/{provider}?platform=app 열기
 *   2. 백엔드가 OAuth 왕복을 처리한 뒤 plando://oauth?token=...&isNew=... 로 리다이렉트
 *   3. auth 세션이 그 딥링크로 resolve되면 토큰을 추출한다.
 *
 * 백엔드 변경 불필요 — 성공/실패 핸들러가 이미 `plando://`를 내보낸다.
 */
const REDIRECT_URL = 'plando://oauth';

export interface OAuthResult {
  token: string;
  isNew: boolean;
}

/** 결과 반환, 사용자가 브라우저를 취소/닫으면 `null` */
export async function startSocialLogin(provider: OAuthProvider): Promise<OAuthResult | null> {
  const authUrl = `${API_BASE_URL}/oauth2/authorization/${provider}?platform=app`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL);

  if (result.type !== 'success' || !result.url) {
    return null;
  }

  const { queryParams } = Linking.parse(result.url);
  const token = typeof queryParams?.token === 'string' ? queryParams.token : null;
  if (!token) {
    throw new Error('소셜 로그인에 실패했습니다. 다시 시도해주세요.');
  }
  return { token, isNew: queryParams?.isNew === 'true' };
}

/**
 * Apple 네이티브 로그인 — 시스템 시트에서 identityToken을 받아 백엔드 `/api/auth/apple`로 교환.
 * (웹 Capacitor 앱의 @capacitor-community/apple-sign-in 흐름과 동일. 이름은 최초 1회만 내려옴.)
 * 사용자가 시트를 닫으면 `null`.
 */
export async function startAppleLogin(): Promise<LoginResponse | null> {
  // 네이티브 모듈 없는 빌드(리빌드 전)에서 앱 시작 크래시 방지 — 호출 시점에 로드
  const AppleAuthentication = await import('expo-apple-authentication');
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple 로그인에 실패했습니다.');
    return await appleLogin(credential.identityToken, credential.fullName?.givenName, credential.fullName?.familyName);
  } catch (e) {
    // 사용자가 취소한 경우는 에러로 다루지 않는다
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}
