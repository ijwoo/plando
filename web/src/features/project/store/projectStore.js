import { useEffect, useReducer } from "react";
import api from "../../../shared/api/axiosInstance.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

/**
 * 프로젝트 스토어 — 서버(/api/projects)가 진실, 모듈 캐시로 동기 조회 지원.
 * 로딩은 ActiveProjectProvider(워크스페이스 변경 시)가 트리거한다.
 * 변경(생성/수정/삭제/소속 변경) 후 PROJECTS_CHANGED 발행 → 구독 컴포넌트 리렌더.
 */
export const PROJECTS_CHANGED = "plando:projects-changed";

export const PROJECT_COLORS = [
    "#F59E0B", "#3B82F6", "#10B981", "#A855F7", "#EF4444",
    "#06B6D4", "#EC4899", "#84CC16", "#6366F1", "#F97316",
];

let PROJECTS = [];
let LOADED = false;

const emit = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(PROJECTS_CHANGED));
};

export function getProjects() {
    return PROJECTS;
}

/**
 * 목록을 한 번이라도 받아왔는지 — "빈 목록"과 "아직 로딩 전"을 구분한다.
 * 프로젝트 상세/개요가 로딩 중에 "찾을 수 없어요"를 깜빡이지 않게 하는 용도.
 */
export function projectsLoaded() {
    return LOADED;
}

/** 로그아웃/워크스페이스 이탈 시 메모리 캐시 정리 — 다음 계정에 이전 목록이 비치지 않게 */
export function clearProjects() {
    PROJECTS = [];
    LOADED = false;
    emit();
}

export function getProjectById(id) {
    return PROJECTS.find((p) => p.id === id) || null;
}

/** 워크스페이스의 프로젝트 목록 로드 (X-Workspace-Id는 인터셉터가 주입) */
export async function loadProjects() {
    const res = await api.get("/projects");
    PROJECTS = res.data ?? [];
    LOADED = true;
    emit();
    return PROJECTS;
}

export async function addProject({ name, color, icon } = {}) {
    const res = await api.post("/projects", { name, color, icon });
    await loadProjects();
    return res.data;
}

export async function updateProjectById(id, { name, color, icon } = {}) {
    const res = await api.put(`/projects/${id}`, { name, color, icon });
    await loadProjects();
    return res.data;
}

export async function deleteProjectById(id) {
    await api.delete(`/projects/${id}`);
    await loadProjects();
}

/** 프로젝트 개요 활동 피드 — 소속 할 일들의 최근 변경 로그 (TodoLogResponseDto[]) */
export async function getProjectActivity(id) {
    const res = await api.get(`/projects/${id}/activity`);
    return res.data ?? [];
}

/**
 * todo → 소속 프로젝트 해석 (단일 진입점).
 * projectId == null = 인박스(소속 없음) → null 반환.
 */
export function resolveProject(todo) {
    if (!todo || todo.projectId == null) return null;
    return getProjectById(todo.projectId);
}

/**
 * 소속 변경 + 소비자 통지 (상세 패널 데스크탑/모바일 공용).
 * patch에 projectId를 실어 보드/목록/캘린더가 todo를 갱신하고 스코프 필터를 재평가하게 함.
 */
export async function assignTodoToProjectAndNotify(todoId, scope) {
    if (todoId == null) return;
    const isInbox = scope == null || scope === "inbox";
    await api.patch(`/todos/${todoId}`, { field: "projectId", value: isInbox ? "inbox" : String(scope) });
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, {
            detail: { id: todoId, patch: { projectId: isInbox ? null : Number(scope) } },
        }));
    }
    // 카운트 갱신
    loadProjects().catch(() => {});
}

/** 프로젝트 목록 변경에 반응해 리렌더되는 훅 (캐시 반환) */
export function useProjects() {
    const [, force] = useReducer((x) => x + 1, 0);
    useEffect(() => {
        const h = () => force();
        window.addEventListener(PROJECTS_CHANGED, h);
        return () => window.removeEventListener(PROJECTS_CHANGED, h);
    }, []);
    return PROJECTS;
}
