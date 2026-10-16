import { Client } from '@stomp/stompjs';
import { useCallback, useEffect, useRef } from 'react';

import { getToken } from '@/api/auth';
import type { DmMessage, DmTodoSuggestion } from '@/features/dm/api';
import { WS_BASE_URL } from '@/shared/config/env';

export type DmSocketHandlers = {
  /** 신규/수정/반응 갱신된 메시지 → 캐시 upsert */
  onMessage: (msg: DmMessage) => void;
  /** 메시지 삭제 → 캐시 제거 */
  onDelete?: (messageId: number) => void;
  /** 상대 타이핑 이벤트 */
  onTyping?: (info: { senderEmail: string; senderName: string }) => void;
  /** AI 할 일 제안 생성/종결 */
  onSuggestion?: (s: DmTodoSuggestion) => void;
  onSuggestionResolved?: (suggestionId: number) => void;
  /** 상대가 방을 읽음(READ_RECEIPT) — 읽음 표시 갱신용 */
  onReadReceipt?: () => void;
  /** 재연결(첫 연결 제외) — 끊긴 동안 놓친 메시지 refetch용 */
  onReconnect?: () => void;
};

/**
 * 화면이 떠 있는 동안 STOMP(raw WebSocket)로 /topic/dm/{roomId}를 구독한다.
 * STOMP CONNECT `Authorization` 헤더의 JWT로 인증 — 백엔드가 이미 강제하는 방식
 * (WebSocketConfig.configureClientInboundChannel)과 동일.
 *
 * 백엔드 브로드캐스트 포맷(DmController):
 *  - 신규 메시지: 래핑 없는 DmMessageResponse (type 없음)
 *  - {type:'MESSAGE_UPDATED', message}  — 수정/공지
 *  - {type:'REACTION_UPDATED', message} — 이모지 반응
 *  - {type:'MESSAGE_DELETED', messageId}
 *  - {type:'READ_RECEIPT'} / {type:'TYPING', senderEmail, senderName}
 *
 * 반환값 `sendTyping`으로 /app/dm.typing 발행(영속 X 일시 이벤트).
 */
export function useDmSocket(roomId: number, handlers: DmSocketHandlers) {
  const handlersRef = useRef(handlers);
  const clientRef = useRef<Client | null>(null);
  const connectedRef = useRef(false);
  const everConnectedRef = useRef(false);

  // 콜백 최신값 유지 (렌더 중 ref 변경 금지 → effect에서 갱신)
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let active = true;
    let client: Client | null = null;
    everConnectedRef.current = false; // 방이 바뀌면 새 클라이언트 — 첫 연결을 재연결로 오인하지 않게

    (async () => {
      const token = await getToken();
      if (!active || !token) return;

      client = new Client({
        webSocketFactory: () => new WebSocket(`${WS_BASE_URL}/ws`),
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 3000,
        onConnect: () => {
          // 재연결이면 끊긴 사이 메시지를 놓쳤을 수 있음 → 호출 측에서 refetch
          if (everConnectedRef.current) handlersRef.current.onReconnect?.();
          everConnectedRef.current = true;
          connectedRef.current = true;
          client?.subscribe(`/topic/dm/${roomId}`, (frame) => {
            try {
              const payload = JSON.parse(frame.body);
              const h = handlersRef.current;
              if (!payload) return;
              if (!payload.type && payload.id != null) {
                h.onMessage(payload as DmMessage);
              } else if (payload.type === 'MESSAGE_UPDATED' || payload.type === 'REACTION_UPDATED') {
                if (payload.message) h.onMessage(payload.message as DmMessage);
              } else if (payload.type === 'MESSAGE_DELETED') {
                if (payload.messageId != null) h.onDelete?.(Number(payload.messageId));
              } else if (payload.type === 'TYPING') {
                h.onTyping?.({
                  senderEmail: String(payload.senderEmail ?? ''),
                  senderName: String(payload.senderName ?? ''),
                });
              } else if (payload.type === 'TODO_SUGGESTION') {
                if (payload.suggestion) h.onSuggestion?.(payload.suggestion as DmTodoSuggestion);
              } else if (payload.type === 'TODO_SUGGESTION_RESOLVED') {
                if (payload.suggestionId != null) h.onSuggestionResolved?.(Number(payload.suggestionId));
              } else if (payload.type === 'READ_RECEIPT') {
                h.onReadReceipt?.();
              }
            } catch {
              // 잘못된/비-JSON 프레임 무시
            }
          });
        },
        onDisconnect: () => {
          connectedRef.current = false;
        },
      });
      clientRef.current = client;
      client.activate();
    })();

    return () => {
      active = false;
      connectedRef.current = false;
      clientRef.current = null;
      void client?.deactivate();
    };
  }, [roomId]);

  /** 타이핑 인디케이터 발행 (연결 안 됐으면 조용히 무시) */
  const sendTyping = useCallback(
    (senderName: string) => {
      if (!connectedRef.current) return;
      try {
        clientRef.current?.publish({
          destination: '/app/dm.typing',
          body: JSON.stringify({ roomId, senderName }),
        });
      } catch {
        // 발행 실패 무시 (일시 이벤트)
      }
    },
    [roomId],
  );

  return { sendTyping };
}
