import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * 활성 탭 재탭 → 맨 위로 스크롤 (iOS 관례).
 * NativeTabs의 tabPress는 탭 전환 시에도 오므로, 구독 측에서 "이미 포커스된 상태"일 때만 반응한다.
 */
type Fn = () => void;
const listeners = new Map<string, Set<Fn>>();

export const tabRetap = {
  emit(tab: string) {
    listeners.get(tab)?.forEach((f) => f());
  },
};

/** 탭 화면에서 사용 — 자기 탭이 재탭되면(이미 포커스 중일 때만) handler 실행 */
export function useTabRetap(tab: string, handler: Fn) {
  const focusedRef = useRef(false);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );
  useEffect(() => {
    const fn = () => {
      if (focusedRef.current) handlerRef.current();
    };
    if (!listeners.has(tab)) listeners.set(tab, new Set());
    const set = listeners.get(tab)!;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }, [tab]);
}
