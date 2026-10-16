import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { Widget } from '@/native-modules/widget';
import { toDraft } from './shareDraft';
import { toast } from '@/shared/ui/toast';

/**
 * 공유 인박스 브리지 (인증 시 루트 마운트, 렌더 없음).
 * 공유 확장(PlandoShare)이 App Group에 적재한 텍스트/링크를 콜드스타트·포그라운드 복귀 시 소비해
 * 최신 1건은 할 일 작성 화면으로 프리필, 나머지는 개수 토스트로 알린다.
 */
export function ShareInboxBridge() {
  const router = useRouter();
  const consuming = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const consume = () => {
      if (consuming.current) return;
      consuming.current = true;
      try {
        const items = Widget.consumeShareInbox();
        if (items.length === 0) return;
        const latest = items[items.length - 1];
        const { title, content } = toDraft(latest);
        if (items.length > 1) toast.info(`공유받은 항목 ${items.length}개 중 최신 항목을 열었어요`);
        router.push({ pathname: '/todo/new', params: { title, ...(content ? { content } : {}) } });
      } finally {
        consuming.current = false;
      }
    };

    // 콜드스타트 소비 — 네비게이터 마운트 여유를 두고 1회
    const t = setTimeout(consume, 600);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') consume();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [router]);

  return null;
}
