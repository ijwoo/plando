import { requireNativeModule } from 'expo-modules-core';

/**
 * Live Activity 브릿지 (PlandoLiveActivityModule) — 오늘 진행을 잠금화면·다이나믹 아일랜드에.
 * 네이티브 모듈이 없는 빌드(리빌드 전)에선 조용히 no-op.
 */

type NativeModuleShape = {
  startOrUpdate: (day: string, done: number, total: number, nextTitle: string | null, nextTime: string | null, nextId: number | null) => void;
  end: () => void;
};

function native(): NativeModuleShape | null {
  try {
    return requireNativeModule<NativeModuleShape>('PlandoLiveActivity');
  } catch {
    return null;
  }
}

export const LiveActivity = {
  startOrUpdate(day: string, done: number, total: number, nextTitle: string | null, nextTime: string | null, nextId: number | null): void {
    try {
      native()?.startOrUpdate(day, done, total, nextTitle, nextTime, nextId);
    } catch {
      // 무시
    }
  },
  end(): void {
    try {
      native()?.end();
    } catch {
      // 무시
    }
  },
};
