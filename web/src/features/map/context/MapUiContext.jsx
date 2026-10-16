import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import useMapTasks from "../hooks/useMapTasks.js";
import { filterTodosByRecurrence } from "../../todo/utils/todoFilters.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";

/**
 * 지도 UI 상태 공유 컨텍스트.
 * - 사이드바 맥락 패널(SidebarMapPanel)과 지도 페이지(MapTaskPage)가 같은 필터·검색·선택을 공유.
 *   (지도 필터는 마커 자체를 바꾸므로 페이지/패널이 같은 상태를 봐야 일관)
 * - 위치 할 일 조회는 /map 진입 시에만(useMapTasks enabled) — 앱 전역 마운트지만 다른 페이지선 fetch 안 함.
 */
const MapUiContext = createContext(null);

export function MapUiProvider({ children }) {
    const location = useLocation();
    const active = location.pathname.startsWith("/map");

    const { tasks, loading, refresh } = useMapTasks(active);
    const { matchesActiveProject } = useActiveProject();

    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selectedTask, setSelectedTask] = useState(null);
    const [recurringOnly, setRecurringOnly] = useState(false);

    const currentUserEmail = useMemo(() => getUser()?.email ?? null, []);

    const isMineTask = (t) =>
        t.assignees?.some((a) => (typeof a === "string" ? a : a?.email) === currentUserEmail);

    // 상태 필터 '전' 단계 — 프로젝트 스코프 + 검색 + 반복만 적용 (상태/내할일은 미적용)
    const baseTasks = useMemo(() => {
        let result = tasks.filter((t) => matchesActiveProject(t));
        if (search.trim()) {
            const kw = search.trim().toLowerCase();
            result = result.filter((t) =>
                t.title?.toLowerCase().includes(kw) ||
                t.locationName?.toLowerCase().includes(kw) ||
                t.locationAddress?.toLowerCase().includes(kw)
            );
        }
        return filterTodosByRecurrence(result, recurringOnly);
    }, [tasks, matchesActiveProject, search, recurringOnly]);

    // 칩에 표시할 상태별 카운트 (상태 필터를 적용하기 전 baseTasks 기준)
    const counts = useMemo(() => ({
        all: baseTasks.length,
        todo: baseTasks.filter((t) => t.status === "TODO").length,
        in_progress: baseTasks.filter((t) => t.status === "IN_PROGRESS").length,
        done: baseTasks.filter((t) => t.status === "DONE").length,
        mine: baseTasks.filter(isMineTask).length,
    }), [baseTasks, currentUserEmail]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredTasks = useMemo(() => {
        if (filter === "mine")        return baseTasks.filter(isMineTask);
        if (filter === "todo")        return baseTasks.filter((t) => t.status === "TODO");
        if (filter === "in_progress") return baseTasks.filter((t) => t.status === "IN_PROGRESS");
        if (filter === "done")        return baseTasks.filter((t) => t.status === "DONE");
        return baseTasks;
    }, [baseTasks, filter, currentUserEmail]); // eslint-disable-line react-hooks/exhaustive-deps

    // 필터 변경 시 선택 태스크가 목록에서 사라지면 초기화
    useEffect(() => {
        if (selectedTask && !filteredTasks.find((t) => t.id === selectedTask.id)) {
            setSelectedTask(null);
        }
    }, [filteredTasks, selectedTask]);

    // refresh 후 selectedTask 데이터 최신화 (완료 처리 등 상태 변경 반영)
    useEffect(() => {
        if (!selectedTask) return;
        const updated = tasks.find((t) => t.id === selectedTask.id);
        if (updated && updated !== selectedTask) {
            setSelectedTask(updated);
        }
    }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

    // 상세 패널에서 "지도에서 보기"로 진입 시 해당 업무 포커싱 (focusTodoId 네비 채널)
    useEffect(() => {
        const focusId = location.state?.focusTodoId;
        if (!focusId || tasks.length === 0) return;
        const target = tasks.find((t) => t.id === focusId);
        if (target) {
            setSelectedTask(target);
            window.history.replaceState({}, "");
        }
    }, [tasks, location.state?.focusTodoId]);

    const value = useMemo(
        () => ({
            tasks, filteredTasks, counts, loading, refresh,
            filter, setFilter,
            search, setSearch,
            selectedTask, setSelectedTask,
            recurringOnly, setRecurringOnly,
            currentUserEmail,
        }),
        [tasks, filteredTasks, counts, loading, refresh, filter, search, selectedTask, recurringOnly, currentUserEmail]
    );

    return <MapUiContext.Provider value={value}>{children}</MapUiContext.Provider>;
}

export function useMapUi() {
    const ctx = useContext(MapUiContext);
    if (!ctx) throw new Error("useMapUi must be used within a MapUiProvider");
    return ctx;
}
