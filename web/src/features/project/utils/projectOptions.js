import { alpha } from "@mui/material/styles";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { getProjectIcon } from "../projectIcons.js";

/**
 * 프로젝트 아이콘 표시 색 — 원색 풀채도는 톤이 과해 한 단계 낮춤 (UI 톤 리뷰 ③).
 * 아이콘을 그리는 모든 곳이 이 함수를 거친다 — 강도 조절은 여기 한 곳에서.
 */
export function projectIconColor(color) {
    return color ? alpha(color, 0.85) : undefined;
}

/**
 * "인박스 + 프로젝트" 선택 옵션 공통 빌더.
 * 새 할 일 폼(Select)·상세 패널(아코디언) 데스크탑/모바일 4곳이 같은 목록을 그린다 —
 * 아이콘/색 해석은 여기 한 곳에서. (mock — 백엔드 연동 시에도 이 모양 유지)
 */
export function buildProjectOptions(projects = []) {
    return [
        { key: "inbox", label: "인박스", icon: InboxRoundedIcon, color: null },
        ...projects.map((p) => ({ key: p.id, label: p.name, icon: getProjectIcon(p.icon), color: p.color })),
    ];
}

/** 새 할 일 폼의 소속 기본값 — 폼 선택값 > 현재 스코프(프로젝트) > 인박스 */
export function getDefaultProjectScope(task, activeProjectId) {
    return task?.projectScope ?? (typeof activeProjectId === "number" ? activeProjectId : "inbox");
}
