import { CAT_CFG, AVATAR_COLORS } from "../constants/recruitmentConfig";

const DEFAULT_CAT_FALLBACK = { icon: "📌", desc: "" };

/** 이름 첫 글자의 charCode로 AVATAR_COLORS 중 하나를 선택 — 같은 이름은 항상 같은 색 */
export function avatarColor(name) {
    return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

/**
 * 카테고리 fallback — 모든 사용처에서 동일 fallback 보장
 * theme 지정 시 color도 theme.palette.primary.main 으로 채워줌.
 */
export function getCategory(typeLabel, theme) {
    const found = CAT_CFG[typeLabel];
    if (found) return found;
    return {
        ...DEFAULT_CAT_FALLBACK,
        color: theme?.palette?.primary?.main || "#5B8AF5",
    };
}

/** 모집 인원 텍스트 ("2/4명") — list/detail/map 공용 */
export function getMemberText(item) {
    if (!item) return "0/0명";
    // detail API: headCount = "현재/최대명" 포맷 문자열
    if (item.headCount) return item.headCount;
    // list API: members = "현재/최대명" 문자열 또는 멤버 배열
    if (Array.isArray(item.members)) {
        const cur = item.currentMembers ?? item.members.length ?? 0;
        const max = item.maxMembers ?? item.total ?? 0;
        return `${cur}/${max}명`;
    }
    if (item.members) return item.members;
    const cur = item.currentMembers ?? item.current ?? 0;
    const max = item.maxMembers ?? item.total ?? 0;
    return `${cur}/${max}명`;
}

/**
 * 마감 텍스트 — dueText > deadline > fallback
 * 기본 fallback은 "마감 정보 없음"; fallback=null 로 호출하면 둘 다 없을 때 null 반환 (조건부 렌더 용도).
 */
export function getDueText(item, { fallback = "마감 정보 없음" } = {}) {
    return item?.dueText || item?.deadline || fallback;
}

/** 위치 텍스트 — hasLocation 여부에 따라 short form / fallback */
export function getLocationText(item) {
    if (!item) return "온라인";
    if (!item.hasLocation) return item.locationText || item.location || "온라인";
    return (
        item.locationText?.split("·")[0]?.trim() ||
        item.locationText ||
        item.location ||
        "오프라인"
    );
}

const DETAIL_DEFAULTS = {
    techStacks: [],
    roles: [],
    processTags: [],
    progress: [],
    members: [],
    leader: { name: "-", role: "팀장" },
    headCount: "-",
    dueDate: "-",
    applicants: 0,
    views: 0,
    appliedStatus: null,
    isAuthor: false,
};

// leader userId 정규화: API마다 leaderId / authorId / leader.id / leader.userId 등 다양하게 올 수 있음
export function resolveLeaderId(item) {
    return (
        item.leader?.userId ||
        item.leader?.id ||
        item.leaderId ||
        item.authorId ||
        null
    );
}

export function enrichForDetail(item) {
    if (!item) return { ...DETAIL_DEFAULTS };

    // API detail 응답 형식인지 확인 (headCount 필드가 있거나 progress 배열이 있으면 detail 형식)
    const isDetailFormat = item.headCount !== undefined || item.progress !== undefined;

    if (isDetailFormat) {
        const leaderId = resolveLeaderId(item);
        const leaderRaw = item.leader || {};
        return {
            ...DETAIL_DEFAULTS,
            ...item,
            leader: {
                ...DETAIL_DEFAULTS.leader,
                ...leaderRaw,
                userId: leaderId,
            },
            leaderId,
            workspaceId: item.workspaceId || null,
            workspaceInviteCode: item.workspaceInviteCode || null,
            roles: (item.roles || []).map((r, i) =>
                typeof r === "string"
                    ? { id: i + 1, name: r, status: "모집중" }
                    : r
            ),
        };
    }

    // 목록 아이템에서 변환 (상세 API 로딩 전 기본값으로 표시)
    const leaderId = resolveLeaderId(item);
    return {
        ...DETAIL_DEFAULTS,
        id: item.id,
        title: item.title,
        summary: item.summary,
        techStacks: item.tags || item.techStacks || [],
        roles: (item.roles || []).map((r, i) =>
            typeof r === "string"
                ? { id: i + 1, name: r, status: "모집중" }
                : r
        ),
        locationText: item.locationText,
        locationLat: item.locationLat,
        locationLng: item.locationLng,
        hasLocation: item.hasLocation,
        headCount: item.members,
        dueDate: item.dueText,
        typeLabel: item.typeLabel,
        statusLabel: item.statusLabel,
        leader: {
            ...DETAIL_DEFAULTS.leader,
            name: item.author || "-",
            userId: leaderId,
        },
        leaderId,
        workspaceId: item.workspaceId || null,
        workspaceInviteCode: item.workspaceInviteCode || null,
        appliedStatus: item.appliedStatus || null,
    };
}

export function formatDueDateKorean(value)  {
    if (!value || value === "-") return value;

    const match = String(value).match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return value;

    const month = Number(match[1]);
    const day = Number(match[2]);

    return `${month}월 ${day}일`;
};
