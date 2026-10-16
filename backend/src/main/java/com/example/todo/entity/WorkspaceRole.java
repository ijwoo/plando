package com.example.todo.entity;

/**
 * 워크스페이스 역할 (RBAC). 위계: OWNER > ADMIN > MEMBER > VIEWER.
 * enum 확장(2→4)이라 기존 데이터(OWNER/MEMBER 문자열)는 그대로 유효 — DB 마이그레이션 불필요.
 *  - OWNER : 소유자(정확히 1명). 모든 권한 + 소유권 이전 + 워크스페이스 삭제. 강등 불가.
 *  - ADMIN : 멤버·역할 관리, 설정, 모든 콘텐츠 CRUD.
 *  - MEMBER: 콘텐츠 생성·수정·완료. 삭제는 본인 작성분만.
 *  - VIEWER: 읽기 전용 + 코멘트만.
 */
public enum WorkspaceRole {
    OWNER(3),
    ADMIN(2),
    MEMBER(1),
    VIEWER(0);

    /** 위계 서열 — 값이 클수록 상위 권한. 역할 비교(예: ADMIN 이상)에 사용. */
    private final int rank;

    WorkspaceRole(int rank) {
        this.rank = rank;
    }

    public int rank() {
        return rank;
    }

    /** this 역할이 최소 요구 역할(min) 이상인가. */
    public boolean atLeast(WorkspaceRole min) {
        return this.rank >= min.rank;
    }

    /** this 역할이 other보다 상위인가(강퇴·강등 시 대상보다 상위여야 함). */
    public boolean isHigherThan(WorkspaceRole other) {
        return this.rank > other.rank;
    }
}
