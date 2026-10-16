import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

/**
 * 유니버설 링크 브리지 — 웹앱은 HashRouter(https://plando.imjaewoo.dev/#/join?code=…)라서
 * expo-router가 해시 경로를 매핑하지 못한다. 여기서 해시를 파싱해 네이티브 라우트로 변환.
 * 지원: /#/join?code= → /join, /#/reset-password?token= → /reset-password,
 *       /#/verify-email?token= → /verify-email
 * (동작 조건: 서버에 AASA 파일 배포 + 프로비저닝에 Associated Domains)
 */
function routeFromWebUrl(url: string): { pathname: string; params: Record<string, string> } | null {
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) return null;
  const hash = url.slice(hashIdx + 1); // "/join?code=ABC"
  const [path, query = ''] = hash.split('?');
  const params: Record<string, string> = {};
  for (const kv of query.split('&')) {
    const [k, v] = kv.split('=');
    if (k && v != null) params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  if (path === '/join' && params.code) return { pathname: '/join', params: { code: params.code } };
  if (path === '/reset-password' && params.token) return { pathname: '/reset-password', params: { token: params.token } };
  if (path === '/verify-email' && params.token) return { pathname: '/verify-email', params: { token: params.token } };
  return null;
}

export function UniversalLinkBridge() {
  const router = useRouter();

  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !url.includes('plando.imjaewoo.dev')) return;
      const target = routeFromWebUrl(url);
      if (target) router.push({ pathname: target.pathname as never, params: target.params });
    };
    // 콜드 스타트로 열린 링크
    void Linking.getInitialURL().then(handle);
    // 실행 중 수신
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [router]);

  return null;
}
