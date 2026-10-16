import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { ThemedText } from '@/components/themed-text';
import type { WorkspaceSummary } from '@/features/workspace/api';
import { buildKakaoShareHtml } from '@/features/workspace/kakaoShareHtml';
import { KAKAO_MAP_REFERRER, KAKAO_SHARE_JS_KEY, WEB_APP_URL } from '@/shared/config/env';
import { tickHaptic } from '@/shared/ui/haptics';
import { toast } from '@/shared/ui/toast';
import { radius } from '@/shared/ui/tokens';
import { useTheme } from '@/hooks/use-theme';

/** SDK ready 대기 한도 — 초과 시 일반 공유로 폴백 */
const READY_TIMEOUT_MS = 4000;

/**
 * 웹 KakaoInviteDialog와 동일한 피드 템플릿.
 * 초대 링크도 웹과 동일한 조인 URL(https://plando.imjaewoo.dev/#/join?code=X)을 사용해
 * 받는 사람이 웹 조인 페이지로 진입하게 한다(웹/모바일 모두 유효).
 */
function buildSharePayload(workspace: WorkspaceSummary) {
  const inviteCode = workspace.inviteCode ?? '';
  const workspaceName = workspace.workspaceName || '워크스페이스';
  const inviteUrl = `${WEB_APP_URL}/#/join?code=${encodeURIComponent(inviteCode)}`;
  return {
    objectType: 'feed',
    content: {
      title: `[${workspaceName}] 워크스페이스에 초대되었어요`,
      description: `Plan Do!에서 일정과 할 일을 함께 관리해보세요.\n초대 코드 ${inviteCode}`,
      imageUrl: `${WEB_APP_URL}/kakaoimg.jpg`,
      link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl },
    },
    buttons: [
      {
        title: '워크스페이스 참여하기',
        link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl },
      },
    ],
  };
}

/**
 * '카카오톡으로 초대' 행 + 숨김 WebView (Kakao JS SDK Share).
 * 지도(map-search)와 동일하게 baseUrl=KAKAO_MAP_REFERRER로 도메인 검증을 통과시키고,
 * sendDefault가 여는 kakaolink:// 등 비 http(s) 내비게이션은 시스템(Linking)으로 넘긴다.
 * 실패 시 toast 후 onFallbackShare(기존 일반 공유)로 폴백.
 */
export function KakaoInviteRow({
  workspace,
  onFallbackShare,
}: {
  workspace: WorkspaceSummary;
  onFallbackShare: () => void;
}) {
  const theme = useTheme();
  const webRef = useRef<WebView>(null);
  // ready 여부는 렌더에 안 쓰이므로 ref로만 추적 (불필요한 리렌더 방지)
  const statusRef = useRef<'loading' | 'ready' | 'error'>('loading');
  const pendingRef = useRef<string | null>(null); // ready 전에 탭한 경우 대기 중인 payload JSON
  const inFlightRef = useRef(false); // __share 주입 후 sent/error 대기 중
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const html = useState(() => buildKakaoShareHtml(KAKAO_SHARE_JS_KEY))[0];

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  const fallback = () => {
    toast.error('카카오톡 공유를 열 수 없어요');
    onFallbackShare();
  };

  const inject = (payloadJson: string) => {
    inFlightRef.current = true;
    webRef.current?.injectJavaScript(`window.__share(${payloadJson});true;`);
  };

  const onPress = () => {
    tickHaptic();
    if (!workspace.inviteCode) return;
    if (!KAKAO_SHARE_JS_KEY) {
      fallback();
      return;
    }
    const payloadJson = JSON.stringify(buildSharePayload(workspace));
    if (statusRef.current === 'ready') {
      inject(payloadJson);
      return;
    }
    if (statusRef.current === 'error') {
      fallback();
      return;
    }
    // 아직 로딩 중 — ready 도착 시 이어서 전송, 한도 내 미도착이면 폴백
    pendingRef.current = payloadJson;
    if (timerRef.current == null) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingRef.current != null) {
          pendingRef.current = null;
          fallback();
        }
      }, READY_TIMEOUT_MS);
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type?: string; message?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      statusRef.current = 'ready';
      const queued = pendingRef.current;
      pendingRef.current = null;
      if (queued != null) inject(queued);
    } else if (msg.type === 'sent') {
      inFlightRef.current = false; // 카카오톡(또는 공유창)이 열림 — 추가 동작 불필요
    } else if (msg.type === 'error') {
      if (statusRef.current !== 'ready') statusRef.current = 'error';
      const attempted = pendingRef.current != null || inFlightRef.current;
      pendingRef.current = null;
      inFlightRef.current = false;
      if (attempted) fallback(); // 사용자가 시도한 경우에만 알림 (SDK 선로딩 실패는 조용히)
    }
  };

  // Kakao.Share.sendDefault는 kakaolink:// (카카오톡 미설치 시 https 공유 페이지)로
  // 내비게이션한다 — 숨김 WebView 안에서 열리지 않도록 전부 시스템으로 넘긴다.
  const onShouldStart = (req: ShouldStartLoadRequest): boolean => {
    const url = req.url ?? '';
    if (url === 'about:blank' || url.startsWith('data:') || url.startsWith(KAKAO_MAP_REFERRER)) return true;
    // 시스템으로 여는 URL은 카카오 공유에 필요한 스킴만 허용 (임의 앱 딥링크 차단)
    const ALLOWED = ['kakaolink://', 'kakaotalk://', 'https://', 'itms-apps://'];
    if (ALLOWED.some((p) => url.startsWith(p))) {
      void Linking.openURL(url).catch(() => fallback());
    } else {
      fallback();
    }
    return false;
  };

  return (
    <>
      <WebView
        ref={webRef}
        style={styles.hidden}
        originWhitelist={['*']}
        source={{ html, baseUrl: KAKAO_MAP_REFERRER }}
        javaScriptEnabled
        // Android: window.open을 새 창 대신 내비게이션으로 → onShouldStart에서 시스템으로 위임
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
      />
      <Pressable
        onPress={onPress}
        style={[styles.row, { backgroundColor: theme.surfaceAlt }]}
        accessibilityRole="button"
        accessibilityLabel="카카오톡으로 초대">
        <View style={styles.kakaoBadge}>
          <ThemedText type="smallBold" style={styles.kakaoK}>
            K
          </ThemedText>
        </View>
        <ThemedText type="default" style={styles.flex}>
          카카오톡으로 초대
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  hidden: { width: 0, height: 0, position: 'absolute', opacity: 0 },
  flex: { flex: 1 },
  // 관리 시트의 group/groupRow와 동일한 룩
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.card, overflow: 'hidden', marginTop: 8, padding: 12 },
  // 카카오 브랜드 고정색 (웹 KakaoInviteDialog와 동일)
  kakaoBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FEE500', alignItems: 'center', justifyContent: 'center' },
  kakaoK: { color: '#3C1E1E', fontWeight: '900', fontSize: 12, lineHeight: 14 },
});
