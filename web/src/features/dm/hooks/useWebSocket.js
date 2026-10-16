import { useEffect, useRef } from "react";
import { stompSubscribe } from "../../../shared/api/stompClient.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

/**
 * DM 방 메시지 수신 — 전역 공유 STOMP 연결(stompClient)에 방 토픽만 구독.
 * (전송은 REST, 타이핑은 stompPublish 사용. 방 옮길 때 연결 재생성 없이 subscribe/unsubscribe만)
 */
export function useWebSocket({ roomId, onMessage }) {
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        if (!roomId) return undefined;
        const unsubscribe = stompSubscribe(`/topic/dm/${roomId}`, (msg) => {
            onMessageRef.current?.(msg);
        });
        window.dispatchEvent(new CustomEvent(APP_EVENTS.DM_UNREAD_CHANGED));
        return unsubscribe;
    }, [roomId]);
}
