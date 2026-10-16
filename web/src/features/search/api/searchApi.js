import axiosInstance from "../../../shared/api/axiosInstance.js";

/**
 * 전체 검색 API
 *
 * GET /search?q={query}&page={0-base}
 * Header: X-Workspace-Id (axiosInstance 인터셉터에서 자동 주입)
 *
 * page는 할 일에만 적용된다(한 페이지 30건, 관련도순: 제목 완전일치 → 제목 시작 → 제목 포함 → 본문).
 * 메시지·멤버·프로젝트는 0페이지에만 실려 오고 1페이지부터는 빈 배열이다.
 * 할 일 결과에는 보관(archived)된 항목도 포함되지만, 어느 것이 보관인지는 응답에 없다.
 *
 * --- 백엔드 응답 스펙 ---
 * {
 *   tasks: Array<{
 *     id: number,
 *     title: string,
 *     status: "TODO" | "IN_PROGRESS" | "DONE",
 *     priority: "HIGH" | "MEDIUM" | "LOW",
 *     dueDate: string | null,          // "YYYY-MM-DD"
 *     assignees: Array<{
 *       name: string,
 *       profileImageUrl: string | null
 *     }>
 *   }>,
 *   hasMoreTasks: boolean,             // 다음 페이지 존재 여부 ('더 보기' 판단용)
 *   projects: Array<{
 *     id: number,
 *     name: string,
 *     color: string | null,            // 프로젝트 지정 색(hex)
 *     openCount: number                // 미완료 할 일 수
 *   }>,
 *   messages: Array<{
 *     roomId: number,
 *     partnerId: number,
 *     partnerName: string,
 *     partnerProfileImageUrl: string | null,
 *     lastMessage: string,
 *     sentAt: string                   // ISO datetime
 *   }>,
 *   members: Array<{
 *     userId: number,
 *     name: string,
 *     email: string,
 *     profileImageUrl: string | null,
 *     role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"   // WorkspaceRole enum 그대로
 *   }>
 * }
 */
export function searchAll(q, page = 0) {
    return axiosInstance.get("/search", { params: { q, page } });
}
