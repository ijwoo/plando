/**
 * 팀 모집 기능 공용 상수
 * CAT_CFG, STACK_COLORS 를 여기서 한 번만 정의합니다.
 * 모든 recruitment 컴포넌트는 반드시 이 파일에서 import 해야 합니다.
 */

export const CAT_CFG = {
    "토이프로젝트": { icon: "🚀", color: "#5B8AF5", desc: "가볍게 만들어보는 프로젝트" },
    "사이드프로젝트": { icon: "⚡", color: "#9B7BF5", desc: "짧고 굵게 완성하는 프로젝트" },
    "스터디":        { icon: "📚", color: "#2DD4A0", desc: "함께 공부하며 성장하는 모임" },
    "기타":          { icon: "✨", color: "#F5A623", desc: "그 외 모집" },
};

export const STACK_COLORS = {
    "React":        "#61DAFB",
    "TypeScript":   "#3178C6",
    "Spring":       "#6DB33F",
    "Node.js":      "#339933",
    "Flutter":      "#54C5F8",
    "Figma":        "#F24E1E",
    "Next.js":      "#D0D0D0",
    "Python":       "#3776AB",
    "Vue":          "#4FC08D",
    "Kotlin":       "#7F52FF",
    "AWS":          "#FF9900",
    "Firebase":     "#FFCA28",
    "PostgreSQL":   "#336791",
    "MySQL":        "#4479A1",
    "JPA":          "#6DB33F",
    "UI/UX":        "#F472C8",
    "JavaScript":   "#F7DF1E",
    "NestJS":       "#E0234E",
    "Django":       "#092E20",
    "Docker":       "#2496ED",
    "Redis":        "#DC382D",
    "GraphQL":      "#E10098",
};

/** 탭 목록 (desktop/mobile 공용) */
export const RECRUITMENT_TABS = [
    { id: "browse",     label: "둘러보기",    mobileLabel: "둘러보기" },
    { id: "applied",    label: "내 신청",      mobileLabel: "내 신청" },
    { id: "mine",       label: "내가 만든 모집", mobileLabel: "내가 만든" },
    { id: "bookmarked", label: "북마크",       mobileLabel: "북마크" },
];

/** 진행 방식 필터 칩 목록 (desktop/mobile 공용) */
export const RECRUITMENT_FILTERS = [
    { id: "all",     label: "전체" },
    { id: "online",  label: "온라인" },
    { id: "offline", label: "오프라인" },
    { id: "nearby",  label: "내 근처" },
];

/** 내 신청 탭 상태 필터 */
export const APPLICATION_STATUS_FILTERS = [
    { id: "all",      label: "전체" },
    { id: "accepted", label: "수락됨" },
    { id: "pending",  label: "대기 중" },
    { id: "rejected", label: "거절" },
];

/**
 * 빈 상태 문구 — desktop/mobile 공용 single source.
 * 예전엔 두 플랫폼이 이모지("📝" vs "✏️")·띄어쓰기("지원해보세요" vs "지원해 보세요")·
 * 문장부호가 제각각이었습니다. 버튼 톤(모바일 contained / 데스크탑 ink)만 플랫폼 고유.
 */
