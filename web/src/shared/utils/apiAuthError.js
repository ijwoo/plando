import { removeToken } from "./tokenUtils.js";

/**
 * 워크스페이스 접근 권한 없음(403) 안내 문구.
 * 401(토큰 만료)과 달리 토큰은 여전히 유효하므로 로그아웃하지 않는다 —
 * 세션·작성 중이던 내용을 지키고, 상단 워크스페이스 전환으로 복구를 유도한다.
 */
export const WORKSPACE_FORBIDDEN_MESSAGE =
    "이 워크스페이스에 접근 권한이 없어요. 상단 워크스페이스 메뉴에서 다른 워크스페이스를 선택해 주세요.";

/**
 * 목록 조회 실패 공통 처리.
 * - 401: 토큰 만료 → 토큰 제거 후 로그인으로 이동 (기존 동작 유지)
 * - 403: 권한만 없음 → 로그아웃하지 않고 안내 문구를 반환, 화면이 렌더
 * - 그 외: 콘솔 로그만
 *
 * @returns {string|null} 403이면 사용자에게 보여줄 안내 문구, 아니면 null
 */
export function resolveListFetchError(e, { nav, context } = {}) {
    const status = e?.response?.status;

    if (status === 401) {
        removeToken();
        nav?.("/login");
        return null;
    }

    if (status === 403) {
        return WORKSPACE_FORBIDDEN_MESSAGE;
    }

    console.error(context ?? "목록 조회 실패", e);
    return null;
}
