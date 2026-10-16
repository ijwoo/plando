import { useState, useEffect, useCallback } from "react";
import { fetchDmRooms } from "../api/dmApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";

export function useDmUnreadCount() {
    const [count, setCount] = useState(0);
    const { currentWorkspace } = useWorkspace();

    const load = useCallback(() => {
        fetchDmRooms()
            .then((res) => {
                const total = (res.data || []).reduce((sum, r) => sum + (r.unreadCount || 0), 0);
                setCount(total);
            })
            .catch(() => {});
    }, []);

    // 워크스페이스 변경 시 카운트 초기화 후 재조회
    useEffect(() => {
        setCount(0);
        load();
    }, [currentWorkspace?.workspaceId]);

    useEffect(() => {
        const timer = setInterval(load, 15000);
        window.addEventListener(APP_EVENTS.DM_UNREAD_CHANGED, load);
        return () => {
            clearInterval(timer);
            window.removeEventListener(APP_EVENTS.DM_UNREAD_CHANGED, load);
        };
    }, [load]);

    return count;
}