export const RECRUITMENT_EMPTY_STATES = {
    search:     { emoji: "🔍", title: "검색 결과가 없어요",       desc: "다른 키워드나 필터로 다시 찾아보세요." },
    appStatus:  { emoji: "🔍", title: "해당 상태의 신청이 없어요", desc: "다른 필터를 선택해 보세요." },
    applied:    { emoji: "📬", title: "신청한 모집이 없어요",      desc: "관심 있는 팀에 지원해 보세요.",             actionLabel: "팀 둘러보기" },
    mine:       { emoji: "📝", title: "만든 모집글이 없어요",      desc: "팀원을 찾고 있다면 모집글을 올려보세요.",     actionLabel: "모집글 올리기" },
    bookmarked: { emoji: "🔖", title: "북마크한 모집이 없어요",    desc: "관심 있는 모집글에 북마크를 눌러 저장해 보세요.", actionLabel: "팀 둘러보기" },
    loadError:  { emoji: "⚠️", title: "목록을 불러오지 못했어요",  desc: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", actionLabel: "재시도" },
};

/** 내 근처 거리 옵션 (desktop/mobile 공용) */
export const NEARBY_KM_OPTIONS = [
    { id: 3, label: "3km" },
    { id: 5, label: "5km" },
    { id: 7, label: "7km" },
];

/**
 * 입력 길이 한도 — 한 곳에서 관리.
 * 신청 메시지(짧은 자기소개)와 Q&A 질문(길게 물어볼 수 있음)은 의도된 차이.
 */
export const RECRUITMENT_LIMITS = {
    APPLY_MESSAGE: 300,
    QUESTION: 500,
};

/** 작성자/팀원 아바타에 사용할 단색 팔레트 (이름 charCode 해시로 결정) */
export const AVATAR_COLORS = [
    "#5B8AF5",
    "#9B7BF5",
    "#F5A623",
    "#2DD4A0",
    "#F26B6B",
    "#F472C8",
];

/**
 * 진행 방식 (online / offline / hybrid) — single source.
 * - icon: 모든 표시 영역(생성 폼/리스트 카드/상세) 공통 아이콘
 * - label: 컴팩트 라벨 (배지/칩용)
 * - longLabel: 폼 선택지 등 길게 표현하는 곳
 * - colorKey: theme.palette[colorKey].main 으로 해석 (사용처에서)
 */
export const MEET_TYPE_CFG = {
    online:  { icon: "🌐", label: "온라인",  longLabel: "온라인 전용",  colorKey: "success" },
    offline: { icon: "📍", label: "오프라인", longLabel: "오프라인 전용", colorKey: "primary" },
    hybrid:  { icon: "⚡", label: "온/오프",  longLabel: "온/오프 혼합",  colorKey: "warning" },
};

/** 폼 선택지 배열로도 노출 (배열 순회가 필요한 곳용) */
export const MEET_TYPE_LIST = Object.keys(MEET_TYPE_CFG).map((id) => ({
    id,
    ...MEET_TYPE_CFG[id],
}));

/**
 * meetType 어휘가 세 갈래로 갈라져 있어서 한 곳에서 정규화한다.
 *  - 클라이언트 폼:  online / offline / hybrid
 *  - 백엔드 계약:    online / offline / mixed
 *                   (RecruitmentCreateRequest 주석, RecruitmentDetailResponse.buildProcessTags switch)
 *  - 레거시 DB 행:   대문자 ("OFFLINE") — 운영 데이터에 실제로 섞여 있음
 *
 * 정규화하지 않으면 MEET_TYPE_CFG 조회가 실패해 진행 방식 뱃지가 조용히 사라지고,
 * 수정 화면에서는 선택된 진행 방식이 없는 것처럼 보인다.
 */
const MEET_TYPE_ALIAS = {
    online: "online",
    offline: "offline",
    hybrid: "hybrid",
    mixed: "hybrid",   // 백엔드 어휘
};

/** 어떤 표기로 들어와도 클라이언트 표준(online/offline/hybrid)으로 접는다. 모르는 값이면 null. */
export function normalizeMeetType(value) {
    if (!value) return null;
    return MEET_TYPE_ALIAS[String(value).trim().toLowerCase()] ?? null;
}

/**
 * 서버로 보낼 때 쓰는 표기.
 * "hybrid"를 그대로 보내면 백엔드 buildProcessTags 의 switch("mixed")에 걸리지 않아
 * 상세 화면의 "온·오프라인 혼합" 태그가 통째로 빠진다.
 */
export function toServerMeetType(value) {
    const id = normalizeMeetType(value) || "online";
    return id === "hybrid" ? "mixed" : id;
}

/** hasLocation(bool)만 있는 데이터에서 meetType 추정 — 카드 등에서 사용 */
export function inferMeetType(item) {
    if (!item) return "online";
    const normalized = normalizeMeetType(item.meetType);
    if (normalized) return normalized;
    return item.hasLocation ? "offline" : "online";
}

/**
 * 신청 상태 설정 — recruitmentUI/TabApplicants/ApplicantsDialog 공용
 * label / colorKey ("warning" | "success" | "error" | "muted") 만 가지며,
 * 실제 색은 사용처에서 theme.palette[colorKey].main 으로 해석.
 */
export const APPLICATION_STATUS_CFG = {
    PENDING:  { label: "대기 중", colorKey: "warning" },
    ACCEPTED: { label: "수락됨", colorKey: "success" },
    REJECTED: { label: "거절됨", colorKey: "error" },
};

/** colorKey → theme palette 색 해석 헬퍼 */
export function resolveStatusColor(theme, colorKey) {
    if (colorKey === "warning") return theme.palette.warning.main;
    if (colorKey === "success") return theme.palette.success.main;
    if (colorKey === "error")   return theme.palette.error.main;
    return theme.palette.text.disabled;
}

/**
 * Haversine 공식 — 두 좌표 사이 거리(km)
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} 거리(km)
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
