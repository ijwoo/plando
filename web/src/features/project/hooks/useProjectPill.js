import { useActiveProject } from "../context/ActiveProjectContext.jsx";
import { resolveProject } from "../store/projectStore.js";

/**
 * 할 일 카드의 프로젝트 칩 노출 정책 (단일 진입점).
 * 칩 = "프로젝트에 속함" 표시: 전체 스코프에서만, 인박스(기본/소속 없음) todo는 칩 없음.
 * 데스크탑 BoardCard · MobileKanban · MobileListView 공용.
 */
export function useProjectPill(todo) {
    const { activeProjectId } = useActiveProject();
    const project = resolveProject(todo);
    return { project, show: activeProjectId == null && !!project };
}
