import { useEffect, useRef } from 'react';

import { isTodoDone } from '@/features/status/queries';
import { toast } from '@/shared/ui/toast';
import { syncGeofences, type GeofenceRegion } from './geofence';
import { useLocationTodos, useTriggers } from './queries';

/**
 * 인증 상태에서 루트에 마운트되는 지오펜스 브리지(렌더 없음).
 * 지도 화면에 들어가지 않아도 트리거·위치 할 일 변경(완료/삭제/이동)이
 * OS 지오펜스에 반영되도록 앱 전역에서 동기화한다.
 * 권한이 없거나 iOS 상한(20개)에 걸려 잘리면 **한 번만** 안내한다. 예전엔 콘솔에만 남아
 * 사용자는 켜 둔 도착 알림이 왜 안 울리는지 알 방법이 없었다.
 */
export function GeofenceBridge() {
  const { data: triggers } = useTriggers();
  const { data: locationTodos } = useLocationTodos();

  // 같은 안내를 매 동기화마다 띄우지 않기 위한 표식 (렌더에 영향 없어 ref가 맞다)
  const notified = useRef<string>('');

  useEffect(() => {
    // 둘 다 로드되기 전에는 건드리지 않는다 — 빈 목록으로 기존 지오펜스를 지우는 것 방지
    if (triggers == null || locationTodos == null) return;
    const regs = Object.entries(triggers)
      .filter(([, t]) => t?.enabled)
      .map(([tid, t]) => {
        const todo = locationTodos.find((x) => x.id === Number(tid));
        // 삭제됐거나 좌표가 없거나 완료된 할 일의 트리거는 해제
        if (!todo || todo.locationLat == null || todo.locationLng == null || isTodoDone(todo)) return null;
        return {
          todoId: Number(tid),
          lat: todo.locationLat,
          lng: todo.locationLng,
          radius: t?.radius ?? 500,
          dueDate: todo.dueDate ?? null,
        };
      })
      .filter((r): r is GeofenceRegion & { dueDate: string | null } => r != null)
      // iOS는 20개까지만 등록된다. 정렬 없이 넘기면 객체 키 순서대로 잘려서 **어느 알림이
      // 죽는지 예측 불가**였다. 마감이 임박한 것부터 채운다(마감 없는 건 뒤로).
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

    void syncGeofences(regs).then((r) => {
      const key = r.ok ? (r.dropped > 0 ? `dropped:${r.dropped}` : '') : r.reason;
      if (!key || notified.current === key) return;
      notified.current = key;
      if (!r.ok) {
        toast.error(
          r.reason === 'no-permission'
            ? '위치 권한(항상 허용)이 없어 도착 알림이 동작하지 않아요'
            : '도착 알림을 등록하지 못했어요',
        );
      } else {
        toast.info(`도착 알림은 20개까지만 동작해요 — 마감이 늦은 ${r.dropped}개는 제외했어요`);
      }
    });
  }, [triggers, locationTodos]);

  return null;
}
