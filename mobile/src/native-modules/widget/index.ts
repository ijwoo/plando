import { requireNativeModule } from 'expo-modules-core';

/**
 * 위젯 브릿지 — 로컬 Expo 모듈(modules/plando-widget) 래퍼.
 * 기존 Capacitor WidgetBridge와 동일한 App Group(group.com.imjaewoo.plando)·키 계약이라
 * 컷오버 시 기존 WidgetKit 익스텐션이 그대로 데이터를 읽는다.
 * 네이티브 모듈이 없는 빌드(리빌드 전)에서는 조용히 no-op.
 */
export type WidgetTodo = {
  id: number;
  title: string;
  priority: string;
  status: string;
  starred: boolean;
  dueDate: string | null;
  dDay: string | null;
  projectId: number | null;
};

export type WidgetPayload = {
  total: number;
  done: number;
  todos: WidgetTodo[];
  calendarTodos: WidgetTodo[];
  workspaceName?: string;
};

type NativeModuleShape = {
  updateTodos: (payloadJson: string) => void;
  setLoggedIn: (value: boolean, token: string | null, workspaceId: string | null, apiBase: string | null) => void;
  clear: () => void;
  consumeShareInbox: () => string | null;
  setAppLockEnabled: (value: boolean) => void;
};

/** 공유 확장이 App Group에 적재한 항목 */
export type SharedInboxItem = { text?: string; url?: string; sharedAt?: string };

function native(): NativeModuleShape | null {
  try {
    return requireNativeModule<NativeModuleShape>('PlandoWidget');
  } catch {
    return null; // 리빌드 전 — 위젯 동기화만 조용히 생략
  }
}

export const Widget = {
  updateTodos(payload: WidgetPayload): void {
    try {
      native()?.updateTodos(JSON.stringify(payload));
    } catch {
      // 무시
    }
  },
  setLoggedIn(value: boolean, token?: string | null, workspaceId?: number | null, apiBase?: string | null): void {
    try {
      native()?.setLoggedIn(value, token ?? null, workspaceId != null ? String(workspaceId) : null, apiBase ?? null);
    } catch {
      // 무시
    }
  },
  clear(): void {
    try {
      native()?.clear();
    } catch {
      // 무시
    }
  },
  /**
   * 앱 잠금 설정을 App Group에 동기화 — 네이티브 앱 스위처 스냅샷 커버
   * (PlandoPrivacyShieldSubscriber)가 읽는다. 모듈 미포함 빌드에선 no-op.
   */
  setAppLockEnabled(value: boolean): void {
    try {
      native()?.setAppLockEnabled(value);
    } catch {
      // 무시
    }
  },
  /** 공유 확장 인박스 읽고 비우기 — 없거나 모듈 미포함이면 [] */
  consumeShareInbox(): SharedInboxItem[] {
    try {
      const raw = native()?.consumeShareInbox();
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SharedInboxItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
};

/** 공유 App Group 식별자 (기존 iOS 위젯 타겟과 일치) */
export const APP_GROUP_ID = 'group.com.imjaewoo.plando';
