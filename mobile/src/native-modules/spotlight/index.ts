import { requireNativeModule } from 'expo-modules-core';

/**
 * Spotlight 브릿지 — 로컬 Expo 모듈(modules/plando-spotlight) 래퍼.
 * 할 일을 iOS 시스템 검색(CoreSpotlight)에 색인한다. uniqueIdentifier "todo-<id>",
 * domainIdentifier "todos". 결과 탭 시 네이티브 AppDelegate 구독자가
 * plando://todo/<id> 딥링크로 상세 화면을 연다.
 * 네이티브 모듈이 없는 빌드(리빌드 전)에서는 조용히 no-op.
 */
export type SpotlightTodo = {
  id: number;
  title: string;
  content?: string | null;
  due?: string | null;
};

type NativeModuleShape = {
  indexTodos: (itemsJson: string) => void;
  clearAll: () => void;
};

function native(): NativeModuleShape | null {
  try {
    return requireNativeModule<NativeModuleShape>('PlandoSpotlight');
  } catch {
    return null; // 리빌드 전 — Spotlight 색인만 조용히 생략
  }
}

export const Spotlight = {
  /** 전체 재색인 — 네이티브가 domain("todos") 삭제 후 다시 색인한다 */
  indexTodos(items: SpotlightTodo[]): void {
    try {
      native()?.indexTodos(JSON.stringify(items));
    } catch {
      // 무시
    }
  },
  /** 로그아웃 등 — 색인 전체 제거 */
  clearAll(): void {
    try {
      native()?.clearAll();
    } catch {
      // 무시
    }
  },
};
