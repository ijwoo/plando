import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { fetchLocationTodos } from "../api/mapApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

export default function useMapTasks(enabled = true) {
    const { currentWorkspace } = useWorkspace();

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!enabled || !currentWorkspace?.workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchLocationTodos();
            setTasks(res.data ?? []);
        } catch (e) {
            console.error("위치 할 일 조회 실패", e);
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [enabled, currentWorkspace?.workspaceId]);

    useEffect(() => {
        load();
    }, [load]);

    /* 다른 페이지/패널에서 todo 변경 시 자동 동기화 */
    useEffect(() => {
        const events = [APP_EVENTS.TODO_UPDATED, APP_EVENTS.TODO_ADDED, APP_EVENTS.TODO_DELETED];
        events.forEach((ev) => window.addEventListener(ev, load));
        return () => events.forEach((ev) => window.removeEventListener(ev, load));
    }, [load]);

    return { tasks, loading, error, refresh: load };
}
