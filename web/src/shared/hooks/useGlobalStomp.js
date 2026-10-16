import { useEffect } from "react";
import { stompSubscribe, stompReconnect } from "../api/stompClient.js";
import { APP_EVENTS } from "../constants/events.js";
import { getUser } from "../utils/tokenUtils.js";
import { useWorkspace } from "../../features/workspace/context/WorkspaceContext.jsx";

/**
 * 로그인된 사용자의 글로벌 STOMP 연결 유지 + presence 구독.
 * 전역 공유 클라이언트(stompClient)를 사용 — DM 방 구독과 동일 연결을 공유한다.
 * Layout.jsx 같은 인증된 root에서 1번만 호출.
 */
export function useGlobalStomp() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.workspaceId;

    /* 워크스페이스 할 일 변경 구독.
       예전엔 할 일 변경이 같은 탭 안에서만 전파돼(window 이벤트), 팀원이 카드를 옮겨도
       내 보드는 그대로였고 모르고 다시 옮기면 남의 작업을 덮어썼다.

       받은 메시지를 **기존 window 이벤트로 변환**한다 — 목록·보드·캘린더 등 22곳이 이미
       그 계약을 구독하고 있어서, 화면 코드를 한 줄도 고치지 않고 실시간이 된다. */
    useEffect(() => {
        if (!workspaceId) return undefined;
        const me = getUser();
        const myId = me?.id;
        const myEmail = me?.email;

        return stompSubscribe(`/topic/workspace/${workspaceId}/todos`, (msg) => {
            /* 내가 만든 변경은 낙관적 업데이트로 이미 반영돼 있다 — 다시 적용하면 카드가 두 번 움직인다.
               구버전 로그인 세션은 저장된 user에 id가 없을 수 있어 email로도 대조한다. */
            const mine =
                (msg?.actorId != null && myId != null && String(msg.actorId) === String(myId)) ||
                (msg?.actorEmail && myEmail && msg.actorEmail === myEmail);
            if (mine) return;

            if (msg?.type === "ADDED" && msg.todo) {
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: msg.todo }));
            } else if (msg?.type === "DELETED" && msg.todoId != null) {
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_DELETED, { detail: { id: msg.todoId } }));
            } else if (msg?.type === "UPDATED" && msg.todoId != null && msg.patch) {
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, {
                    detail: { id: msg.todoId, patch: msg.patch, archived: msg.patch.archived },
                }));
            }
        });
    }, [workspaceId]);

    useEffect(() => {
        const unsubscribe = stompSubscribe("/topic/presence", (payload) => {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.PRESENCE_CHANGED, { detail: payload }));
        });

        // 로그인/토큰 변경 시 재연결 (finalizeAuthSession이 SETTINGS_CHANGED 발화)
        const onTokenMaybeChanged = () => stompReconnect();
        window.addEventListener("storage", onTokenMaybeChanged);
        window.addEventListener(APP_EVENTS.SETTINGS_CHANGED, onTokenMaybeChanged);

        return () => {
            unsubscribe();
            window.removeEventListener("storage", onTokenMaybeChanged);
            window.removeEventListener(APP_EVENTS.SETTINGS_CHANGED, onTokenMaybeChanged);
        };
    }, []);
}
